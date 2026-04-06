import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { logger } from '@/lib/logger';

// PUT /api/zones/[id] — update flow rate
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { flow_rate, flow_rate_unit } = body;

    const [result]: any = await pool.query(
      'UPDATE zones SET flow_rate = ?, flow_rate_unit = ? WHERE id = ?',
      [flow_rate ?? null, flow_rate_unit ?? 'gal/min', params.id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    await logger.info('zones', `Flow rate updated for zone id=${params.id}`, { flow_rate, flow_rate_unit });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await logger.error('zones', `Failed to update zone id=${params.id}`, { error: error.message });
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
  }
}
