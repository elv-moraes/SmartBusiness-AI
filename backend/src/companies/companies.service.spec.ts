import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const prismaServiceMock = {
    company: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a company', async () => {
    const dto = {
      name: 'Empresa Teste',
      email: 'teste@empresa.com',
    };

    const company = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: dto.name,
      document: null,
      email: dto.email,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaServiceMock.company.create.mockResolvedValue(company);

    await expect(service.create(dto)).resolves.toEqual(company);

    expect(prismaServiceMock.company.create).toHaveBeenCalledWith({
      data: dto,
    });
  });

  it('should list companies ordered by creation date', async () => {
    prismaServiceMock.company.findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);

    expect(prismaServiceMock.company.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('should throw NotFoundException when company does not exist', async () => {
    prismaServiceMock.company.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow(NotFoundException);
  });
});
