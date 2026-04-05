'use client';

import { useEffect, useState } from 'react';

interface Controller {
  id: number;
  name: string;
}

interface ZoneEvent {
  id: number;
  controller_name: string;
  controller_id: number;
  zone_name: string | null;
  duration_seconds: number | null;
  end_time_datetime: string | null;
}

type Period = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'all';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

function getDateRange(period: Period): { start?: string; end?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
  const fmtEnd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 23:59:59`;

  if (period === 'today') {
    return { start: fmt(now), end: fmtEnd(now) };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: fmt(start), end: fmtEnd(now) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(start), end: fmtEnd(now) };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(start), end: fmtEnd(end) };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start: fmt(start), end: fmtEnd(now) };
  }
  return {};
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function EventsPage() {
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [events, setEvents] = useState<ZoneEvent[]>([]);
  const [selectedController, setSelectedController] = useState<string>('');
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadControllers() {
    const res = await fetch('/api/controllers');
    if (res.ok) setControllers(await res.json());
  }

  async function loadEvents(controllerId: string, p: Period) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (controllerId) params.set('controller_id', controllerId);
      const { start, end } = getDateRange(p);
      if (start) params.set('start', start);
      if (end) params.set('end', end);

      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error('Failed to load events');
      setEvents(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadControllers();
  }, []);

  useEffect(() => {
    loadEvents(selectedController, period);
  }, [selectedController, period]);

  const totalMinutes = Math.round(
    events.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0) / 60
  );

  function exportCsv() {
    const headers = ['Date & Time', 'Controller', 'Zone', 'Duration (seconds)'];
    const rows = events.map((e) => [
      e.end_time_datetime ?? '',
      e.controller_name,
      e.zone_name ?? '',
      e.duration_seconds ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zone-events-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Dashboard</a>
          <h1 className="text-3xl font-bold text-gray-900">Zone Events</h1>
        </div>
        {!loading && events.length > 0 && (
          <button
            onClick={exportCsv}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Export CSV
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-4">
          {/* Period buttons */}
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Controller filter */}
          <select
            value={selectedController}
            onChange={(e) => setSelectedController(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto"
          >
            <option value="">All controllers</option>
            {controllers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Summary stats */}
        {!loading && events.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{events.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Watering Time</p>
              <p className="text-2xl font-bold text-gray-900">{totalMinutes} min</p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No events found for this period.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date &amp; Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Controller</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Zone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.end_time_datetime ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{e.controller_name}</td>
                    <td className="px-4 py-3 text-gray-900">{e.zone_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDuration(e.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
