import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/controllers/check — test Rachio API connection for each active controller
export async function POST() {
  try {
    const [controllers]: any = await pool.query(
      'SELECT id, name, device_id, api_key FROM controllers WHERE is_active = TRUE'
    );

    const results = await Promise.all(
      controllers.map(async (controller: any) => {
        try {
          const res = await fetch(
            `https://api.rach.io/1/public/device/${controller.device_id}`,
            {
              headers: {
                Authorization: `Bearer ${controller.api_key}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            return {
              controller: controller.name,
              status: 'ok',
              device_name: data.name ?? null,
              http_status: res.status,
            };
          } else {
            return {
              controller: controller.name,
              status: 'error',
              http_status: res.status,
              error: `HTTP ${res.status} ${res.statusText}`,
            };
          }
        } catch (err: any) {
          return {
            controller: controller.name,
            status: 'error',
            error: err.message,
          };
        }
      })
    );

    const failed = results.filter((r) => r.status === 'error').length;
    await logger.info('controllers/check', `API check complete — ${results.length - failed} ok, ${failed} failed`);

    return NextResponse.json({ results });
  } catch (error: any) {
    await logger.error('controllers/check', 'API check failed', { error: error.message });
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
