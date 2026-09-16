import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMediaDto, CreateProductDto, CreateVariantDto } from './dto/product-media.dto';
import { ProductMediaService } from './product-media.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProductMediaController {
  constructor(private readonly products: ProductMediaService) {}

  @Post('seller/products')
  createProduct(@Req() req: { user: { userId: string } }, @Body() dto: CreateProductDto) {
    return this.products.createProduct(req.user.userId, dto);
  }

  @Post('seller/products/:id/variants')
  createVariant(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.products.createVariant(req.user.userId, id, dto);
  }

  @Post('seller/media')
  addMedia(@Req() req: { user: { userId: string } }, @Body() dto: CreateMediaDto) {
    return this.products.addMedia(req.user.userId, dto);
  }

  @Get('seller/listings/:id/media')
  listListingMedia(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.products.listForListing(req.user.userId, id);
  }

  @Post('seller/listings/:id/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadListingMedia(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('altText') altText?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Image file required');
    return this.products.uploadForListing(req.user.userId, id, file, altText);
  }

  @Delete('seller/media/:id')
  removeMedia(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.products.remove(req.user.userId, id);
  }
}
