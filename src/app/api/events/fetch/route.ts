import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getZoneRunEvents } from '@/lib/rachio';
import { logger } from '@/lib/logger';

// POST /api/events/fetch
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    await logger.warn('events/fetch', 'Unauthorized fetch attempt — invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await logger.info('events/fetch', 'Rachio data fetch started');

  try {
    const [controllers]: any = await pool.query(
      'SELECT id, name, device_id, api_key FROM controllers WHERE is_active = TRUE'
    );

    if (controllers.length === 0) {
      await logger.warn('events/fetch', 'No active controllers found');
      return NextResponse.json({ message: 'No active controllers configured' }, { status: 200 });
    }

    let totalInserted = 0;
    let totalDuplicates = 0;
    const results = [];

    for (const controller of controllers) {
      try {
        const [latest]: any = await pool.query(
          'SELECT MAX(end_time) as latest FROM zone_events WHERE controller_id = ?',
          [controller.id]
        );

        const startTime = latest[0].latest ? latest[0].latest + 1 : undefined;

        const events = await getZoneRunEvents(
          controller.api_key,
          controller.device_id,
          startTime
        );

        let inserted = 0;
        let duplicates = 0;

        for (const event of events) {
          try {
            await pool.query(
              `INSERT INTO zone_events
                (event_id, controller_id, zone_name, duration_seconds, end_time, end_time_datetime, topic, summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                event.event_id,
                controller.id,
                event.zone_name,
                event.duration_seconds,
                event.end_time,
                event.end_time_datetime,
                event.topic,
                event.summary,
              ]
            );
            inserted++;
          } catch (err: any) {
            if (err.code === 'ER_DUP_ENTRY') {
              duplicates++;
            } else {
              throw err;
            }
          }
        }

        totalInserted += inserted;
        totalDuplicates += duplicates;
        results.push({ controller: controller.name, inserted, duplicates });

        await logger.info('events/fetch', `Fetched ${controller.name}`, {
          inserted,
          duplicates,
          total_fetched: events.length,
        });
      } catch (controllerError: any) {
        await logger.error('events/fetch', `Failed to fetch controller: ${controller.name}`, {
          error: controllerError.message,
          device_id: controller.device_id,
        });
        results.push({ controller: controller.name, error: controllerError.message });
      }
    }

    await logger.info('events/fetch', 'Rachio data fetch completed', {
      totalInserted,
      totalDuplicates,
      controllers: controllers.length,
    });

    return NextResponse.json({ totalInserted, totalDuplicates, results });
  } catch (error: any) {
    await logger.error('events/fetch', 'Rachio data fetch failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
