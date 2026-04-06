import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getZoneRunEvents } from '@/lib/rachio';
import { logger } from '@/lib/logger';

// GET /api/events/sync?days=90
// Streams progress via Server-Sent Events
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30'), 1), 365);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const [controllers]: any = await pool.query(
          'SELECT id, name, device_id, api_key FROM controllers WHERE is_active = TRUE'
        );

        if (controllers.length === 0) {
          send({ type: 'done', message: 'No active controllers found.', totalInserted: 0 });
          controller.close();
          return;
        }

        send({ type: 'start', total: controllers.length, days });
        await logger.info('events/sync', `Manual sync started`, { days, controllers: controllers.length });

        const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
        let grandTotalInserted = 0;
        let grandTotalDuplicates = 0;

        for (let i = 0; i < controllers.length; i++) {
          const c = controllers[i];

          send({
            type: 'controller_start',
            index: i + 1,
            total: controllers.length,
            controller: c.name,
          });

          try {
            const events = await getZoneRunEvents(c.api_key, c.device_id, startTime);

            send({
              type: 'controller_fetched',
              controller: c.name,
              fetched: events.length,
            });

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
                    c.id,
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

            grandTotalInserted += inserted;
            grandTotalDuplicates += duplicates;

            send({
              type: 'controller_done',
              controller: c.name,
              inserted,
              duplicates,
            });

            await logger.info('events/sync', `Synced ${c.name}`, { inserted, duplicates });
          } catch (err: any) {
            send({ type: 'controller_error', controller: c.name, error: err.message });
            await logger.error('events/sync', `Failed to sync ${c.name}`, { error: err.message });
          }
        }

        await logger.info('events/sync', 'Manual sync completed', {
          days,
          totalInserted: grandTotalInserted,
          totalDuplicates: grandTotalDuplicates,
        });

        send({
          type: 'done',
          totalInserted: grandTotalInserted,
          totalDuplicates: grandTotalDuplicates,
        });
      } catch (err: any) {
        send({ type: 'error', error: err.message });
        await logger.error('events/sync', 'Manual sync failed', { error: err.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
