import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createCompanyDto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: createCompanyDto,
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id);

    return this.prisma.company.update({
      where: {
        id,
      },
      data: updateCompanyDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.company.delete({
      where: {
        id,
      },
    });
  }
}
