import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function secondsToDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// GET /api/controllers/[id]/schedules
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const [rows]: any = await pool.query(
      'SELECT device_id, api_key FROM controllers WHERE id = ?',
      [params.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 });
    }

    const { device_id, api_key } = rows[0];

    const res = await fetch(`https://api.rach.io/1/public/device/${device_id}`, {
      headers: {
        Authorization: `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Rachio API error: ${res.status}` }, { status: res.status });
    }

    const device = await res.json();

    // Build a zoneId -> zone name lookup from the device zones
    const zoneMap: Record<string, string> = {};
    for (const z of device.zones ?? []) {
      zoneMap[z.id] = z.name;
    }

    const schedules = device.schedulerules ?? device.scheduleRules ?? device.schedules ?? [];

    const parsed = schedules.map((s: any) => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      type: s.scheduleJobTypes?.[0] ?? s.type ?? null,
      summary: s.summary ?? null,
      total_duration: s.totalDuration ? secondsToDuration(s.totalDuration) : null,
      cycle_soak: s.cycleSoak ?? false,
      cycle_soak_status: s.cycleSoakStatus ?? null,
      cycle_minutes: s.cycleMinutes ?? null,
      soak_minutes: s.soakMinutes ?? null,
      cycle_count: s.cycleCount ?? null,
      et_skip: s.etSkip ?? false,
      start_date: s.startDate ? new Date(s.startDate).toLocaleDateString() : null,
      operator: s.operator ?? null,
      zones: (s.zones ?? [])
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((z: any) => ({
          zone_name: zoneMap[z.zoneId] ?? 'Unknown',
          duration: z.duration ? secondsToDuration(z.duration) : null,
        })),
    }));

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('GET schedules error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}
