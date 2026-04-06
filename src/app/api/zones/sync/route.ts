import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getDeviceZones } from '@/lib/rachio';
import { logger } from '@/lib/logger';

// POST /api/zones/sync — fetch zones from Rachio and upsert into zones table
export async function POST() {
  try {
    const [controllers]: any = await pool.query(
      'SELECT id, name, device_id, api_key FROM controllers WHERE is_active = TRUE'
    );

    if (controllers.length === 0) {
      return NextResponse.json({ message: 'No active controllers' }, { status: 200 });
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    const results = [];

    for (const controller of controllers) {
      try {
        const zones = await getDeviceZones(controller.api_key, controller.device_id);

        let inserted = 0;
        let updated = 0;

        for (const zone of zones) {
          // Upsert on rachio_zone_id — unique Rachio UUID per zone
          const [existing]: any = await pool.query(
            'SELECT id FROM zones WHERE rachio_zone_id = ?',
            [zone.rachio_zone_id]
          );

          if (existing.length > 0) {
            await pool.query(
              'UPDATE zones SET zone_name = ?, zone_number = ?, is_active = ?, controller_id = ? WHERE rachio_zone_id = ?',
              [zone.zone_name, zone.zone_number, zone.enabled, controller.id, zone.rachio_zone_id]
            );
            updated++;
          } else {
            await pool.query(
              'INSERT INTO zones (controller_id, rachio_zone_id, zone_name, zone_number, is_active) VALUES (?, ?, ?, ?, ?)',
              [controller.id, zone.rachio_zone_id, zone.zone_name, zone.zone_number, zone.enabled]
            );
            inserted++;
          }
        }

        totalInserted += inserted;
        totalUpdated += updated;
        results.push({ controller: controller.name, inserted, updated, total: zones.length });
        await logger.info('zones/sync', `Synced zones for ${controller.name}`, { inserted, updated });
      } catch (err: any) {
        await logger.error('zones/sync', `Failed to sync zones for ${controller.name}`, { error: err.message });
        results.push({ controller: controller.name, error: err.message });
      }
    }

    return NextResponse.json({ totalInserted, totalUpdated, results });
  } catch (error: any) {
    await logger.error('zones/sync', 'Zone sync failed', { error: error.message });
    return NextResponse.json({ error: 'Zone sync failed' }, { status: 500 });
  }
}
