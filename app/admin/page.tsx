'use client';

import { useCallback, useEffect, useState } from 'react';
import { Announcement } from '@/lib/data';
import type { SyncHealth } from '@/lib/neverskip/sync-health';

const TOKEN_KEY = 'admin_token';

type HealthResponse = { ok: boolean; health?: SyncHealth; error?: string };

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [checking, setChecking] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState<'info' | 'warning' | 'holiday' | 'important'>('info');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [healthResp, setHealthResp] = useState<HealthResponse | null>(null);
  const isAuthenticated = token != null;

  /** Returns false only when the server rejects the token. */
  const fetchHealth = useCallback(async (candidate: string): Promise<boolean> => {
    const res = await fetch('/api/admin/sync-health', {
      headers: { 'x-admin-token': candidate },
      cache: 'no-store',
    });
    if (res.status === 401) return false;
    setHealthResp((await res.json().catch(() => ({ ok: false, error: 'bad response' }))) as HealthResponse);
    return true;
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    void fetchHealth(stored).then((ok) => {
      if (ok) setToken(stored);
      else sessionStorage.removeItem(TOKEN_KEY);
    });
  }, [fetchHealth]);

  // Load announcements when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const stored = localStorage.getItem('announcements');
    if (stored) {
      setAnnouncements(JSON.parse(stored));
    }

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setNewExpiresAt(nextWeek.toISOString().split('T')[0]);
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      if (await fetchHealth(password)) {
        setToken(password);
        sessionStorage.setItem(TOKEN_KEY, password);
        setPasswordError('');
      } else {
        setPasswordError('Incorrect admin token');
      }
    } catch {
      setPasswordError('Could not reach server');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setHealthResp(null);
    sessionStorage.removeItem(TOKEN_KEY);
  };

  const saveAnnouncements = (updated: Announcement[]) => {
    setAnnouncements(updated);
    localStorage.setItem('announcements', JSON.stringify(updated));
  };

  const addAnnouncement = () => {
    if (!newMessage.trim()) return;

    const newAnnouncement: Announcement = {
      id: Date.now(),
      message: newMessage,
      type: newType,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: newExpiresAt,
    };

    saveAnnouncements([...announcements, newAnnouncement]);
    setNewMessage('');
  };

  const deleteAnnouncement = (id: number) => {
    saveAnnouncements(announcements.filter((a) => a.id !== id));
  };

  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-amber-100 text-amber-800',
    holiday: 'bg-orange-100 text-orange-800',
    important: 'bg-red-100 text-red-800',
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-sm text-gray-500 mt-1">Enter admin token to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin token"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 text-center text-lg"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2 text-center">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={checking}
              className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin panel (authenticated)
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Manage announcements and notifications</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"
        >
          <span>Logout</span>
          <span>🚪</span>
        </button>
      </div>

      {/* Sync diagnostics (admin only — not shown on parent pages) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">NeverSkip sync (admin)</h2>
        {!healthResp ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !healthResp.health ? (
          <p className="text-sm text-red-700">Health unavailable: {healthResp.error || 'unknown error'}</p>
        ) : (
          <SyncHealthPanel health={healthResp.health} ok={healthResp.ok} onRefresh={() => token && void fetchHealth(token)} />
        )}
      </div>

      {/* Add New Announcement */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Announcement</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="e.g., Tomorrow is Teachers' Day - Wear colorful dress"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as typeof newType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="info">Info (Blue)</option>
                <option value="warning">Warning (Yellow)</option>
                <option value="holiday">Holiday (Orange)</option>
                <option value="important">Important (Red)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires On
              </label>
              <input
                type="date"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>

          <button
            onClick={addAnnouncement}
            className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            Add Announcement
          </button>
        </div>
      </div>

      {/* Current Announcements */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Current Announcements ({announcements.length})
        </h2>

        {announcements.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No announcements yet. Add one above!
          </p>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${typeColors[announcement.type]}`}
                    >
                      {announcement.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      Expires: {announcement.expiresAt}
                    </span>
                  </div>
                  <p className="text-gray-800">{announcement.message}</p>
                </div>
                <button
                  onClick={() => deleteAnnouncement(announcement.id)}
                  className="ml-4 text-red-500 hover:text-red-700 p-2"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-800 mb-2">How it works</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Announcements are stored in your browser (localStorage)</li>
          <li>• They appear as a banner at the top of the website</li>
          <li>• Expired announcements automatically disappear</li>
          <li>• Multiple announcements rotate every 5 seconds</li>
        </ul>
      </div>

      <div className="mt-4 bg-amber-50 rounded-xl border border-amber-200 p-4">
        <h3 className="font-semibold text-amber-800 mb-1">Admin token</h3>
        <p className="text-sm text-amber-700">
          Checked on the server against the <code className="bg-amber-100 px-1 rounded">ADMIN_HEALTH_TOKEN</code>{' '}
          environment variable. Rotate it in Vercel project settings.
        </p>
      </div>
    </div>
  );
}

function SyncHealthPanel({
  health,
  ok,
  onRefresh,
}: {
  health: SyncHealth;
  ok: boolean;
  onRefresh: () => void;
}) {
  const sources = [
    { label: 'Homework', s: health.homework },
    { label: 'Notices', s: health.notices },
    { label: 'JOL', s: health.jol },
  ];
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p>
        Status: <span className={`font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>{health.status}</span>
        {health.issues.length > 0 ? <span className="ml-2 text-red-700">({health.issues.join(', ')})</span> : null}
        <button onClick={onRefresh} className="ml-3 text-xs text-orange-600 hover:underline">
          Refresh
        </button>
      </p>
      <p>Auth: {health.authStatus}</p>
      <p>DB write: {health.databaseWriteStatus}</p>
      <p>Planner / newsletter: {health.plannerStatus || '—'}</p>
      <p>Last COMPLETE sync: {fmt(health.lastSuccessAt)}</p>
      <p>Last data write (complete or partial): {fmt(health.lastDataWriteAt)}</p>
      <p>Last attempt: {fmt(health.lastAttemptAt)}</p>
      <p>Last failure: {fmt(health.lastFailureAt)}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {sources.map(({ label, s }) => (
          <div key={label} className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold">{label}</p>
            <p>Status: {s?.status || '—'}</p>
            <p>
              Source/unique/stored: {s?.sourceCount ?? '—'} / {s?.uniqueCount ?? '—'} / {s?.storedCount ?? '—'}
            </p>
            <p>Latest: {s?.latestSourceDate || '—'}</p>
          </div>
        ))}
      </div>
      {health.failureReason ? <p className="text-amber-800 break-words">{health.failureReason}</p> : null}
      <p className="text-xs text-gray-500">Parent pages never show these diagnostics.</p>
    </div>
  );
}
