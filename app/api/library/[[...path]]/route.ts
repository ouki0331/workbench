import { env } from 'cloudflare:workers';
import { createCloudLibraryRoute } from '@/lib/cloud-library';

const handle = createCloudLibraryRoute(
  env as unknown as { DB?: D1Database; FILES?: R2Bucket },
);

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PATCH = handle;
