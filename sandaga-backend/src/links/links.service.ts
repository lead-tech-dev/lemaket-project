import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ShortLink } from './short-link.entity'
import { CreateShortLinkDto } from './dto/create-short-link.dto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randomSlug(length = 7): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  }
  return out
}

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(ShortLink)
    private readonly repo: Repository<ShortLink>
  ) {}

  async create(dto: CreateShortLinkDto): Promise<ShortLink> {
    let slug = dto.slug?.trim()

    if (slug) {
      const exists = await this.repo.exist({ where: { slug } })
      if (exists) {
        slug = null
      }
    }

    if (!slug) {
      // try a few times to avoid collisions
      for (let i = 0; i < 5; i += 1) {
        const candidate = randomSlug()
        const exists = await this.repo.exist({ where: { slug: candidate } })
        if (!exists) {
          slug = candidate
          break
        }
      }
      if (!slug) {
        slug = randomSlug(9)
      }
    }

    const shortLink = this.repo.create({
      slug,
      targetUrl: dto.targetUrl,
      expiresAt: null
    })
    return this.repo.save(shortLink)
  }

  async findBySlug(slug: string): Promise<ShortLink> {
    const shortLink = await this.repo.findOne({ where: { slug } })
    if (!shortLink) {
      throw new NotFoundException('Lien court introuvable')
    }
    if (shortLink.expiresAt && shortLink.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Lien expiré')
    }
    return shortLink
  }
}
