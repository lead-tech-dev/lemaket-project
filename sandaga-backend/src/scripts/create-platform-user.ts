import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import dataSource from '../ormconfig.cli';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

async function run() {
  await dataSource.initialize();

  const email = process.env.PLATFORM_WALLET_EMAIL ?? 'platform@lemaket.local';
  const firstName = process.env.PLATFORM_WALLET_FIRST_NAME ?? 'Platform';
  const lastName = process.env.PLATFORM_WALLET_LAST_NAME ?? 'Wallet';
  const rawPassword = process.env.PLATFORM_WALLET_PASSWORD ?? 'ChangeMe123!';

  const userRepo = dataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    console.log(`Platform user already exists: ${existing.id}`);
    await dataSource.destroy();
    return;
  }

  const password = await bcrypt.hash(rawPassword, 10);
  const user = userRepo.create({
    email,
    firstName,
    lastName,
    password,
    role: UserRole.USER,
    isActive: true,
    isVerified: true,
    isPro: false,
    settings: {
      isPlatformWallet: true
    }
  });

  const saved = await userRepo.save(user);
  console.log(`Platform user created: ${saved.id}`);
  await dataSource.destroy();
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
