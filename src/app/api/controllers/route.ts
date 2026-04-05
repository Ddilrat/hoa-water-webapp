import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET all controllers
export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, device_id, is_active, created_at, updated_at FROM controllers ORDER BY name'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/controllers error:', error);
    return NextResponse.json({ error: 'Failed to fetch controllers' }, { status: 500 });
  }
}

// POST create a new controller
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, device_id, api_key } = body;

    if (!name || !device_id || !api_key) {
      return NextResponse.json(
        { error: 'name, device_id, and api_key are required' },
        { status: 400 }
      );
    }

    const [result]: any = await pool.query(
      'INSERT INTO controllers (name, device_id, api_key) VALUES (?, ?, ?)',
      [name, device_id, api_key]
    );

    return NextResponse.json({ id: result.insertId, name, device_id }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'A controller with that device_id already exists' }, { status: 409 });
    }
    console.error('POST /api/controllers error:', error);
    return NextResponse.json({ error: 'Failed to create controller' }, { status: 500 });
  }
}
