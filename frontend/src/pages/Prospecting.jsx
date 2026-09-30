import React, { useState, useEffect } from 'react';

const FIT_BADGES = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-stone-100 text-stone-600',
};

function getFitLevel(score) {
  return score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
}

export default function Prospecting() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState('list');
  const [progress, setProgress] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchForm, setSearchForm] = useState({
    location: 'Philadelphia, PA',
    radius_miles: '50',
    types: ['venue', 'planner', 'coordinator'],
  });

  useEffect(() => {
    loadProspects();
  }, []);

  async function loadProspects() {
    const r = await fetch('/api/prospects');
    const d = await r.json();
    setProspects(d);
    setLoading(false);
  }

  async function search() {
    setSearching(true);
    setProgress(null);
    setMessages([]);

    const eventSource = new EventSource(
      `/api/prospects/search?location=${encodeURIComponent(searchForm.location)}&radius_miles=${searchForm.radius_miles}&types=${searchForm.types.join(',')}`
    );

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'complete') {
          eventSource.close();
          setSearching(false);
          setMessages(prev => [...prev, { type: 'complete', message: `Search complete! Found ${data.saved} new prospects.` }]);
          loadProspects();
        } else {
          setProgress(data);
          setMessages(prev => [...prev, data]);
        }
      } catch (err) {
        console.error('Error parsing EventSource message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      eventSource.close();
      setSearching(false);
      setMessages(prev => [...prev, { type: 'error', message: 'Search failed. Check console for details.' }]);
    };
  }

  async function draftPitches(prospectIds) {
    if (!prospectIds.length) return alert('Select at least one prospect');
    const r = await fetch('/api/prospects/draft-pitches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_ids: prospectIds }),
    });
    const d = await r.json();
    alert(`${d.drafted} pitches drafted. Check the Approval Queue.`);
    loadProspects();
  }

  async function toggleSelected(id) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  const [selected, setSelected] = useState(new Set());

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;

  const byStatus = {
    New: prospects.filter(p => p.status === 'New'),
    Contacted: prospects.filter(p => p.status === 'Contacted'),
    Replied: prospects.filter(p => p.status === 'Replied'),
    Rejected: prospects.filter(p => p.status === 'Rejected'),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-4xl">Prospecting Agent</h2>
        <p className="text-stone-500 text-sm mt-1">Find and pitch wedding professionals in your area.</p>
      </div>

      {/* Search panel */}
      <div className="card space-y-4">
        <h3 className="font-serif text-lg">Research new prospects</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Area</label>
            <input
              className="input"
              value={searchForm.location}
              onChange={e => setSearchForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Radius (miles)</label>
            <input
              className="input"
              type="number"
              value={searchForm.radius_miles}
              onChange={e => setSearchForm(f => ({ ...f, radius_miles: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label">Types</label>
          <div className="flex gap-3 flex-wrap">
            {['venue', 'planner', 'coordinator', 'florist'].map(type => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={searchForm.types.includes(type)}
                  onChange={e => setSearchForm(f => ({
                    ...f,
                    types: e.target.checked ? [...f.types, type] : f.types.filter(t => t !== type),
                  }))}
                  className="w-4 h-4 rounded"
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {messages.length > 0 && (
          <div className="card bg-gray-50 space-y-2 text-sm max-h-64 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className="text-gray-700">
                {msg.type === 'status' && <span className="text-gray-600">ℹ {msg.message}</span>}
                {msg.type === 'progress' && <span className="text-gray-600">⋯ Processing {msg.name} ({msg.current}/{msg.total})</span>}
                {msg.type === 'warning' && <span className="text-gray-600">⚠ {msg.message}</span>}
                {msg.type === 'complete' && <span className="text-gray-700 font-medium">✓ {msg.message}</span>}
                {msg.type === 'error' && <span className="text-gray-700">✗ {msg.message}</span>}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={search}
          disabled={searching || !searchForm.location}
          className="btn-primary"
        >
          {searching ? '🔍 Searching…' : '🔍 Start Research'}
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {['list', 'board'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-2 rounded-lg text-sm ${
              view === v ? 'bg-blume-600 text-white' : 'bg-stone-200 dark:bg-stone-700'
            }`}
          >
            {v === 'list' ? 'List' : 'Board'}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="bg-blume-50 dark:bg-blume-950/20 border border-blume-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm">{selected.size} selected</p>
          <button onClick={() => draftPitches(Array.from(selected))} className="btn-primary">
            Draft Pitches for Selected
          </button>
        </div>
      )}

      {view === 'board' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(byStatus).map(([status, items]) => (
            <div key={status}>
              <div className="mb-3">
                <span className="font-medium text-sm">{status}</span>
                <span className="ml-2 text-xs text-stone-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(p => (
                  <div
                    key={p.id}
                    onClick={() => toggleSelected(p.id)}
                    className={`card cursor-pointer p-3 ${
                      selected.has(p.id) ? 'border-blume-400 bg-blume-50 dark:bg-blume-950/20' : 'hover:border-blume-300'
                    }`}
                  >
                    {selected.has(p.id) && <span className="text-blume-600 text-sm">✓ </span>}
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-stone-400 mt-1">{p.type}</p>
                    {p.fit_score && (
                      <span className={`badge ${FIT_BADGES[getFitLevel(p.fit_score)]} text-xs mt-2`}>
                        Fit: {p.fit_score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-stone-400 border-b border-stone-200 dark:border-stone-700">
                <th className="pb-3 pr-4 w-4"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(prospects.map(p => p.id)) : new Set())} /></th>
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">City</th>
                <th className="pb-3 pr-4">Fit</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
              {prospects.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="w-4 h-4 rounded"
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium">{p.name}</td>
                  <td className="py-3 pr-4 text-xs">{p.type}</td>
                  <td className="py-3 pr-4 text-stone-500">{p.city}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${FIT_BADGES[getFitLevel(p.fit_score)]} text-xs`}>
                      {p.fit_score}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-stone-500">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
