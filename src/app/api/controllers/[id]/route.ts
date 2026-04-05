import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT update a controller
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, device_id, api_key, is_active } = body;

    // Only update api_key if a new one was provided
    const query = api_key
      ? 'UPDATE controllers SET name = ?, device_id = ?, api_key = ?, is_active = ? WHERE id = ?'
      : 'UPDATE controllers SET name = ?, device_id = ?, is_active = ? WHERE id = ?';
    const values = api_key
      ? [name, device_id, api_key, is_active ?? true, params.id]
      : [name, device_id, is_active ?? true, params.id];

    const [result]: any = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'A controller with that device_id already exists' }, { status: 409 });
    }
    console.error('PUT /api/controllers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update controller' }, { status: 500 });
  }
}

// DELETE a controller
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const [result]: any = await pool.query(
      'DELETE FROM controllers WHERE id = ?',
      [params.id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/controllers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete controller' }, { status: 500 });
  }
}
