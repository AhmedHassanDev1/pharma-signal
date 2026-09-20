import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Organization, Branch } from '@prisma/client';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id }
    });
  }

  async findBranchById(id: string): Promise<Branch | null> {
    return this.prisma.branch.findUnique({
      where: { id }
    });
  }

  async findBranchInOrganization(organizationId: string, branchId: string): Promise<Branch | null> {
    return this.prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId
      }
    });
  }

  async countBranches(organizationId: string): Promise<number> {
    return this.prisma.branch.count({
      where: { organizationId }
    });
  }
}
