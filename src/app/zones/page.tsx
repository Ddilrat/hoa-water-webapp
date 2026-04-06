'use client';

import { useEffect, useState } from 'react';

interface Zone {
  id: number;
  zone_name: string;
  zone_number: number | null;
  flow_rate: number | null;
  flow_rate_unit: string;
  is_active: boolean;
  controller_name: string;
  controller_id: number;
}

interface Controller {
  id: number;
  name: string;
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [selectedController, setSelectedController] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFlow, setEditFlow] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('gal/min');
  const [saving, setSaving] = useState(false);

  async function loadControllers() {
    const res = await fetch('/api/controllers');
    if (res.ok) setControllers(await res.json());
  }

  async function loadZones(controllerId?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (controllerId) params.set('controller_id', controllerId);
      const res = await fetch(`/api/zones?${params}`);
      if (!res.ok) throw new Error('Failed to load zones');
      setZones(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadControllers();
    loadZones();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch('/api/zones/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(`Done — ${data.totalInserted} zones added, ${data.totalUpdated} updated.`);
      await loadZones(selectedController || undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setEditFlow(zone.flow_rate !== null ? String(zone.flow_rate) : '');
    setEditUnit(zone.flow_rate_unit ?? 'gal/min');
  }

  async function saveFlowRate(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/zones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_rate: editFlow ? parseFloat(editFlow) : null, flow_rate_unit: editUnit }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingId(null);
      await loadZones(selectedController || undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Group zones by controller
  const grouped = zones.reduce((acc, zone) => {
    const key = zone.controller_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(zone);
    return acc;
  }, {} as Record<string, Zone[]>);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a href="/" className="text-sm text-blue-600 hover:underline mb-1 block">&larr; Dashboard</a>
            <h1 className="text-3xl font-bold text-gray-900">Zones</h1>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? 'Syncing from Rachio...' : 'Sync from Rachio'}
          </button>
        </div>

        {syncResult && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-6">
            {syncResult}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Controller filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by controller:</label>
          <select
            value={selectedController}
            onChange={(e) => {
              setSelectedController(e.target.value);
              loadZones(e.target.value || undefined);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All controllers</option>
            {controllers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-400 ml-auto">{zones.length} zones</span>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : zones.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No zones found. Click &quot;Sync from Rachio&quot; to import zone data.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([controllerName, controllerZones]) => (
              <div key={controllerName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">{controllerName}</h2>
                  <p className="text-xs text-gray-400">{controllerZones.length} zones</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Zone Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Flow Rate</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {controllerZones.map((zone) => (
                      <tr key={zone.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{zone.zone_number ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{zone.zone_name}</td>
                        <td className="px-4 py-3">
                          {editingId === zone.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editFlow}
                                onChange={(e) => setEditFlow(e.target.value)}
                                placeholder="0.00"
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={editUnit}
                                onChange={(e) => setEditUnit(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="gal/min">gal/min</option>
                                <option value="L/min">L/min</option>
                              </select>
                              <button
                                onClick={() => saveFlowRate(zone.id)}
                                disabled={saving}
                                className="text-blue-600 hover:underline text-sm disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-gray-400 hover:underline text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-700">
                              {zone.flow_rate !== null ? `${zone.flow_rate} ${zone.flow_rate_unit}` : <span className="text-gray-400">Not set</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {zone.is_active ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingId !== zone.id && (
                            <button
                              onClick={() => startEdit(zone)}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Edit flow rate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
