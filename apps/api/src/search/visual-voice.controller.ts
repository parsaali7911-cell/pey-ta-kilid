import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { VisualVoiceSearchService } from './visual-voice.service';

@Controller('search')
export class VisualVoiceSearchController {
  constructor(private readonly visualVoice: VisualVoiceSearchService) {}

  @Post('visual')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  visual(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('locale') locale?: string,
    @Body('clientHex') clientHex?: string,
    @Body('text') text?: string,
  ) {
    if (!file?.buffer?.length && !clientHex) {
      throw new BadRequestException('Image file or clientHex required');
    }
    return this.visualVoice.visualSearch({
      buffer: file?.buffer,
      locale,
      clientHex,
      userText: text,
    });
  }

  /** Alias for visual-search image uploads used by web clients. */
  @Post('visual-search/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  visualImageAlias(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('locale') locale?: string,
    @Body('clientHex') clientHex?: string,
    @Body('text') text?: string,
  ) {
    return this.visual(file, locale, clientHex, text);
  }

  @Post('voice')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  voice(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('locale') locale?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Audio file required');
    return this.visualVoice.voiceTranscribe({ buffer: file.buffer, locale });
  }
}
