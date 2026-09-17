import { Body, Controller, Post } from '@nestjs/common';
import { HomepageNaturalLanguageRequestDto } from './dto/nl-request.dto';
import { IntentService } from './intent.service';

/**
 * Homepage Natural Language Request contract.
 * Rules always run; OpenAI enrichment when AI_PROVIDER=openai + key.
 */
@Controller('intent')
export class IntentController {
  constructor(private readonly intent: IntentService) {}

  @Post('nl')
  async parseHomepage(@Body() body: HomepageNaturalLanguageRequestDto) {
    return this.intent.parseHomepageRequestAsync({
      text: body.text,
      locale: body.locale,
      market: body.market,
      imageAssetId: body.imageAssetId ?? null,
    });
  }
}
