import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

// PUT update user (password or active status)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { password, is_active } = body;

    if (password) {
      if (password.length < 12) {
        return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
      }
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET password_hash = ?, is_active = ? WHERE id = ?',
        [hash, is_active ?? true, params.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET is_active = ? WHERE id = ?',
        [is_active ?? true, params.id]
      );
    }

    await logger.info('users', `User updated id=${params.id}`, { is_active });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [params.id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await logger.info('users', `User deleted id=${params.id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
