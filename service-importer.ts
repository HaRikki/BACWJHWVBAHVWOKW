import { prisma } from './prisma';
import { SMMProviderClient } from './smm-provider';
import { toDecimal, money } from './money';
import { Decimal } from '@prisma/client/runtime/library';

export type ProviderServiceRow = {
  service: string;
  name: string;
  type?: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  refill?: boolean;
  cancel?: boolean;
  dripfeed?: boolean;
  description?: string;
  averageTime?: string;
  raw?: any;
};

export type PricingMode = 'percent' | 'fixed';

export function calcSellPrice(
  cost: number,
  mode: PricingMode,
  profitValue: number
): Decimal {
  const c = toDecimal(cost);
  if (mode === 'percent') {
    // cost * (1 + profit%/100)
    return c.mul(toDecimal(1).add(toDecimal(profitValue).div(100))).toDecimalPlaces(6);
  }
  // fixed $ on top of cost
  return c.add(toDecimal(profitValue)).toDecimalPlaces(6);
}

export function detectPlatform(category: string, name: string): string {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes('tiktok') || text.includes('tik tok')) return 'tiktok';
  if (text.includes('facebook') || text.includes('fb ')) return 'facebook';
  if (text.includes('instagram') || text.includes('ig ')) return 'instagram';
  if (text.includes('youtube') || text.includes('yt ')) return 'youtube';
  if (text.includes('telegram') || text.includes('tg ')) return 'telegram';
  if (text.includes('twitter') || text.includes(' x ')) return 'twitter';
  if (text.includes('spotify')) return 'spotify';
  if (text.includes('discord')) return 'discord';
  if (text.includes('twitch')) return 'twitch';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('snapchat')) return 'snapchat';
  return 'other';
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'category';
}

export async function ensureCategory(
  categoryName: string,
  platform: string,
  autoCreate: boolean
) {
  const slug = slugify(`${platform}-${categoryName}`);
  let cat = await prisma.category.findFirst({
    where: {
      OR: [{ slug }, { name: categoryName, platform }],
    },
  });
  if (cat) return cat;
  if (!autoCreate) {
    // try platform-level category
    cat = await prisma.category.findFirst({ where: { platform, status: 'active' } });
    if (cat) return cat;
  }
  return prisma.category.create({
    data: {
      name: categoryName || platform,
      slug: `${slug}-${Date.now().toString(36)}`,
      platform,
      status: 'active',
      sortOrder: 0,
    },
  });
}

export async function fetchProviderServices(providerId: string): Promise<{
  ok: boolean;
  services?: ProviderServiceRow[];
  error?: string;
  balance?: string;
}> {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { ok: false, error: 'Provider not found' };
  if (provider.status !== 'active') return { ok: false, error: 'Provider disabled' };

  try {
    const client = new SMMProviderClient(provider.apiUrl, provider.apiKey);
    const raw = await client.getServices();
    const services: ProviderServiceRow[] = raw.map((s) => ({
      service: String(s.service),
      name: s.name || `Service ${s.service}`,
      type: s.type,
      category: s.category || 'Uncategorized',
      rate: parseFloat(String(s.rate)) || 0,
      min: parseInt(String(s.min), 10) || 1,
      max: parseInt(String(s.max), 10) || 10000,
      refill: s.refill === true || s.refill === 'true' || s.refill === '1',
      cancel: s.cancel === true || s.cancel === 'true' || s.cancel === '1',
      description: (s as any).description,
      averageTime: (s as any).average_time || (s as any).averageTime,
      raw: s,
    }));

    // update provider lastSync + balance attempt
    try {
      const bal = await client.getBalance();
      await prisma.provider.update({
        where: { id: providerId },
        data: {
          lastSync: new Date(),
          ...(bal.balance != null ? { balance: String(bal.balance) } : {}),
        },
      });
    } catch {
      await prisma.provider.update({
        where: { id: providerId },
        data: { lastSync: new Date() },
      });
    }

    return { ok: true, services };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Failed to fetch services' };
  }
}

export type ImportItem = {
  providerServiceId: string;
  name: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  refill?: boolean;
  cancel?: boolean;
  description?: string;
  averageTime?: string;
  type?: string;
};

export async function importServices(opts: {
  adminId: string;
  providerId: string;
  items: ImportItem[];
  pricingMode: PricingMode;
  profitValue: number;
  updateExisting: boolean;
  autoCreateCategories: boolean;
  resetSellingPrice: boolean;
}) {
  const {
    adminId,
    providerId,
    items,
    pricingMode,
    profitValue,
    updateExisting,
    autoCreateCategories,
    resetSellingPrice,
  } = opts;

  if (profitValue < 0) {
    throw new Error('Profit cannot be negative');
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { id: string; name: string; error: string }[] = [];

  for (const item of items) {
    try {
      const cost = item.rate;
      const sell = calcSellPrice(cost, pricingMode, profitValue);
      if (sell.lessThanOrEqualTo(0)) {
        failed++;
        errors.push({ id: item.providerServiceId, name: item.name, error: 'Invalid selling price' });
        continue;
      }
      if (sell.lessThan(toDecimal(cost))) {
        failed++;
        errors.push({
          id: item.providerServiceId,
          name: item.name,
          error: 'Selling price below cost',
        });
        continue;
      }

      const platform = detectPlatform(item.category, item.name);
      const category = await ensureCategory(item.category, platform, autoCreateCategories);

      const existing = await prisma.service.findFirst({
        where: {
          providerId,
          providerServiceId: item.providerServiceId,
        },
      });

      if (existing) {
        if (!updateExisting) {
          skipped++;
          continue;
        }
        const data: any = {
          name: item.name,
          description: item.description || existing.description,
          categoryId: category.id,
          cost: toDecimal(cost),
          min: item.min,
          max: item.max,
          refill: item.refill ?? existing.refill,
          cancel: item.cancel ?? existing.cancel,
          averageTime: item.averageTime || existing.averageTime,
        };
        if (resetSellingPrice) {
          data.price = sell;
        }
        await prisma.service.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.service.create({
          data: {
            name: item.name,
            description: item.description || null,
            categoryId: category.id,
            providerId,
            providerServiceId: item.providerServiceId,
            min: item.min,
            max: item.max,
            price: sell,
            cost: toDecimal(cost),
            status: 'active',
            refill: item.refill ?? false,
            cancel: item.cancel ?? false,
            averageTime: item.averageTime || null,
          },
        });
        added++;
      }
    } catch (e: any) {
      failed++;
      errors.push({
        id: item.providerServiceId,
        name: item.name,
        error: e.message || 'Import failed',
      });
    }
  }

  const importRecord = await prisma.serviceImport.create({
    data: {
      adminId,
      providerId,
      pricingMode,
      profitValue: toDecimal(profitValue),
      fetched: items.length,
      selected: items.length,
      added,
      updated,
      skipped,
      failed,
      status: 'completed',
      details: JSON.stringify({ errors: errors.slice(0, 50) }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: adminId,
      action: 'SERVICE_IMPORT_COMPLETED',
      details: `Provider ${providerId}: +${added} ~${updated} skip ${skipped} fail ${failed}`,
    },
  });

  return { added, updated, skipped, failed, errors, importId: importRecord.id };
}

export async function classifyAgainstLocal(
  providerId: string,
  remote: ProviderServiceRow[]
) {
  const local = await prisma.service.findMany({
    where: { providerId },
    select: {
      id: true,
      providerServiceId: true,
      name: true,
      cost: true,
      price: true,
      status: true,
      min: true,
      max: true,
    },
  });

  const localMap = new Map(
    local.filter((l) => l.providerServiceId).map((l) => [l.providerServiceId!, l])
  );
  const remoteIds = new Set(remote.map((r) => r.service));

  const classified = remote.map((r) => {
    const existing = localMap.get(r.service);
    let state: 'new' | 'existing' | 'changed' = 'new';
    if (existing) {
      const costChanged = Math.abs(money(existing.cost) - r.rate) > 0.00001;
      state = costChanged ? 'changed' : 'existing';
    }
    return {
      ...r,
      state,
      localId: existing?.id,
      localPrice: existing ? money(existing.price) : null,
      localCost: existing ? money(existing.cost) : null,
      localStatus: existing?.status,
    };
  });

  const removed = local
    .filter((l) => l.providerServiceId && !remoteIds.has(l.providerServiceId))
    .map((l) => ({
      localId: l.id,
      providerServiceId: l.providerServiceId!,
      name: l.name,
      cost: money(l.cost),
      price: money(l.price),
      status: l.status,
      state: 'removed' as const,
    }));

  const disabled = local
    .filter((l) => l.status === 'disabled')
    .map((l) => ({
      localId: l.id,
      providerServiceId: l.providerServiceId || '',
      name: l.name,
      cost: money(l.cost),
      price: money(l.price),
      status: l.status,
      state: 'disabled' as const,
    }));

  return { classified, removed, disabled };
}
