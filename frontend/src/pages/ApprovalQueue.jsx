import React, { useState, useEffect } from 'react';

const TYPE_LABELS = {
  inquiry_reply: '✉ Inquiry Reply',
  follow_up: '💌 Lead Follow-up',
  partnership_pitch: '🤝 Partnership Pitch',
  sequence_followup: '↗ Sequence Follow-up',
};

export default function ApprovalQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [edited, setEdited] = useState({});

  useEffect(() => {
    loadItems();
    const iv = setInterval(loadItems, 5000);
    return () => clearInterval(iv);
  }, [filter]);

  async function loadItems() {
    const r = await fetch(`/api/queue?status=${filter}`);
    const d = await r.json();
    setItems(d);
    setLoading(false);
  }

  async function approve(id) {
    setActionInProgress(id);
    const item = items.find(i => i.id === id);
    const url = edited[id] ? `/api/queue/${id}` : null;

    if (url) {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: edited[id].body, subject: edited[id].subject }),
      });
    }

    const r = await fetch(`/api/queue/${id}/approve`, { method: 'POST' });
    const data = await r.json();
    setActionInProgress(null);

    if (r.ok) {
      alert(data.gmail_configured
        ? 'Draft approved and created in Gmail! Go to Gmail to send it.'
        : 'Draft approved and queued for manual sending.'
      );
      setItems(prev => prev.filter(i => i.id !== id));
      setEdited(e => { const n = { ...e }; delete n[id]; return n; });
    } else {
      alert(`Error: ${data.error}`);
    }
  }

  async function reject(id) {
    if (!confirm('Reject this draft?')) return;
    setActionInProgress(id);
    await fetch(`/api/queue/${id}/reject`, { method: 'POST' });
    setActionInProgress(null);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function neverContact(id) {
    if (!confirm('Mark as Never Contact?')) return;
    setActionInProgress(id);
    await fetch(`/api/queue/${id}/never-contact`, { method: 'POST' });
    setActionInProgress(null);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-4xl">Approval Queue</h2>
        <p className="text-stone-500 text-sm mt-1">Review, edit, and approve drafts before they're sent.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['pending', 'approved', 'rejected', 'never_contact'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              filter === s
                ? 'bg-blume-600 text-white'
                : 'bg-stone-200 dark:bg-stone-700 hover:bg-stone-300'
            }`}
          >
            {s.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-12 text-stone-400">
          <p>No {filter} items.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const isOpen = expanded === item.id;
            const e = edited[item.id];
            return (
              <div key={item.id} className="card">
                <div
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="cursor-pointer flex items-start gap-4 mb-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge bg-blume-100 text-blume-700 dark:bg-blume-900 dark:text-blume-300">{TYPE_LABELS[item.type] || item.type}</span>
                      {item.lead_couple_name && <span className="text-sm text-stone-600">{item.lead_couple_name}</span>}
                      {item.prospect_name && <span className="text-sm text-stone-600">{item.prospect_name}</span>}
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400">{item.subject}</p>
                    <p className="text-xs text-stone-400 mt-1">To: {item.recipient_email || '(no email)'}</p>
                  </div>
                  <span className="text-stone-400 mt-1">{isOpen ? '▼' : '▶'}</span>
                </div>

                {isOpen && (
                  <div className="space-y-3 pt-3 border-t border-stone-200 dark:border-stone-700">
                    <div>
                      <label className="label">To</label>
                      <input
                        className="input"
                        type="email"
                        value={e?.recipient_email || item.recipient_email || ''}
                        onChange={ev => setEdited(ed => ({ ...ed, [item.id]: { ...ed[item.id], recipient_email: ev.target.value } }))}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div>
                      <label className="label">Subject</label>
                      <input
                        className="input"
                        value={e?.subject || item.subject || ''}
                        onChange={ev => setEdited(ed => ({ ...ed, [item.id]: { ...ed[item.id], subject: ev.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="label">Body</label>
                      <textarea
                        className="input font-mono text-xs"
                        rows={6}
                        value={e?.body || item.body || ''}
                        onChange={ev => setEdited(ed => ({ ...ed, [item.id]: { ...ed[item.id], body: ev.target.value } }))}
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => approve(item.id)}
                        disabled={actionInProgress === item.id}
                        className="btn-primary"
                      >
                        {actionInProgress === item.id ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => reject(item.id)}
                        disabled={actionInProgress === item.id}
                        className="btn-secondary"
                      >
                        ✗ Reject
                      </button>
                      <button
                        onClick={() => neverContact(item.id)}
                        disabled={actionInProgress === item.id}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        🚫 Never Contact
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
