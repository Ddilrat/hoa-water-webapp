'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface ZoneSyncResult {
  controller: string;
  inserted?: number;
  updated?: number;
  total?: number;
  error?: string;
}

interface CheckResult {
  controller: string;
  status: 'ok' | 'error';
  device_name?: string;
  http_status?: number;
  error?: string;
}

interface User {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface HistoricalSyncRow {
  controller: string;
  status: 'pending' | 'fetching' | 'done' | 'error';
  fetched?: number;
  inserted?: number;
  duplicates?: number;
  error?: string;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.name === 'admin';

  // Zone sync
  const [zoneSyncing, setZoneSyncing] = useState(false);
  const [zoneSyncResult, setZoneSyncResult] = useState<{ totalInserted: number; totalUpdated: number; results: ZoneSyncResult[] } | null>(null);

  // API check
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);

  // Historical event sync
  const [days, setDays] = useState(30);
  const [historicalSyncing, setHistoricalSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<HistoricalSyncRow[]>([]);
  const [syncSummary, setSyncSummary] = useState<{ totalInserted: number; totalDuplicates: number } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPasswordError(e.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  // User management
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userError, setUserError] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  async function loadUsers() {
    const res = await fetch('/api/users');
    if (res.ok) {
      setUsers(await res.json());
      setUsersLoaded(true);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newUserPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setNewUsername('');
      setNewUserPassword('');
      setShowUserForm(false);
      await loadUsers();
    } catch (e: any) {
      setUserError(e.message);
    } finally {
      setUserSaving(false);
    }
  }

  async function handleToggleUser(id: number, is_active: boolean) {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    await loadUsers();
  }

  async function handleDeleteUser(id: number, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  }

  async function handleApiCheck() {
    setChecking(true);
    setCheckResults(null);
    setError(null);
    try {
      const res = await fetch('/api/controllers/check', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      setCheckResults(data.results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleZoneSync() {
    setZoneSyncing(true);
    setZoneSyncResult(null);
    setError(null);
    try {
      const res = await fetch('/api/zones/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setZoneSyncResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setZoneSyncing(false);
    }
  }

  function handleHistoricalSync() {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setSyncLog([]);
    setSyncSummary(null);
    setError(null);
    setHistoricalSyncing(true);

    const es = new EventSource(`/api/events/sync?days=${days}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'start') {
        setSyncLog(Array.from({ length: msg.total }, (_, i) => ({ controller: `Controller ${i + 1}`, status: 'pending' })));
      }
      if (msg.type === 'controller_start') {
        setSyncLog((prev) => { const next = [...prev]; next[msg.index - 1] = { controller: msg.controller, status: 'fetching' }; return next; });
      }
      if (msg.type === 'controller_fetched') {
        setSyncLog((prev) => prev.map((row) => row.controller === msg.controller ? { ...row, fetched: msg.fetched } : row));
      }
      if (msg.type === 'controller_done') {
        setSyncLog((prev) => prev.map((row) => row.controller === msg.controller ? { ...row, status: 'done', inserted: msg.inserted, duplicates: msg.duplicates } : row));
      }
      if (msg.type === 'controller_error') {
        setSyncLog((prev) => prev.map((row) => row.controller === msg.controller ? { ...row, status: 'error', error: msg.error } : row));
      }
      if (msg.type === 'done') {
        setSyncSummary({ totalInserted: msg.totalInserted, totalDuplicates: msg.totalDuplicates });
        setHistoricalSyncing(false);
        es.close();
      }
      if (msg.type === 'error') {
        setError(msg.error);
        setHistoricalSyncing(false);
        es.close();
      }
    };

    es.onerror = () => {
      setError('Connection to sync stream lost.');
      setHistoricalSyncing(false);
      es.close();
    };
  }

  const STATUS_STYLES: Record<string, string> = {
    pending: 'text-gray-400',
    fetching: 'text-blue-500 animate-pulse',
    done: 'text-green-600',
    error: 'text-red-500',
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Dashboard</a>
          <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
        )}

        <div className="space-y-4">

          {/* Change Password */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Your Password</h2>
            <p className="text-sm text-gray-500 mb-4">Update your own login password.</p>
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm mb-3">Password changed successfully.</div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password (12+ chars)</label>
                <input type="password" required minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                <input type="password" required minLength={12} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={passwordSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
                {passwordSaving ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500 mt-1">Add, disable or remove users who can access this app.</p>
              </div>
              <div className="flex gap-2 ml-4">
                {!usersLoaded && (
                  <button onClick={loadUsers} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm whitespace-nowrap">
                    Load Users
                  </button>
                )}
                {usersLoaded && !showUserForm && (
                  <button onClick={() => setShowUserForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap">
                    + Add User
                  </button>
                )}
              </div>
            </div>

            {userError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{userError}</div>
            )}

            {showUserForm && (
              <form onSubmit={handleAddUser} className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                    <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password (12+ chars)</label>
                    <input type="password" required minLength={12} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={userSaving}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
                    {userSaving ? 'Saving...' : 'Save User'}
                  </button>
                  <button type="button" onClick={() => { setShowUserForm(false); setUserError(null); }}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {usersLoaded && users.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm px-3 py-2 rounded bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-medium">{u.username}</span>
                      {u.is_active
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-3">
                        <button onClick={() => handleToggleUser(u.id, !u.is_active)} className="text-blue-600 hover:underline text-xs">
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDeleteUser(u.id, u.username)} className="text-red-500 hover:underline text-xs">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application Logs */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Application Logs</h2>
                <p className="text-sm text-gray-500 mt-1">View API activity, fetch history, and errors.</p>
              </div>
              <a href="/logs" className="ml-4 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm whitespace-nowrap">
                View Logs
              </a>
            </div>
          </div>

          {/* API Connection Check */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Check API Connections</h2>
                <p className="text-sm text-gray-500 mt-1">Tests the Rachio API connection for each active controller and reports any errors.</p>
              </div>
              <button onClick={handleApiCheck} disabled={checking}
                className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm whitespace-nowrap">
                {checking ? 'Checking...' : 'Run Check'}
              </button>
            </div>
            {checkResults && (
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
                {checkResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-gray-50">
                    <span className="text-gray-700">{r.controller}</span>
                    {r.status === 'ok'
                      ? <span className="text-green-600">OK {r.device_name ? `— ${r.device_name}` : ''}</span>
                      : <span className="text-red-500">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zone Sync */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sync Zones from Rachio</h2>
                <p className="text-sm text-gray-500 mt-1">Imports zone names and numbers for all active controllers. Run when you add a new controller or zones change.</p>
              </div>
              <button onClick={handleZoneSync} disabled={zoneSyncing}
                className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm whitespace-nowrap">
                {zoneSyncing ? 'Syncing...' : 'Run Sync'}
              </button>
            </div>
            {zoneSyncResult && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm text-green-700 font-medium mb-3">Done — {zoneSyncResult.totalInserted} zones added, {zoneSyncResult.totalUpdated} updated.</p>
                <div className="space-y-1">
                  {zoneSyncResult.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-gray-50">
                      <span className="text-gray-700">{r.controller}</span>
                      {r.error ? <span className="text-red-500">{r.error}</span> : <span className="text-gray-400">{r.total} zones — {r.inserted} added, {r.updated} updated</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Historical Event Sync */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sync Historical Zone Events</h2>
                <p className="text-sm text-gray-500 mt-1">Fetches zone run events from Rachio for all active controllers over a selected time range.</p>
              </div>
              <button onClick={handleHistoricalSync} disabled={historicalSyncing}
                className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm whitespace-nowrap">
                {historicalSyncing ? 'Syncing...' : 'Run Sync'}
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Sync last <span className="text-blue-600 font-bold">{days}</span> days
              </label>
              <input type="range" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))}
                disabled={historicalSyncing} className="flex-1" />
              <span className="text-xs text-gray-400 whitespace-nowrap">1 – 365 days</span>
            </div>
            {syncLog.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
                {syncLog.map((row, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-gray-50">
                    <span className="text-gray-700">{row.controller}</span>
                    <span className={STATUS_STYLES[row.status]}>
                      {row.status === 'pending' && 'Waiting...'}
                      {row.status === 'fetching' && `Fetching${row.fetched !== undefined ? ` — ${row.fetched} events found` : '...'}`}
                      {row.status === 'done' && `Done — ${row.inserted} inserted, ${row.duplicates} duplicates`}
                      {row.status === 'error' && `Error: ${row.error}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {syncSummary && (
              <div className="mt-3 text-sm text-green-700 font-medium">
                Complete — {syncSummary.totalInserted} new events inserted, {syncSummary.totalDuplicates} duplicates skipped.
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
