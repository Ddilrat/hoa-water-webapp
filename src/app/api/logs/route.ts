import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/logs?level=error&source=events/fetch&limit=100
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') ?? '200');

    let query = 'SELECT id, level, source, message, detail, created_at FROM app_logs WHERE 1=1';
    const params: any[] = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

// DELETE /api/logs — clear all logs
export async function DELETE() {
  try {
    await pool.query('DELETE FROM app_logs');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/logs error:', error);
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}
