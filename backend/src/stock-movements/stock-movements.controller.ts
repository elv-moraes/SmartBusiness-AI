import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';
import { IdempotencyKeyPipe } from './idempotency-key.pipe';
import { StockMovementsService } from './stock-movements.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.service.create(
      request.user.companyId,
      request.user.sub,
      new IdempotencyKeyPipe().transform(key),
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListStockMovementsDto,
  ) {
    return this.service.findAll(request.user.companyId, query);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.findOne(id, request.user.companyId);
  }
}
