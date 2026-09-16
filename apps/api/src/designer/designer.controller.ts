import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { DesignerService } from './designer.service';

class GenerateDto {
  @IsString()
  spaceMediaPublicId!: string;

  @IsString()
  listingRef!: string;

  @IsString()
  @MinLength(8)
  prompt!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@Controller('designer')
export class DesignerController {
  constructor(private readonly designer: DesignerService) {}

  @Post('session')
  createSession() {
    const sessionToken = this.designer.createGuestSessionToken();
    return {
      sessionToken,
      note: 'Store token and send as X-Designer-Session when auth is added.',
    };
  }

  @Get('status')
  status() {
    return this.designer.status();
  }

  @Post('upload/:kind')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('locale') locale?: string,
  ) {
    if (kind !== 'space' && kind !== 'listing') {
      throw new BadRequestException('kind must be space or listing');
    }
    if (!file) throw new BadRequestException('file required');
    return this.designer.uploadInput({ kind, file, locale });
  }

  @Post('generate')
  generate(@Body() dto: GenerateDto) {
    return this.designer.generate(dto);
  }

  @Get('jobs/:publicId')
  job(@Param('publicId') publicId: string) {
    return this.designer.getJob(publicId);
  }
}
