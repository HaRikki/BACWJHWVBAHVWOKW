import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

export async function authenticateApiKey(req: NextRequest) {
  // Support: Authorization: Bearer KEY  |  X-API-Key  |  body.key / query.key
  const authHeader = req.headers.get('authorization');
  const headerKey = req.headers.get('x-api-key');
  let key =
    headerKey ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

  if (!key) {
    try {
      const url = req.nextUrl;
      key = url.searchParams.get('key');
    } catch {
      /* ignore */
    }
  }

  if (!key) {
    return { error: NextResponse.json({ error: 'API key required' }, { status: 401 }) };
  }

  const user = await prisma.user.findFirst({
    where: { apiKey: key },
    select: {
      id: true,
      username: true,
      balance: true,
      status: true,
      apiEnabled: true,
      apiRateLimit: true,
      apiKey: true,
    },
  });

  if (!user || !user.apiKey) {
    return { error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }) };
  }
  if (user.status === 'disabled') {
    return { error: NextResponse.json({ error: 'Account disabled' }, { status: 403 }) };
  }
  if (!user.apiEnabled) {
    return { error: NextResponse.json({ error: 'API access disabled' }, { status: 403 }) };
  }

  // Simple rate limit: count requests in last 60 seconds
  const since = new Date(Date.now() - 60_000);
  const count = await prisma.apiRequestLog.count({
    where: { apiKey: key, createdAt: { gte: since } },
  });

  const limit = user.apiRateLimit || 60;
  if (count >= limit) {
    return {
      error: NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429 }
      ),
    };
  }

  // Log request
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
  await prisma.apiRequestLog.create({
    data: {
      apiKey: key,
      userId: user.id,
      endpoint: req.nextUrl.pathname,
      ip,
    },
  });

  return { user };
}
