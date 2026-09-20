import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Organization, Branch, OrganizationStatus, BranchStatus } from '@prisma/client';
import { OrganizationsRepository } from './organizations.repository.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}

  async getOrganization(id: string): Promise<Organization> {
    const org = await this.repository.findOrganizationById(id);
    if (!org) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }
    return org;
  }

  async getBranch(branchId: string): Promise<Branch> {
    const branch = await this.repository.findBranchById(branchId);
    if (!branch) {
      throw new NotFoundException(`Branch with ID '${branchId}' not found`);
    }
    return branch;
  }

  /**
   * Server-side ownership and active state verification.
   * Ensures the branch exists, belongs to the specified organization,
   * and both the organization and branch are in ACTIVE status.
   */
  async validateBranchOwnership(
    organizationId: string,
    branchId: string
  ): Promise<{ organization: Organization; branch: Branch }> {
    const org = await this.getOrganization(organizationId);

    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new BadRequestException(`Organization '${organizationId}' is not in ACTIVE status (current: ${org.status})`);
    }

    const branch = await this.getBranch(branchId);

    if (branch.organizationId !== organizationId) {
      throw new BadRequestException(
        `Branch '${branchId}' does not belong to Organization '${organizationId}'`
      );
    }

    if (branch.status !== BranchStatus.ACTIVE) {
      throw new BadRequestException(`Branch '${branchId}' is not in ACTIVE status (current: ${branch.status})`);
    }

    return { organization: org, branch };
  }
}
