'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
        HOA Water
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/events" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Events</Link>
        <Link href="/zones" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Zones</Link>
        <Link href="/controllers" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Controllers</Link>
        <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Admin</Link>
        <div className="w-px h-4 bg-gray-200" />
        {session?.user?.name && (
          <span className="text-sm text-gray-500">{session.user.name}</span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
