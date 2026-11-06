import { timingSafeEqual } from 'node:crypto';
import { loadConfig } from '@cm/core/config';
import { revalidateTag } from 'next/cache';
import { READ_MODEL_TAG } from '@/lib/readApi';

/**
 * The builder calls this after each nightly build so pages show the new day at
 * once instead of waiting for their hourly revalidation.
 */
export async function POST(request: Request): Promise<Response> {
  const token = loadConfig().web.revalidateToken;
  if (!token) return Response.json({ code: 'DISABLED', message: 'REVALIDATE_TOKEN is not set' }, { status: 404 });
  const header = request.headers.get('authorization') ?? '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ code: 'UNAUTHORIZED', message: 'missing or wrong bearer token' }, { status: 401 });
  }
  revalidateTag(READ_MODEL_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
