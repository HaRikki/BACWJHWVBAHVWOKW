import { prisma } from './prisma';
import { toDecimal, MoneyInput } from './money';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

export type LedgerType =
  | 'deposit'
  | 'order_charge'
  | 'refund'
  | 'partial_refund'
  | 'manual_credit'
  | 'manual_debit'
  | 'bonus'
  | 'adjustment'
  | 'order_refund';

type TxClient = Prisma.TransactionClient;

/**
 * Atomic balance change with full ledger entry (balance before/after).
 * Positive amount = credit, negative = debit.
 */
export async function applyBalanceChange(
  opts: {
    userId: string;
    amount: MoneyInput;
    type: LedgerType;
    paymentMethod: string;
    providerTxnId?: string | null;
    description?: string;
    adminId?: string;
    metadata?: Record<string, unknown>;
    status?: string;
  },
  externalTx?: TxClient
) {
  const amount = toDecimal(opts.amount);
  const run = async (tx: TxClient) => {
    const user = await tx.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new Error('User not found');

    const before = toDecimal(user.balance);
    const after = before.add(amount);

    if (after.lessThan(0)) {
      throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT_BALANCE' });
    }

    await tx.user.update({
      where: { id: opts.userId },
      data: { balance: after },
    });

    const txn = await tx.transaction.create({
      data: {
        userId: opts.userId,
        amount,
        balanceBefore: before,
        balanceAfter: after,
        paymentMethod: opts.paymentMethod,
        providerTxnId: opts.providerTxnId || null,
        status: opts.status || 'paid',
        type: opts.type,
        description: opts.description || null,
        adminId: opts.adminId || null,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
        paidAt: opts.status === 'pending' ? null : new Date(),
        creditedAt: amount.greaterThan(0) && opts.status !== 'pending' ? new Date() : null,
      },
    });

    return { txn, balanceBefore: before, balanceAfter: after };
  };

  if (externalTx) return run(externalTx);
  return prisma.$transaction(run);
}

/** Credit deposit after payment verification (idempotent via providerTxnId unique) */
export async function creditDeposit(opts: {
  userId: string;
  amount: MoneyInput;
  paymentMethod: 'aba' | 'bakong';
  providerTxnId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  // Find existing pending txn
  const existing = await prisma.transaction.findFirst({
    where: {
      providerTxnId: opts.providerTxnId,
      paymentMethod: opts.paymentMethod,
    },
  });

  if (existing?.status === 'paid') {
    return { alreadyCredited: true, transactionId: existing.id };
  }

  const amount = toDecimal(opts.amount);

  return prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.status === 'paid') {
        return { alreadyCredited: true, transactionId: existing.id };
      }
      const user = await tx.user.findUnique({ where: { id: opts.userId } });
      if (!user) throw new Error('User not found');
      const before = toDecimal(user.balance);
      const after = before.add(amount);

      await tx.user.update({ where: { id: opts.userId }, data: { balance: after } });
      await tx.transaction.update({
        where: { id: existing.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          creditedAt: new Date(),
          balanceBefore: before,
          balanceAfter: after,
          description: opts.description || existing.description,
        },
      });
      return { alreadyCredited: false, transactionId: existing.id, balanceAfter: after };
    }

    // Create new paid deposit
    const user = await tx.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new Error('User not found');
    const before = toDecimal(user.balance);
    const after = before.add(amount);

    await tx.user.update({ where: { id: opts.userId }, data: { balance: after } });
    const txn = await tx.transaction.create({
      data: {
        userId: opts.userId,
        amount,
        balanceBefore: before,
        balanceAfter: after,
        paymentMethod: opts.paymentMethod,
        providerTxnId: opts.providerTxnId,
        status: 'paid',
        type: 'deposit',
        description: opts.description || `${opts.paymentMethod.toUpperCase()} deposit`,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
        paidAt: new Date(),
        creditedAt: new Date(),
      },
    });
    return { alreadyCredited: false, transactionId: txn.id, balanceAfter: after };
  });
}
