import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  findCurrent(@Req() request: AuthenticatedRequest) {
    return this.companiesService.findOne(request.user.companyId);
  }

  @Patch('me')
  @Roles(UserRole.OWNER)
  updateCurrent(
    @Req() request: AuthenticatedRequest,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(
      request.user.companyId,
      updateCompanyDto,
    );
  }
}
