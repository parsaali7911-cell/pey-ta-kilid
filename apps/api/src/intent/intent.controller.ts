import { Body, Controller, Post } from '@nestjs/common';
import { HomepageNaturalLanguageRequestDto } from './dto/nl-request.dto';
import { IntentService } from './intent.service';

/**
 * Homepage Natural Language Request contract.
 * Rule-path only — no LLM, no Search execution, no RFQ engine, no Vision.
 */
@Controller('intent')
export class IntentController {
  constructor(private readonly intent: IntentService) {}

  @Post('nl')
  parseHomepage(@Body() body: HomepageNaturalLanguageRequestDto) {
    return this.intent.parseHomepageRequest({
      text: body.text,
      locale: body.locale,
      market: body.market,
      imageAssetId: body.imageAssetId ?? null,
    });
  }
}
