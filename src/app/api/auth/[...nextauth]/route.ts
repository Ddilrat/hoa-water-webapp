import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const [rows]: any = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE username = ? AND is_active = TRUE',
            [credentials.username]
          );

          if (rows.length === 0) return null;

          const user = rows[0];
          const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
          if (!passwordMatch) return null;

          return { id: String(user.id), name: user.username };
        } catch (err) {
          console.error('Auth error:', err);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
