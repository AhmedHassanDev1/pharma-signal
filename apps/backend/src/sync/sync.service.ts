import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import {
  CanonicalSyncRequestDto,
  CanonicalSyncResponseDto,
  SyncBatchCounts,
  SyncBatchStatus as ContractSyncBatchStatus
} from '@pharma-signal/contracts';
import { SyncBatchStatus } from '@prisma/client';
import { SyncBatchesRepository } from './sync-batches.repository.js';
import { CanonicalRecordsRepository } from './canonical-records.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { InvalidProvenanceException } from '../common/exceptions/invalid-provenance.exception.js';

@Injectable()
export class SyncService {
  constructor(
    private readonly syncBatchesRepository: SyncBatchesRepository,
    private readonly canonicalRecordsRepository: CanonicalRecordsRepository,
    private readonly dataSourcesRepository: DataSourcesRepository
  ) {}

  /**
   * Processes a canonical sync payload from an authenticated device.
   *
   * 1. Validates X-Sync-Batch-ID header against request body syncBatchId.
   * 2. Verifies DataSource ownership (tenantId and deviceId).
   * 3. Enforces idempotency: returns cached summary if syncBatchId was already processed.
   * 4. Validates provenance on each record.
   * 5. Upserts canonical records (products, batches, inventories, suppliers).
   * 6. Updates and persists IngestionBatch state and returns CanonicalSyncResponseDto.
   */
  async processSync(
    device: DeviceWithRelations,
    dto: CanonicalSyncRequestDto,
    headerSyncBatchId?: string
  ): Promise<CanonicalSyncResponseDto> {
    // 1. Validate X-Sync-Batch-ID header if provided
    if (headerSyncBatchId && dto.syncBatchId && headerSyncBatchId !== dto.syncBatchId) {
      throw new BadRequestException(
        `Header X-Sync-Batch-ID '${headerSyncBatchId}' does not match request body syncBatchId '${dto.syncBatchId}'`
      );
    }

    const effectiveBatchId = dto.syncBatchId || headerSyncBatchId;
    if (!effectiveBatchId) {
      throw new BadRequestException('syncBatchId must be provided in body or X-Sync-Batch-ID header');
    }
    dto.syncBatchId = effectiveBatchId;

    // 2. Validate DataSource existence and device ownership
    const dataSource = await this.dataSourcesRepository.findById(dto.dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dto.dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dto.dataSourceId}'`
      );
    }

    // 3. Idempotency Check: Return cached summary if already successfully processed
    const existingBatch = await this.syncBatchesRepository.findByDataSourceAndBatchId(
      dataSource.id,
      dto.syncBatchId
    );

    if (
      existingBatch &&
      (existingBatch.status === SyncBatchStatus.COMPLETED ||
        existingBatch.status === SyncBatchStatus.PARTIALLY_FAILED) &&
      existingBatch.summary
    ) {
      return existingBatch.summary as unknown as CanonicalSyncResponseDto;
    }

    // 4. Calculate received counts
    const products = dto.products ?? [];
    const batches = dto.batches ?? [];
    const inventories = dto.inventories ?? [];
    const suppliers = dto.suppliers ?? [];

    const receivedCounts: SyncBatchCounts = {
      products: products.length,
      batches: batches.length,
      inventories: inventories.length,
      suppliers: suppliers.length,
      totalRecords: products.length + batches.length + inventories.length + suppliers.length
    };

    // 5. Pre-validate provenance for all records and reject invalid provenance with RFC 7807 Problem Details
    const invalidParams: { name: string; reason: string }[] = [];
    const allRecords = [
      ...products.map((p) => ({ type: 'product', sourceId: p.sourceId, provenance: p.provenance })),
      ...batches.map((b) => ({ type: 'batch', sourceId: b.sourceId, provenance: b.provenance })),
      ...inventories.map((i) => ({ type: 'inventory', sourceId: i.sourceId, provenance: i.provenance })),
      ...suppliers.map((s) => ({ type: 'supplier', sourceId: s.sourceId, provenance: s.provenance }))
    ];

    for (const record of allRecords) {
      if (record.provenance.tenantId !== device.organizationId) {
        invalidParams.push({
          name: `${record.type}[${record.sourceId}].provenance.tenantId`,
          reason: `Expected tenantId '${device.organizationId}', received '${record.provenance.tenantId}'`
        });
      }
      if (record.provenance.deviceId !== device.id) {
        invalidParams.push({
          name: `${record.type}[${record.sourceId}].provenance.deviceId`,
          reason: `Expected deviceId '${device.id}', received '${record.provenance.deviceId}'`
        });
      }
      if (record.provenance.dataSourceId !== dataSource.id) {
        invalidParams.push({
          name: `${record.type}[${record.sourceId}].provenance.dataSourceId`,
          reason: `Expected dataSourceId '${dataSource.id}', received '${record.provenance.dataSourceId}'`
        });
      }
    }

    if (invalidParams.length > 0) {
      throw new InvalidProvenanceException(
        'One or more records contain invalid or forged provenance that does not match authenticated context',
        invalidParams
      );
    }

    // 6. Create or get IngestionBatch in PROCESSING state (with safe retry and concurrency support)
    let batchRecord = existingBatch;
    if (!batchRecord) {
      try {
        batchRecord = await this.syncBatchesRepository.create({
          syncBatchId: dto.syncBatchId,
          dataSourceId: dataSource.id,
          deviceId: device.id,
          tenantId: device.organizationId,
          status: SyncBatchStatus.PROCESSING,
          receivedCounts
        });
      } catch {
        // Handle concurrent request creating the same batch
        const concurrentBatch = await this.syncBatchesRepository.findByDataSourceAndBatchId(
          dataSource.id,
          dto.syncBatchId
        );
        if (concurrentBatch?.summary) {
          return concurrentBatch.summary as unknown as CanonicalSyncResponseDto;
        }
        if (concurrentBatch) {
          batchRecord = concurrentBatch;
        } else {
          throw new BadRequestException('Failed to initialize sync batch');
        }
      }
    } else {
      // If retrying a previous failed batch, update status to PROCESSING
      await this.syncBatchesRepository.update(batchRecord.id, {
        status: SyncBatchStatus.PROCESSING,
        receivedCounts
      });
    }

    // 7. Process Records
    const appliedCounts: SyncBatchCounts = {
      products: 0,
      batches: 0,
      inventories: 0,
      suppliers: 0,
      totalRecords: 0
    };
    const rejectedCounts = 0;

    // Process Products
    for (const item of products) {

      await this.canonicalRecordsRepository.upsertProduct({
        tenantId: device.organizationId,
        dataSourceId: dataSource.id,
        sourceTable: item.sourceTable,
        sourceId: item.sourceId,
        code: (item.data as any).code,
        name: (item.data as any).name,
        description: (item.data as any).description,
        category: (item.data as any).category,
        unit: (item.data as any).unit,
        isActive: (item.data as any).isActive,
        rawPayload: (item.data as any).rawPayload,
        provenance: item.provenance,
        extractedAt: new Date(item.provenance.extractedAt)
      });
      appliedCounts.products++;
    }

    // Process Batches
    for (const item of batches) {
      await this.canonicalRecordsRepository.upsertBatch({
        tenantId: device.organizationId,
        dataSourceId: dataSource.id,
        sourceTable: item.sourceTable,
        sourceId: item.sourceId,
        productSourceId: (item.data as any).productSourceId,
        productId: (item.data as any).productId,
        batchNumber: (item.data as any).batchNumber,
        expiryDate: (item.data as any).expiryDate,
        manufacturingDate: (item.data as any).manufacturingDate,
        rawPayload: (item.data as any).rawPayload,
        provenance: item.provenance,
        extractedAt: new Date(item.provenance.extractedAt)
      });
      appliedCounts.batches++;
    }

    // Process Inventories
    for (const item of inventories) {
      await this.canonicalRecordsRepository.upsertInventory({
        tenantId: device.organizationId,
        dataSourceId: dataSource.id,
        sourceTable: item.sourceTable,
        sourceId: item.sourceId,
        productSourceId: (item.data as any).productSourceId,
        productId: (item.data as any).productId,
        batchSourceId: (item.data as any).batchSourceId,
        batchId: (item.data as any).batchId,
        quantity: (item.data as any).quantity,
        unitPrice: (item.data as any).unitPrice,
        location: (item.data as any).location,
        rawPayload: (item.data as any).rawPayload,
        provenance: item.provenance,
        extractedAt: new Date(item.provenance.extractedAt)
      });
      appliedCounts.inventories++;
    }

    // Process Suppliers
    for (const item of suppliers) {
      await this.canonicalRecordsRepository.upsertSupplier({
        tenantId: device.organizationId,
        dataSourceId: dataSource.id,
        sourceTable: item.sourceTable,
        sourceId: item.sourceId,
        name: (item.data as any).name,
        contact: (item.data as any).contact,
        phone: (item.data as any).phone,
        email: (item.data as any).email,
        address: (item.data as any).address,
        isActive: (item.data as any).isActive,
        rawPayload: (item.data as any).rawPayload,
        provenance: item.provenance,
        extractedAt: new Date(item.provenance.extractedAt)
      });
      appliedCounts.suppliers++;
    }

    appliedCounts.totalRecords =
      appliedCounts.products +
      appliedCounts.batches +
      appliedCounts.inventories +
      appliedCounts.suppliers;

    // 7. Determine Final Status
    let finalStatus: SyncBatchStatus = SyncBatchStatus.COMPLETED;
    if (rejectedCounts > 0) {
      if (appliedCounts.totalRecords > 0) {
        finalStatus = SyncBatchStatus.PARTIALLY_FAILED;
      } else if (receivedCounts.totalRecords > 0) {
        finalStatus = SyncBatchStatus.FAILED;
      }
    }

    const response: CanonicalSyncResponseDto = {
      syncBatchId: dto.syncBatchId,
      status: finalStatus as unknown as ContractSyncBatchStatus,
      receivedCounts,
      appliedCounts,
      rejectedCounts,
      message:
        finalStatus === SyncBatchStatus.COMPLETED
          ? 'Sync batch processed successfully'
          : `Sync batch processed with ${rejectedCounts} rejected records`
    };

    // 8. Update IngestionBatch with summary and status
    await this.syncBatchesRepository.update(batchRecord.id, {
      status: finalStatus,
      appliedCounts,
      rejectedCounts,
      summary: response as unknown as Record<string, unknown>,
      processedAt: new Date()
    });

    return response;
  }

  async getBatchBySyncBatchId(
    device: DeviceWithRelations,
    dataSourceId: string,
    syncBatchId: string
  ) {
    const dataSource = await this.dataSourcesRepository.findById(dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dataSourceId}'`
      );
    }

    const batch = await this.syncBatchesRepository.findByDataSourceAndBatchId(
      dataSourceId,
      syncBatchId
    );
    if (!batch) {
      throw new NotFoundException(
        `Sync batch '${syncBatchId}' not found for data source '${dataSourceId}'`
      );
    }

    return batch;
  }

  async getDataSourceDiagnostics(device: DeviceWithRelations, dataSourceId: string) {
    const dataSource = await this.dataSourcesRepository.findById(dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dataSourceId}'`
      );
    }

    const [batchesByStatus, canonicalCounts, latestBatch, latestSuccess] = await Promise.all([
      this.syncBatchesRepository.countByStatus(dataSourceId),
      this.canonicalRecordsRepository.countByDataSource(dataSourceId),
      this.syncBatchesRepository.findLatestByDataSource(dataSourceId),
      this.syncBatchesRepository.findLatestSuccessful(dataSourceId)
    ]);

    const totalBatches = Object.values(batchesByStatus).reduce((a, b) => a + b, 0);

    return {
      dataSourceId,
      totalBatches,
      batchesByStatus,
      canonicalCounts,
      latestBatch,
      lastSuccessAt: latestSuccess?.processedAt ?? latestSuccess?.createdAt ?? null
    };
  }

  async getDataSourceBatches(device: DeviceWithRelations, dataSourceId: string, limit = 50) {
    const dataSource = await this.dataSourcesRepository.findById(dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dataSourceId}'`
      );
    }

    return this.syncBatchesRepository.findByDataSource(dataSourceId, limit);
  }
}
