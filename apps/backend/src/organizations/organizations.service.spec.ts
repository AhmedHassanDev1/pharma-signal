import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { Organization, Branch, OrganizationRole, OrganizationStatus, BranchStatus } from '@prisma/client';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let repositoryMock: {
    findOrganizationById: ReturnType<typeof jest.fn<(id: string) => Promise<Organization | null>>>;
    findBranchById: ReturnType<typeof jest.fn<(id: string) => Promise<Branch | null>>>;
    findBranchInOrganization: ReturnType<typeof jest.fn<(orgId: string, branchId: string) => Promise<Branch | null>>>;
    countBranches: ReturnType<typeof jest.fn<(orgId: string) => Promise<number>>>;
  };

  const mockOrg: Organization = {
    id: 'org-uuid-1',
    name: 'Al-Amal Pharmacy Chain',
    role: OrganizationRole.RETAIL_PHARMACY,
    status: OrganizationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockBranch: Branch = {
    id: 'branch-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Downtown Branch',
    code: 'DOWNTOWN-01',
    status: BranchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    repositoryMock = {
      findOrganizationById: jest.fn<(id: string) => Promise<Organization | null>>().mockResolvedValue(mockOrg),
      findBranchById: jest.fn<(id: string) => Promise<Branch | null>>().mockResolvedValue(mockBranch),
      findBranchInOrganization: jest.fn<(orgId: string, branchId: string) => Promise<Branch | null>>().mockResolvedValue(mockBranch),
      countBranches: jest.fn<(orgId: string) => Promise<number>>().mockResolvedValue(1)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: OrganizationsRepository,
          useValue: repositoryMock
        }
      ]
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('getOrganization', () => {
    it('should return organization when found', async () => {
      const org = await service.getOrganization('org-uuid-1');
      expect(org).toEqual(mockOrg);
      expect(repositoryMock.findOrganizationById).toHaveBeenCalledWith('org-uuid-1');
    });

    it('should throw NotFoundException when organization is not found', async () => {
      repositoryMock.findOrganizationById.mockResolvedValueOnce(null);
      await expect(service.getOrganization('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBranch', () => {
    it('should return branch when found', async () => {
      const branch = await service.getBranch('branch-uuid-1');
      expect(branch).toEqual(mockBranch);
      expect(repositoryMock.findBranchById).toHaveBeenCalledWith('branch-uuid-1');
    });

    it('should throw NotFoundException when branch is not found', async () => {
      repositoryMock.findBranchById.mockResolvedValueOnce(null);
      await expect(service.getBranch('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateBranchOwnership', () => {
    it('should successfully validate when branch belongs to active organization and both are ACTIVE', async () => {
      const result = await service.validateBranchOwnership('org-uuid-1', 'branch-uuid-1');
      expect(result.organization).toEqual(mockOrg);
      expect(result.branch).toEqual(mockBranch);
    });

    it('should throw BadRequestException when organization is SUSPENDED', async () => {
      repositoryMock.findOrganizationById.mockResolvedValueOnce({
        ...mockOrg,
        status: OrganizationStatus.SUSPENDED
      });

      await expect(
        service.validateBranchOwnership('org-uuid-1', 'branch-uuid-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when branch belongs to a different organization', async () => {
      repositoryMock.findBranchById.mockResolvedValueOnce({
        ...mockBranch,
        organizationId: 'different-org-uuid'
      });

      await expect(
        service.validateBranchOwnership('org-uuid-1', 'branch-uuid-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when branch is INACTIVE', async () => {
      repositoryMock.findBranchById.mockResolvedValueOnce({
        ...mockBranch,
        status: BranchStatus.INACTIVE
      });

      await expect(
        service.validateBranchOwnership('org-uuid-1', 'branch-uuid-1')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
