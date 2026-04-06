import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'current_password and new_password are required' }, { status: 400 });
    }

    if (new_password.length < 12) {
      return NextResponse.json({ error: 'New password must be at least 12 characters' }, { status: 400 });
    }

    const [rows]: any = await pool.query(
      'SELECT id, password_hash FROM users WHERE username = ? AND is_active = TRUE',
      [session.user.name]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = rows[0];
    const currentMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!currentMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    await logger.info('users', `Password changed for ${session.user.name}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await logger.error('users', 'Password change failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
