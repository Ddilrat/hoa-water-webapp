import pool from '@/lib/db';

type LogLevel = 'info' | 'warn' | 'error';

async function log(level: LogLevel, source: string, message: string, detail?: object) {
  try {
    await pool.query(
      'INSERT INTO app_logs (level, source, message, detail) VALUES (?, ?, ?, ?)',
      [level, source, message, detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    // Fail silently — don't let logging errors break the app
    console.error('Logger failed:', err);
  }
}

export const logger = {
  info: (source: string, message: string, detail?: object) => log('info', source, message, detail),
  warn: (source: string, message: string, detail?: object) => log('warn', source, message, detail),
  error: (source: string, message: string, detail?: object) => log('error', source, message, detail),
};
