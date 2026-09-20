import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Device, DeviceStatus, Prisma } from '@prisma/client';

export type DeviceWithRelations = Prisma.DeviceGetPayload<{
  include: { organization: true; branch: true };
}>;

export interface CreateDeviceInput {
  organizationId: string;
  branchId: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
  status?: DeviceStatus;
}

export interface UpdateDeviceInput {
  hostname?: string;
  os?: string;
  appVersion?: string;
  status?: DeviceStatus;
  lastSeenAt?: Date | null;
}

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DeviceWithRelations | null> {
    return this.prisma.device.findUnique({
      where: { id },
      include: {
        organization: true,
        branch: true
      }
    });
  }

  async findByAgentInstanceId(agentInstanceId: string): Promise<DeviceWithRelations | null> {
    return this.prisma.device.findUnique({
      where: { agentInstanceId },
      include: {
        organization: true,
        branch: true
      }
    });
  }

  async create(data: CreateDeviceInput): Promise<Device> {
    return this.prisma.device.create({
      data: {
        organizationId: data.organizationId,
        branchId: data.branchId,
        agentInstanceId: data.agentInstanceId,
        hostname: data.hostname,
        os: data.os,
        appVersion: data.appVersion,
        status: data.status ?? DeviceStatus.ACTIVE,
        lastSeenAt: new Date()
      }
    });
  }

  async update(id: string, data: UpdateDeviceInput): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: DeviceStatus): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data: { status }
    });
  }

  async updateLastSeen(id: string, timestamp: Date = new Date()): Promise<Device> {
    return this.prisma.device.update({
      where: { id },
      data: { lastSeenAt: timestamp }
    });
  }

  async findByBranch(branchId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { branchId }
    });
  }

  async findByOrganization(organizationId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { organizationId }
    });
  }
}
