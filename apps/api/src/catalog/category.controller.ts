import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { CategoryService } from './category.service';
import { CreateAttributeDefinitionDto } from './dto/attribute.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller()
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get('categories')
  list(@Query('locale') locale?: string) {
    return this.categories.listTree(locale);
  }

  @Get('categories/:id/attributes')
  effectiveAttributes(@Param('id') id: string) {
    return this.categories.getEffectiveAttributes(id);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch('admin/categories/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/categories/:id/attributes')
  createAttribute(@Param('id') id: string, @Body() dto: CreateAttributeDefinitionDto) {
    return this.categories.createAttribute(id, dto);
  }
}
