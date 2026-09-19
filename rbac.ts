import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';
import { NextResponse } from 'next/server';

export type Permission =
  | '*'
  | 'users.view' | 'users.edit'
  | 'orders.view' | 'orders.edit'
  | 'services.view' | 'services.edit'
  | 'providers.view' | 'providers.edit'
  | 'payments.view' | 'payments.edit'
  | 'transactions.view' | 'transactions.edit'
  | 'logs.view'
  | 'settings.view' | 'settings.edit'
  | 'coupons.view' | 'coupons.edit'
  | 'notifications.edit'
  | 'reports.view';

const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  superadmin: ['*'],
  admin: [
    'users.view', 'users.edit',
    'orders.view', 'orders.edit',
    'services.view', 'services.edit',
    'providers.view', 'providers.edit',
    'payments.view', 'payments.edit',
    'transactions.view', 'transactions.edit',
    'logs.view',
    'settings.view', 'settings.edit',
    'coupons.view', 'coupons.edit',
    'notifications.edit',
    'reports.view',
  ],
  manager: [
    'orders.view',
    'services.view',
    'transactions.view',
    'users.view',
  ],
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as any;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, status: true, username: true, email: true, balance: true },
  });
  if (!dbUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (dbUser.status === 'disabled') {
    return { error: NextResponse.json({ error: 'Account disabled' }, { status: 403 }) };
  }
  return { user: dbUser };
}

export async function getPermissions(role: string): Promise<Permission[]> {
  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (roleRow?.permissions) {
    try {
      return JSON.parse(roleRow.permissions) as Permission[];
    } catch {
      /* fallthrough */
    }
  }
  return DEFAULT_PERMISSIONS[role] || [];
}

export function hasPermission(perms: Permission[], required: Permission | Permission[]): boolean {
  if (perms.includes('*')) return true;
  const need = Array.isArray(required) ? required : [required];
  return need.some((p) => perms.includes(p));
}

export async function requirePermission(permission: Permission | Permission[]) {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const role = auth.user!.role;
  if (role === 'user') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const perms = await getPermissions(role);
  if (!hasPermission(perms, permission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: auth.user! };
}

export async function isMaintenanceMode(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: 'maintenance_mode' } });
  return s?.value === 'true';
}

export async function requireNotMaintenance(isAdmin = false) {
  if (isAdmin) return null;
  if (await isMaintenanceMode()) {
    return NextResponse.json(
      { error: 'Site is under maintenance', code: 'MAINTENANCE' },
      { status: 503 }
    );
  }
  return null;
}
