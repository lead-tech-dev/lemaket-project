import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res
} from '@nestjs/common'
import { Response, Request } from 'express'
import { LinksService } from './links.service'
import { CreateShortLinkDto } from './dto/create-short-link.dto'

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('shorten')
  async shorten(@Body() dto: CreateShortLinkDto, @Req() req: Request) {
    const created = await this.linksService.create(dto)
    const host = req.get('host')
    const protocol = req.protocol
    const shortUrl = host ? `${protocol}://${host}/s/${created.slug}` : `/s/${created.slug}`
    return { slug: created.slug, shortUrl, targetUrl: created.targetUrl }
  }
}

@Controller('s')
export class ShortRedirectController {
  constructor(private readonly linksService: LinksService) {}

  @Get(':slug')
  async redirect(@Param('slug') slug: string, @Res() res: Response) {
    try {
      const link = await this.linksService.findBySlug(slug)
      return res.redirect(302, link.targetUrl)
    } catch (err) {
      if (err instanceof NotFoundException) {
        return res.status(404).send('Lien introuvable')
      }
      throw err
    }
  }
}
