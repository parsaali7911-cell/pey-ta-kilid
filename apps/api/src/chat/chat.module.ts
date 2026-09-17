import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ListingChatController } from './listing-chat.controller';
import { ListingChatService } from './listing-chat.service';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [ListingChatController],
  providers: [ListingChatService],
  exports: [ListingChatService],
})
export class ChatModule {}
