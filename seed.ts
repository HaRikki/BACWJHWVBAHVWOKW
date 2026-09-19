import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AngKer SMM database...');

  // Settings
  const settings = [
    { key: 'site_name', value: 'AngKer SMM' },
    { key: 'currency', value: 'USD' },
    { key: 'default_locale', value: 'km' },
    { key: 'default_theme', value: 'dark' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'registration_enabled', value: 'true' },
    { key: 'min_deposit', value: '1' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // Roles
  await prisma.role.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: {
      name: 'superadmin',
      permissions: JSON.stringify(['*']),
    },
  });

  await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      permissions: JSON.stringify([
        'users.view', 'users.edit', 'orders.view', 'orders.edit',
        'services.view', 'services.edit', 'providers.view', 'providers.edit',
        'payments.view', 'payments.edit', 'transactions.view', 'logs.view',
      ]),
    },
  });

  await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      permissions: JSON.stringify([
        'orders.view', 'services.view', 'transactions.view',
      ]),
    },
  });

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@angkersmm.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@123!';
  const hashed = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      username: 'angkersmm',
      email: adminEmail,
      password: hashed,
      name: 'AngKer SMM',
      role: 'superadmin',
      status: 'active',
      balance: 0,
    },
  });

  // Payment methods
  await prisma.paymentMethod.upsert({
    where: { name: 'aba' },
    update: {},
    create: {
      name: 'aba',
      displayName: 'ABA PayWay',
      enabled: false,
      minAmount: 1,
      maxAmount: 10000,
    },
  });

  await prisma.paymentMethod.upsert({
    where: { name: 'bakong' },
    update: {},
    create: {
      name: 'bakong',
      displayName: 'Bakong KHQR',
      enabled: false,
      minAmount: 1,
      maxAmount: 10000,
    },
  });

  // Categories
  const categories = [
    { name: 'TikTok Likes', nameKm: 'TikTok សំណព្វចិត្ត', slug: 'tiktok-likes', platform: 'tiktok', sortOrder: 1 },
    { name: 'TikTok Views', nameKm: 'TikTok ទស្សនា', slug: 'tiktok-views', platform: 'tiktok', sortOrder: 2 },
    { name: 'TikTok Followers', nameKm: 'TikTok អ្នកតាម', slug: 'tiktok-followers', platform: 'tiktok', sortOrder: 3 },
    { name: 'TikTok Saves', nameKm: 'TikTok រក្សាទុក', slug: 'tiktok-saves', platform: 'tiktok', sortOrder: 4 },
    { name: 'TikTok Shares', nameKm: 'TikTok ចែករំលែក', slug: 'tiktok-shares', platform: 'tiktok', sortOrder: 5 },
    { name: 'TikTok Comments', nameKm: 'TikTok មតិ', slug: 'tiktok-comments', platform: 'tiktok', sortOrder: 6 },
    { name: 'Facebook Likes', nameKm: 'Facebook សំណព្វចិត្ត', slug: 'facebook-likes', platform: 'facebook', sortOrder: 10 },
    { name: 'Facebook Followers', nameKm: 'Facebook អ្នកតាម', slug: 'facebook-followers', platform: 'facebook', sortOrder: 11 },
    { name: 'Facebook Views', nameKm: 'Facebook ទស្សនា', slug: 'facebook-views', platform: 'facebook', sortOrder: 12 },
    { name: 'Facebook Comments', nameKm: 'Facebook មតិ', slug: 'facebook-comments', platform: 'facebook', sortOrder: 13 },
    { name: 'Telegram Members', nameKm: 'Telegram សមាជិក', slug: 'telegram-members', platform: 'telegram', sortOrder: 20 },
    { name: 'Telegram Views', nameKm: 'Telegram ទស្សនា', slug: 'telegram-views', platform: 'telegram', sortOrder: 21 },
    { name: 'Telegram Reactions', nameKm: 'Telegram ប្រតិកម្ម', slug: 'telegram-reactions', platform: 'telegram', sortOrder: 22 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Sample services (demo)
  const tiktokLikes = await prisma.category.findUnique({ where: { slug: 'tiktok-likes' } });
  const tiktokViews = await prisma.category.findUnique({ where: { slug: 'tiktok-views' } });
  const tiktokFollowers = await prisma.category.findUnique({ where: { slug: 'tiktok-followers' } });

  if (tiktokLikes) {
    await prisma.service.createMany({
      data: [
        {
          name: 'TikTok Likes - High Quality',
          nameKm: 'TikTok សំណព្វចិត្ត - គុណភាពខ្ពស់',
          categoryId: tiktokLikes.id,
          min: 100,
          max: 50000,
          price: 0.8,
          cost: 0.4,
          status: 'active',
          averageTime: '0-1 hour',
        },
        {
          name: 'TikTok Likes - Instant',
          nameKm: 'TikTok សំណព្វចិត្ត - ភ្លាមៗ',
          categoryId: tiktokLikes.id,
          min: 50,
          max: 10000,
          price: 1.2,
          cost: 0.7,
          status: 'active',
          averageTime: '0-30 min',
        },
      ],
      skipDuplicates: true,
    });
  }

  if (tiktokViews) {
    await prisma.service.createMany({
      data: [
        {
          name: 'TikTok Views - Real',
          nameKm: 'TikTok ទស្សនា - ពិត',
          categoryId: tiktokViews.id,
          min: 1000,
          max: 1000000,
          price: 0.15,
          cost: 0.08,
          status: 'active',
          averageTime: '0-2 hours',
        },
      ],
      skipDuplicates: true,
    });
  }

  if (tiktokFollowers) {
    await prisma.service.createMany({
      data: [
        {
          name: 'TikTok Followers - HQ',
          nameKm: 'TikTok អ្នកតាម - គុណភាពខ្ពស់',
          categoryId: tiktokFollowers.id,
          min: 100,
          max: 20000,
          price: 2.5,
          cost: 1.5,
          status: 'active',
          averageTime: '0-6 hours',
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log(`Admin Email: ${adminEmail}`);
  console.log(`Admin Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
