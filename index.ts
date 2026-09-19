/**
 * ABA Merchant API Integration (khmer-system.com)
 * Generate KHQR, check status, list transactions, mark credited
 */

export interface ABAConfig {
  baseUrl: string;
  apiKey: string;      // Profile Key
  merchantId: string;
}

export interface GenerateQRRequest {
  username: string;
  amount: number;
}

export interface GenerateQRResponse {
  ok: boolean;
  payment_id?: string;
  status?: string;
  qr_string?: string;
  qr_image?: string;
  card_image?: string;
  pay_url?: string;
  amount?: number;
  currency?: string;
  expires_at?: string;
  check_url?: string;
  error?: string;
  code?: string;
}

export interface CheckPaymentResponse {
  ok: boolean;
  status?: 'PENDING' | 'PAID' | 'EXPIRED' | string;
  paid?: boolean;
  raw_status?: string;
  amount?: number;
  error?: string;
  code?: string;
}

export interface TransactionItem {
  payment_id: string;
  username: string;
  amount: number;
  status: string;
  credited: boolean;
}

export class ABAMerchantProvider {
  private config: ABAConfig;

  constructor(config: ABAConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
      merchantId: config.merchantId,
    };
  }

  private async post<T>(endpoint: string, body: Record<string, any>): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        merchant_id: this.config.merchantId,
        ...body,
      }),
    });

    const data = await res.json();
    if (!res.ok && !data.ok) {
      throw new Error(data.error || data.code || `HTTP ${res.status}`);
    }
    return data as T;
  }

  /** Generate ABA KHQR payment */
  async generateQR(req: GenerateQRRequest): Promise<GenerateQRResponse> {
    try {
      return await this.post<GenerateQRResponse>('/aba-api/generate-qr', {
        username: req.username,
        amount: req.amount,
      });
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'QR generation failed',
        code: 'QR_GENERATION_FAILED',
      };
    }
  }

  /** Check payment status */
  async checkPayment(paymentId: string): Promise<CheckPaymentResponse> {
    try {
      return await this.post<CheckPaymentResponse>('/aba-api/check-payment', {
        payment_id: paymentId,
      });
    } catch (error: any) {
      return {
        ok: false,
        paid: false,
        error: error.message,
      };
    }
  }

  /** List transactions */
  async listTransactions(opts?: {
    status?: string;
    username?: string;
    limit?: number;
  }): Promise<{ ok: boolean; count?: number; transactions?: TransactionItem[]; error?: string }> {
    try {
      return await this.post('/aba-api/transactions', {
        status: opts?.status,
        username: opts?.username,
        limit: opts?.limit || 50,
      });
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /** Mark transaction as credited (exactly-once) */
  async markCredited(paymentId: string): Promise<{
    ok: boolean;
    payment_id?: string;
    credited?: boolean;
    already?: boolean;
    error?: string;
  }> {
    try {
      return await this.post('/aba-api/mark-credited', {
        payment_id: paymentId,
      });
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}

/** Create provider from DB settings or env */
export async function createABAFromSettings(prisma: any): Promise<ABAMerchantProvider | null> {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: ['aba_api_key', 'aba_merchant_id', 'aba_base_url', 'aba_enabled'],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  if (map.aba_enabled !== 'true') return null;

  const apiKey = map.aba_api_key || process.env.ABA_API_KEY;
  const merchantId = map.aba_merchant_id || process.env.ABA_MERCHANT_ID;
  const baseUrl = map.aba_base_url || process.env.ABA_API_URL || 'https://khmer-system.com';

  if (!apiKey || !merchantId) return null;

  return new ABAMerchantProvider({ baseUrl, apiKey, merchantId });
}

export function createABAFromEnv(): ABAMerchantProvider | null {
  const apiKey = process.env.ABA_API_KEY;
  const merchantId = process.env.ABA_MERCHANT_ID;
  const baseUrl = process.env.ABA_API_URL || 'https://khmer-system.com';

  if (!apiKey || !merchantId) return null;

  return new ABAMerchantProvider({ baseUrl, apiKey, merchantId });
}
