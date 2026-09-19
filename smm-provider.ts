/**
 * Standard SMM Panel API v2 client
 * Compatible with most reseller panels (action=services|add|status|balance|refill|cancel)
 */

export interface SMMService {
  service: string | number;
  name: string;
  type?: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean | string;
  cancel?: boolean | string;
}

export interface SMMOrderResult {
  order?: number | string;
  error?: string;
}

export interface SMMStatusResult {
  charge?: string | number;
  start_count?: string | number;
  status?: string;
  remains?: string | number;
  currency?: string;
  error?: string;
}

export interface SMMBalanceResult {
  balance?: string | number;
  currency?: string;
  error?: string;
}

export class SMMProviderClient {
  private apiUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiUrl: string, apiKey: string, timeoutMs = 30000) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private async request(params: Record<string, any>, retries = 2): Promise<any> {
    const body = new URLSearchParams({
      key: this.apiKey,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`Provider HTTP ${res.status}`);
        }

        const data = await res.json();
        return data;
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Provider request failed');
  }

  async getServices(): Promise<SMMService[]> {
    const data = await this.request({ action: 'services' });
    if (data?.error) throw new Error(String(data.error));
    return Array.isArray(data) ? data : [];
  }

  async getBalance(): Promise<SMMBalanceResult> {
    const data = await this.request({ action: 'balance' });
    if (data?.error) return { error: String(data.error) };
    return data;
  }

  async addOrder(
    service: string | number,
    link: string,
    quantity: number
  ): Promise<SMMOrderResult> {
    const data = await this.request({
      action: 'add',
      service: String(service),
      link,
      quantity: String(quantity),
    });
    return data;
  }

  async getStatus(orderId: string | number): Promise<SMMStatusResult> {
    return this.request({ action: 'status', order: String(orderId) });
  }

  async getMultiStatus(
    orderIds: (string | number)[]
  ): Promise<Record<string, SMMStatusResult>> {
    return this.request({
      action: 'status',
      orders: orderIds.map(String).join(','),
    });
  }

  async refill(orderId: string | number): Promise<{ refill?: string | number; error?: string }> {
    return this.request({ action: 'refill', order: String(orderId) });
  }

  async cancel(orderId: string | number): Promise<{ cancel?: string | number; error?: string }> {
    return this.request({ action: 'cancel', order: String(orderId) });
  }

  /** Test connection by fetching balance */
  async testConnection(): Promise<{ ok: boolean; balance?: string; error?: string }> {
    try {
      const bal = await this.getBalance();
      if (bal.error) return { ok: false, error: bal.error };
      return { ok: true, balance: String(bal.balance ?? '0') };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Connection failed' };
    }
  }
}

/** Normalize provider status strings to our internal status */
export function mapProviderStatus(raw?: string): string {
  if (!raw) return 'processing';
  const s = raw.toLowerCase().trim();
  if (['completed', 'complete', 'success', 'finished'].includes(s)) return 'completed';
  if (['pending', 'waiting'].includes(s)) return 'pending';
  if (['in progress', 'inprogress', 'processing', 'progress', 'working'].includes(s)) return 'processing';
  if (['partial'].includes(s)) return 'partial';
  if (['canceled', 'cancelled'].includes(s)) return 'cancelled';
  if (['failed', 'error', 'rejected'].includes(s)) return 'failed';
  return 'processing';
}
