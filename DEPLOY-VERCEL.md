# Deploy AngKer SMM on Vercel (Full UI + API)

## 1. Push to GitHub

Unzip this project → create GitHub repo → upload **all files** (not the zip).

## 2. Vercel

1. vercel.com → Add New Project → Import GitHub repo
2. Framework: **Next.js**
3. Environment Variables:

```
DATABASE_URL=          # Neon/Postgres connection string
NEXTAUTH_SECRET=       # random 32+ chars
NEXTAUTH_URL=          # https://your-app.vercel.app
ADMIN_EMAIL=admin@angkersmm.com
ADMIN_PASSWORD=ChangeMe@123!
ABA_API_URL=https://khmer-system.com
ABA_API_KEY=
ABA_MERCHANT_ID=
```

4. Deploy

## 3. Database

Use [Neon](https://neon.tech) free Postgres:

```
npx prisma db push
npx prisma db seed
```

Or add build command already includes `prisma generate`.

After first deploy, run seed from local against production DATABASE_URL once.

## UI included

- Login / Register (cosmic + AK logo)
- New Order (platform grid TikTok/FB/…)
- Orders, Services, Dashboard
- Add Balance (ABA)
- Profile, Settings, API key
- Admin: Providers, Services, Import, Payments
