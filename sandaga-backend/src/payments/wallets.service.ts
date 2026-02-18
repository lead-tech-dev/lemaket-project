import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { WalletTransaction } from './wallet-transaction.entity';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';

@Injectable()
export class WalletsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>
  ) {}

  async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return {
      balance: Number(user.walletBalance ?? 0),
      currency: user.walletCurrency || 'XAF'
    };
  }

  async ensureCurrency(user: User, currency: string) {
    const normalized = currency.toUpperCase();
    if (user.walletCurrency && user.walletCurrency !== normalized) {
      throw new BadRequestException('Devise du wallet incompatible.');
    }
    if (!user.walletCurrency) {
      user.walletCurrency = normalized;
      await this.usersRepository.save(user);
    }
  }

  async credit(params: {
    userId: string;
    amount: number;
    currency: string;
    type: WalletTransactionType;
    metadata?: Record<string, unknown>;
  }): Promise<WalletTransaction> {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Montant invalide.');
    }
    const currency = params.currency.toUpperCase();
    const tx = await this.dataSource.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: params.userId }
      });
      if (!user) throw new NotFoundException('Utilisateur introuvable.');
      if (user.walletCurrency && user.walletCurrency !== currency) {
        throw new BadRequestException('Devise du wallet incompatible.');
      }
      const current = Number(user.walletBalance ?? 0);
      const next = current + params.amount;
      user.walletBalance = next.toFixed(2);
      user.walletCurrency = currency;
      await manager.save(user);
      const tx = manager.create(WalletTransaction, {
        userId: user.id,
        type: params.type,
        amount: params.amount.toFixed(2),
        currency,
        status: 'completed',
        metadata: params.metadata ?? null
      });
      await manager.save(tx);
      return tx;
    });
    return tx;
  }

  async debit(params: {
    userId: string;
    amount: number;
    currency: string;
    type: WalletTransactionType;
    metadata?: Record<string, unknown>;
  }): Promise<WalletTransaction> {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Montant invalide.');
    }
    const currency = params.currency.toUpperCase();
    const tx = await this.dataSource.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: params.userId }
      });
      if (!user) throw new NotFoundException('Utilisateur introuvable.');
      if (user.walletCurrency && user.walletCurrency !== currency) {
        throw new BadRequestException('Devise du wallet incompatible.');
      }
      const current = Number(user.walletBalance ?? 0);
      if (current < params.amount) {
        throw new BadRequestException('Solde wallet insuffisant.');
      }
      const next = current - params.amount;
      user.walletBalance = next.toFixed(2);
      user.walletCurrency = currency;
      await manager.save(user);
      const tx = manager.create(WalletTransaction, {
        userId: user.id,
        type: params.type,
        amount: (-params.amount).toFixed(2),
        currency,
        status: 'completed',
        metadata: params.metadata ?? null
      });
      await manager.save(tx);
      return tx;
    });
    return tx;
  }
}
