import { Controller, Get, Header, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SeoService } from './seo.service';

@Controller('seo')
export class PublicSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap')
  sitemapJson() {
    return this.seo.sitemapJson();
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemapXml(@Res() res: Response) {
    const xml = await this.seo.sitemapXml();
    res.type('application/xml').send(xml);
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robotsTxt(@Res() res: Response) {
    res.type('text/plain').send(this.seo.robotsTxt());
  }

  @Get('listings/:slug')
  async listingSeo(
    @Param('slug') slug: string,
    @Query('locale') locale = 'fa',
  ) {
    const result = await this.seo.listingSeo(slug, locale);
    if (!result) throw new NotFoundException('Listing not found');
    return result;
  }
}
