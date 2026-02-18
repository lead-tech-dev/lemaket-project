import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { ListingsService } from '../listings/listings.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepository: Repository<Favorite>,
    private readonly listingsService: ListingsService
  ) {}

  async add(listingId: string, user: AuthUser): Promise<Favorite> {
    await this.listingsService.findOne(listingId);

    const existing = await this.favoritesRepository.findOne({
      where: { listingId, userId: user.id }
    });

    if (existing) {
      throw new ConflictException('Listing is already in favorites.');
    }

    const favorite = this.favoritesRepository.create({
      listingId,
      userId: user.id
    });

    return this.favoritesRepository.save(favorite);
  }

  async remove(listingId: string, user: AuthUser): Promise<void> {
    await this.favoritesRepository.delete({ listingId, userId: user.id });
  }

  getForUser(user: AuthUser) {
    return this.favoritesRepository.find({
      where: { userId: user.id },
      relations: { listing: { images: true, category: true, owner: true } },
      order: { created_at: 'DESC' }
    });
  }
}
