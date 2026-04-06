import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/zones?controller_id=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const controllerId = searchParams.get('controller_id');

    let query = `
      SELECT z.id, z.zone_name, z.zone_number, z.flow_rate, z.flow_rate_unit, z.is_active,
             c.name AS controller_name, c.id AS controller_id
      FROM zones z
      JOIN controllers c ON z.controller_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (controllerId) {
      query += ' AND z.controller_id = ?';
      params.push(controllerId);
    }

    query += ' ORDER BY c.name, z.zone_number';

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/zones error:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}
