'use client';

import { useEffect, useState } from 'react';

interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  detail: any;
  created_at: string;
}

const LEVEL_STYLES = {
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

const SOURCES = ['all', 'events/fetch', 'controllers'];
const LEVELS = ['all', 'info', 'warn', 'error'];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState('all');
  const [source, setSource] = useState('all');
  const [clearing, setClearing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function loadLogs(l: string, s: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (l !== 'all') params.set('level', l);
      if (s !== 'all') params.set('source', s);
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error('Failed to load logs');
      setLogs(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(level, source); }, [level, source]);

  async function handleClear() {
    if (!confirm('Clear all logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a href="/" className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Dashboard</a>
            <h1 className="text-3xl font-bold text-gray-900">Application Logs</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadLogs(level, source)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Refresh
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-sm"
            >
              {clearing ? 'Clearing...' : 'Clear Logs'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Level:</label>
            <div className="flex gap-1">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    level === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Source:</label>
            <div className="flex gap-1">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    source === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <span className="text-sm text-gray-400 ml-auto">{logs.length} entries</span>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No log entries found.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Date &amp; Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{log.created_at}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${LEVEL_STYLES[log.level]}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.source}</td>
                      <td className="px-4 py-3 text-gray-900">{log.message}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {log.detail ? '▼ view' : '—'}
                      </td>
                    </tr>
                    {expandedId === log.id && log.detail && (
                      <tr key={`${log.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-xs text-gray-700 bg-gray-100 rounded p-3 overflow-x-auto">
                            {JSON.stringify(typeof log.detail === 'string' ? JSON.parse(log.detail) : log.detail, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
