import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';

@Module({
  imports: [AiModule],
  controllers: [IntentController],
  providers: [IntentService],
  exports: [IntentService],
})
export class IntentModule {}
