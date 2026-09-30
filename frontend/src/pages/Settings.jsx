import React, { useState, useEffect } from 'react';

const SETTING_SECTIONS = [
  {
    title: 'Business Profile',
    fields: [
      { key: 'business_name', label: 'Business Name', type: 'text' },
      { key: 'owner_name', label: 'Your Name', type: 'text' },
      { key: 'location', label: 'Location (City, State)', type: 'text' },
      { key: 'mailing_address', label: 'Mailing Address', type: 'text' },
      { key: 'radius_miles', label: 'Service Radius (miles)', type: 'number' },
      { key: 'style', label: 'Photography Style', type: 'text' },
    ],
  },
  {
    title: 'Packages & Pricing',
    fields: [
      { key: 'package_6hr', label: 'Price: 6 Hours ($)', type: 'number' },
      { key: 'package_8hr', label: 'Price: 8 Hours ($)', type: 'number' },
    ],
  },
  {
    title: 'Voice & Tone',
    fields: [
      { key: 'voice_tone', label: 'Voice Tone', type: 'text', placeholder: 'e.g., Warm and genuine' },
      { key: 'sign_off', label: 'Email Sign-off', type: 'text', placeholder: 'e.g., Looking forward to capturing your day' },
    ],
  },
  {
    title: 'Scheduler',
    fields: [
      { key: 'scheduler_enabled', label: 'Enable Daily Routine', type: 'checkbox' },
      { key: 'scheduler_time', label: 'Run at (HH:MM)', type: 'time' },
    ],
  },
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [dncList, setDncList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oauthStatus, setOauthStatus] = useState(null);
  const [tab, setTab] = useState('settings');
  const [newDnc, setNewDnc] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()).then(d => setSettings(d)),
      fetch('/api/settings/do-not-contact').then(r => r.json()).then(d => setDncList(d)),
      fetch('/api/auth/status').then(r => r.json()).then(d => setOauthStatus(d)),
    ]).then(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    alert('Settings saved!');
  }

  async function connectGmail() {
    const r = await fetch('/api/auth/connect');
    const d = await r.json();
    window.open(d.url, 'blank');
  }

  async function addDnc() {
    if (!newDnc.trim()) return;
    await fetch('/api/settings/do-not-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newDnc }),
    });
    setNewDnc('');
    const r = await fetch('/api/settings/do-not-contact');
    const d = await r.json();
    setDncList(d);
  }

  async function removeDnc(id) {
    await fetch(`/api/settings/do-not-contact/${id}`, { method: 'DELETE' });
    setDncList(prev => prev.filter(x => x.id !== id));
  }

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-4xl">Settings</h2>
        <p className="text-stone-500 text-sm mt-1">Configure your account and integrations.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {['settings', 'integrations', 'dnc', 'logs'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t ? 'bg-blume-600 text-white' : 'bg-stone-200 dark:bg-stone-700'
            }`}
          >
            {t === 'settings' && 'Settings'}
            {t === 'integrations' && 'Integrations'}
            {t === 'dnc' && 'Do Not Contact'}
            {t === 'logs' && 'Activity Log'}
          </button>
        ))}
      </div>

      {tab === 'settings' && settings && (
        <div className="space-y-6">
          {SETTING_SECTIONS.map(section => (
            <div key={section.title} className="card">
              <h3 className="font-serif text-lg mb-4">{section.title}</h3>
              <div className="space-y-4">
                {section.fields.map(field => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    {field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings[field.key] === 'true'}
                          onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.checked ? 'true' : 'false' }))}
                          className="w-4 h-4 rounded"
                        />
                        Enable
                      </label>
                    ) : field.type === 'time' ? (
                      <input
                        type="time"
                        className="input"
                        value={settings[field.key] || '08:00'}
                        onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type={field.type}
                        className="input"
                        value={settings[field.key] || ''}
                        onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}

      {tab === 'integrations' && oauthStatus && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-serif text-lg mb-4">Google Integration</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Gmail & Calendar</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  oauthStatus.connected
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {oauthStatus.connected ? '✓ Connected' : '✗ Not Connected'}
                </span>
              </div>
              <p className="text-stone-500">
                {oauthStatus.connected
                  ? 'Your Gmail is connected. Drafts will be created automatically.'
                  : 'Connect your Gmail to enable automatic draft creation and calendar availability checks.'}
              </p>
              {!oauthStatus.connected && (
                <button onClick={connectGmail} className="btn-primary">
                  Connect Gmail
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-serif text-lg mb-4">API Keys Configured</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={oauthStatus.credentials_set ? '✓ text-green-600' : '✗ text-red-500'}>
                  {oauthStatus.credentials_set ? '✓' : '✗'}
                </span>
                Google OAuth Credentials
              </div>
              <div className="flex items-center gap-2">
                <span className={oauthStatus.anthropic_set ? '✓ text-green-600' : '✗ text-red-500'}>
                  {oauthStatus.anthropic_set ? '✓' : '✗'}
                </span>
                Anthropic API Key
              </div>
              <div className="flex items-center gap-2">
                <span className={oauthStatus.places_set ? '✓ text-green-600' : '✗ text-red-500'}>
                  {oauthStatus.places_set ? '✓' : '✗'}
                </span>
                Google Places API Key
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-3">Set these in your .env file. Restart the backend after changes.</p>
          </div>
        </div>
      )}

      {tab === 'dnc' && (
        <div className="card">
          <h3 className="font-serif text-lg mb-4">Do Not Contact List</h3>
          <div className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              type="email"
              value={newDnc}
              onChange={e => setNewDnc(e.target.value)}
              placeholder="email@example.com"
            />
            <button onClick={addDnc} className="btn-primary">Add</button>
          </div>
          {dncList.length === 0 ? (
            <p className="text-stone-400 text-sm">No entries.</p>
          ) : (
            <div className="space-y-2">
              {dncList.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm p-2 bg-stone-50 dark:bg-stone-800 rounded">
                  <div>
                    <p className="font-mono text-xs">{entry.email}</p>
                    {entry.reason && <p className="text-xs text-stone-500">{entry.reason}</p>}
                  </div>
                  <button
                    onClick={() => removeDnc(entry.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="card">
          <h3 className="font-serif text-lg mb-4">Recent Activity</h3>
          <p className="text-stone-400 text-sm">Activity logs show all actions taken by the system.</p>
          <p className="text-xs text-stone-400 mt-2">Check the database at <code>blume_studios.db</code> in the root folder for full logs.</p>
        </div>
      )}
    </div>
  );
}
