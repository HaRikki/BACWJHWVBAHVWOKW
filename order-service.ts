import { prisma } from './prisma';
import { SMMProviderClient, mapProviderStatus } from './smm-provider';
import { calculateCharge, toDecimal, gte } from './money';
import { applyBalanceChange } from './ledger';
import { Decimal } from '@prisma/client/runtime/library';

export interface PlaceOrderInput {
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
  idempotencyKey?: string;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  providerOrderId?: string | null;
  error?: string;
  code?: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { userId, serviceId, link, quantity, idempotencyKey } = input;

  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return {
        success: true,
        orderId: existing.id,
        status: existing.status,
        providerOrderId: existing.providerOrderId,
      };
    }
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      provider: true,
      mappings: {
        where: { status: 'active' },
        include: { provider: true },
        take: 1,
      },
    },
  });

  if (!service || service.status !== 'active') {
    return { success: false, error: 'Service not found or disabled', code: 'SERVICE_INVALID' };
  }

  if (quantity < service.min || quantity > service.max) {
    return {
      success: false,
      error: `Quantity must be between ${service.min} and ${service.max}`,
      code: 'QUANTITY_INVALID',
    };
  }

  if (!link || link.length < 5) {
    return { success: false, error: 'Invalid link', code: 'LINK_INVALID' };
  }

  const price = calculateCharge(service.price, quantity);
  const cost = calculateCharge(service.cost, quantity);
  const profit = price.sub(cost);

  let provider = service.provider;
  let providerServiceId = service.providerServiceId;
  const mapping = service.mappings[0];
  if (mapping?.provider?.status === 'active' && mapping.provider.userEnabled !== false) {
    provider = mapping.provider;
    providerServiceId = mapping.providerServiceId;
  }
  if (provider && (provider.status !== 'active' || (provider as any).userEnabled === false)) {
    provider = null;
  }

  let orderId = '';
  try {
    const order = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.status === 'disabled') {
        throw Object.assign(new Error('Account disabled'), { code: 'ACCOUNT_DISABLED' });
      }
      if (!gte(user.balance, price)) {
        throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT_BALANCE' });
      }

      const before = toDecimal(user.balance);
      const after = before.sub(price);

      await tx.user.update({ where: { id: userId }, data: { balance: after } });

      const created = await tx.order.create({
        data: {
          userId,
          serviceId,
          providerId: provider?.id || null,
          link,
          quantity,
          price,
          cost,
          profit,
          status: 'pending',
          idempotencyKey: idempotencyKey || null,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: price.negated(),
          balanceBefore: before,
          balanceAfter: after,
          paymentMethod: 'balance',
          status: 'paid',
          type: 'order_charge',
          providerTxnId: `order_${created.id}`,
          description: `Order charge for service ${service.name}`,
          paidAt: new Date(),
          metadata: JSON.stringify({ orderId: created.id, serviceId }),
        },
      });

      return created;
    });
    orderId = order.id;
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Order failed',
      code: e.code || 'ORDER_FAILED',
    };
  }

  if (provider && providerServiceId) {
    try {
      const client = new SMMProviderClient(provider.apiUrl, provider.apiKey);
      const providerResult = await client.addOrder(providerServiceId, link, quantity);

      if (providerResult.error || !providerResult.order) {
        await refundOrder(orderId, userId, price, providerResult.error || 'Provider rejected order');
        return {
          success: false,
          orderId,
          status: 'failed',
          error: providerResult.error || 'Provider rejected order',
          code: 'PROVIDER_REJECTED',
        };
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          providerOrderId: String(providerResult.order),
          status: 'processing',
        },
      });

      return {
        success: true,
        orderId,
        status: 'processing',
        providerOrderId: String(providerResult.order),
      };
    } catch (e: any) {
      await refundOrder(orderId, userId, price, e.message || 'Provider error');
      return {
        success: false,
        orderId,
        status: 'failed',
        error: e.message || 'Provider connection failed',
        code: 'PROVIDER_ERROR',
      };
    }
  }

  return { success: true, orderId, status: 'pending', providerOrderId: null };
}

async function refundOrder(orderId: string, userId: string, amount: Decimal, reason: string) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const before = toDecimal(user.balance);
    const after = before.add(amount);

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'failed', errorMessage: reason.slice(0, 500) },
    });
    await tx.user.update({ where: { id: userId }, data: { balance: after } });
    await tx.transaction.create({
      data: {
        userId,
        amount,
        balanceBefore: before,
        balanceAfter: after,
        paymentMethod: 'balance',
        status: 'paid',
        type: 'order_refund',
        providerTxnId: `refund_${orderId}`,
        description: `Refund: ${reason}`.slice(0, 255),
        paidAt: new Date(),
        metadata: JSON.stringify({ orderId, reason }),
      },
    });
  });
}

/** Partial refund based on remains */
export async function partialRefundOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'partial') return null;
  if (order.remains == null || order.remains <= 0) return null;

  // Refund proportional to remains
  const delivered = order.quantity - order.remains;
  if (delivered < 0) return null;
  const unitPrice = toDecimal(order.price).div(order.quantity);
  const refundAmt = unitPrice.mul(order.remains).toDecimalPlaces(6);

  if (refundAmt.lessThanOrEqualTo(0)) return null;

  // Check if already refunded
  const existing = await prisma.transaction.findFirst({
    where: { providerTxnId: `partial_refund_${orderId}`, type: 'partial_refund' },
  });
  if (existing) return existing;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: order.userId } });
    if (!user) return;
    const before = toDecimal(user.balance);
    const after = before.add(refundAmt);

    await tx.user.update({ where: { id: order.userId }, data: { balance: after } });
    await tx.transaction.create({
      data: {
        userId: order.userId,
        amount: refundAmt,
        balanceBefore: before,
        balanceAfter: after,
        paymentMethod: 'balance',
        status: 'paid',
        type: 'partial_refund',
        providerTxnId: `partial_refund_${orderId}`,
        description: `Partial refund for order ${orderId} (remains ${order.remains})`,
        paidAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'partial' },
    });
  });

  return true;
}

export async function syncOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { provider: true },
  });

  if (!order?.provider || !order.providerOrderId) return null;
  if (['completed', 'cancelled', 'failed', 'refunded'].includes(order.status)) return order;

  try {
    const client = new SMMProviderClient(order.provider.apiUrl, order.provider.apiKey);
    const st = await client.getStatus(order.providerOrderId);
    if (st.error) {
      await prisma.order.update({
        where: { id: orderId },
        data: { notes: String(st.error).slice(0, 300) },
      });
      return null;
    }

    const newStatus = mapProviderStatus(st.status);
    const startCount = st.start_count != null ? parseInt(String(st.start_count), 10) : order.startCount;
    const remains = st.remains != null ? parseInt(String(st.remains), 10) : order.remains;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        startCount: Number.isFinite(startCount as number) ? (startCount as number) : undefined,
        remains: Number.isFinite(remains as number) ? (remains as number) : undefined,
      },
    });

    if (newStatus === 'partial') {
      await partialRefundOrder(orderId);
    }

    if (newStatus === 'cancelled' || newStatus === 'failed') {
      // Full refund if not already charged-back
      const already = await prisma.transaction.findFirst({
        where: { providerTxnId: `refund_${orderId}` },
      });
      if (!already) {
        await refundOrder(orderId, order.userId, toDecimal(order.price), `Provider status: ${newStatus}`);
      }
    }

    return updated;
  } catch {
    return null;
  }
}

export async function syncPendingOrders(limit = 50) {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['pending', 'processing', 'partial'] },
      providerOrderId: { not: null },
      providerId: { not: null },
    },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });

  const results: string[] = [];
  for (const o of orders) {
    const updated = await syncOrderStatus(o.id);
    if (updated) results.push(updated.id);
  }
  return results;
}
