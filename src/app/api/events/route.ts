import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/events?controller_id=1&start=2024-01-01&end=2024-01-31&limit=500
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const controllerId = searchParams.get('controller_id');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') ?? '500');

    let query = `
      SELECT
        ze.id,
        ze.zone_name,
        ze.duration_seconds,
        ze.end_time_datetime,
        c.name AS controller_name,
        c.id AS controller_id
      FROM zone_events ze
      JOIN controllers c ON ze.controller_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (controllerId) {
      query += ' AND ze.controller_id = ?';
      params.push(controllerId);
    }

    if (start) {
      query += ' AND ze.end_time_datetime >= ?';
      params.push(start);
    }

    if (end) {
      query += ' AND ze.end_time_datetime <= ?';
      params.push(end);
    }

    query += ' ORDER BY ze.end_time DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
