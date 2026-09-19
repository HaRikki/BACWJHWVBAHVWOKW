# AngKer SMM — Premium SMM Reseller Platform

**Production-ready Full-Stack SMM Reseller Panel**  
ភាសា: ខ្មែរ + English | Dark/Light Mode | ABA + Bakong Payment

---

## 🚀 Features

- ✅ User Registration / Login / Google OAuth
- ✅ Password Hashing + JWT Session
- ✅ User Dashboard (Orders, Balance, Stats)
- ✅ SMM Services (TikTok, Facebook, Telegram)
- ✅ Order System with Provider API integration
- ✅ Multi-Provider Support + Service Mapping
- ✅ User API Key System + Documentation
- ✅ Auto Payment: **ABA PayWay** + **Bakong KHQR** only
- ✅ Admin Panel (Users, Orders, Services, Providers, Payments, Logs...)
- ✅ RBAC (Super Admin / Admin / Manager)
- ✅ Khmer + English i18n (easy to add more)
- ✅ Dark / Light Theme (persisted)
- ✅ Premium Futuristic UI (Glass, Animations)
- ✅ Fully Responsive (Mobile-first)
- ✅ Activity Logs, Notifications, Promotions
- ✅ Maintenance Mode

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Next.js API Routes + Prisma |
| Database | SQLite (dev) / PostgreSQL (production) |
| Auth | NextAuth.js (Credentials + Google) |
| i18n | next-intl |
| Payments | Modular ABA PayWay + Bakong KHQR |
| Charts | Recharts |

---

## 🛠️ Requirements

- Node.js 18+
- npm or yarn
- PostgreSQL (recommended for production) or SQLite for local

---

## 📥 Installation

```bash
# 1. Extract / Clone
cd angker-smm

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env
# Edit .env with your values

# 4. Database
# For SQLite (quick start):
# DATABASE_URL="file:./dev.db"

npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# 5. Run development
npm run dev
```

Open http://localhost:3000

**Default Admin (from seed):**
- Email: value of `ADMIN_EMAIL` in `.env` (default `admin@angkersmm.com`)
- Password: value of `ADMIN_PASSWORD` in `.env` (default `ChangeMe@123!`)

**⚠️ Change the admin password immediately after first login.**

---

## 🔐 Environment Variables

See `.env.example` for full list.

Critical ones:

```env
DATABASE_URL=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=           # generate long random string
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ABA PayWay
ABA_API_URL=https://checkout-sandbox.payway.com.kh
ABA_MERCHANT_ID=
ABA_API_KEY=
ABA_CALLBACK_URL=

# Bakong
BAKONG_API_URL=https://api-bakong.nbc.gov.kh
BAKONG_TOKEN=
BAKONG_ACCOUNT_ID=
BAKONG_MERCHANT_NAME=AngKer SMM
```

**Never commit real secrets to git.**

---

## 🗄️ Database

Prisma schema includes:

- users, accounts, sessions
- categories, services, providers, service_mappings
- orders, transactions, payment_methods
- coupons, notifications, activity_logs, settings, roles

To switch to PostgreSQL:

1. Change `provider = "postgresql"` in `prisma/schema.prisma`
2. Set `DATABASE_URL` to your Postgres connection string
3. Run `npx prisma db push` + seed

---

## 💳 Payment Setup

### ABA PayWay
1. Register at ABA PayWay Developer / Sandbox
2. Get Merchant ID + API Key
3. Put credentials in `.env`
4. In Admin → Payments → Enable ABA

### Bakong KHQR
1. Register Bakong Open API token (NBC or via your bank)
2. Set account ID + token in `.env`
3. In Admin → Payments → Enable Bakong

Both can be enabled or disabled independently from Admin Panel.  
If both disabled, users see “Payment is temporarily unavailable”.

Payment flow is fully server-side. Balance updates only after successful backend verification.

---

## 🔌 SMM Provider Setup

1. Admin → Providers → Add Provider
2. Enter Provider Name, API URL, API Key
3. Admin → Service Mapping → Map local service to provider service ID
4. Orders will be forwarded to the provider automatically

Compatible with standard SMM Panel API v2 (`action=services|add|status|balance`).

---

## 🔑 User API

Users can generate an API key from the **API** page.

Endpoints (authenticated with API Key):

- `POST /api/v1/services`
- `POST /api/v1/order`
- `POST /api/v1/status`
- `POST /api/v1/balance`

Documentation is available inside the user API page.

---

## 🚀 Production Deployment

### VPS / Linux Server

```bash
npm run build
npm start
# or use PM2
pm2 start npm --name angker-smm -- start
```

Use Nginx as reverse proxy + SSL (Let’s Encrypt).

### Render

1. Connect repo
2. Set environment variables
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npx prisma db push && npm start`
5. Add PostgreSQL database

### Vercel

- Works well for frontend + API routes
- Use Vercel Postgres or external PostgreSQL
- Set all env vars in project settings
- Note: long-running provider polling may need separate worker

### Database

Always use PostgreSQL in production (not SQLite).

---

## 📁 Project Structure

```
angker-smm/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Register
│   │   ├── (dashboard)/     # User pages
│   │   ├── admin/           # Admin panel
│   │   └── api/             # API routes
│   ├── components/
│   ├── lib/                 # prisma, auth, utils, smm-provider
│   ├── payments/
│   │   ├── aba/
│   │   └── bakong/
│   ├── i18n/
│   └── hooks/
├── .env.example
├── package.json
└── README.md
```

---

## 🧪 Local Testing Checklist

- [ ] Register new user
- [ ] Login / Logout
- [ ] Google login (if configured)
- [ ] Dashboard stats
- [ ] Browse & search services
- [ ] Place order (with balance)
- [ ] Add balance (ABA / Bakong when enabled)
- [ ] Generate API key
- [ ] Admin: enable/disable payments
- [ ] Admin: manage services & providers
- [ ] Switch language (KM / EN)
- [ ] Switch Dark / Light theme
- [ ] Mobile responsive

---

## ⚠️ Important Notes

1. This is a **real full-stack** project, not a static mockup.
2. Payment modules are modular. Real credentials are required for live payments.
3. SMM Provider integration follows the industry-standard v2 API format.
4. All secrets must stay in `.env` / server environment — never in frontend code.
5. Change default admin password after first login.
6. For production, use PostgreSQL + strong `NEXTAUTH_SECRET`.

---

## 📄 License

Private / Commercial use for AngKer SMM.

---

**Built for AngKer SMM — Premium • Fast • Reliable**

---

## Upgrade Notes (Production Hardening)

### Financial fields
All money fields use Prisma `Decimal` for precision.

### Order flow
Orders atomically deduct balance, submit to SMM provider (API v2), and refund on provider failure.
Idempotency supported via `idempotencyKey` body field or `Idempotency-Key` header.

### Order status sync
Call periodically:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/sync-orders
```

### User API
```
POST /api/v1
Body: { "key": "ak_...", "action": "services|add|status|balance", ... }
```
Or `Authorization: Bearer ak_...`

### Admin
- `/admin` — panel home
- `/admin/payments` — ABA/Bakong config + API keys
- Provider management API: `/api/admin/providers`

### ABA
Configured via Admin → Payments (Profile Key + Merchant ID from khmer-system.com).

### Bakong
Requires real NBC token + account ID. No mock success in production paths.
