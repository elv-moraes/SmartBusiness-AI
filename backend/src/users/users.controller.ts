import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(
    @Query('companyId', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
  ) {
    return this.usersService.findAll(companyId);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('companyId', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
  ) {
    return this.usersService.findOne(id, companyId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('companyId', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, companyId, updateUserDto);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('companyId', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
  ) {
    return this.usersService.remove(id, companyId);
  }
}
