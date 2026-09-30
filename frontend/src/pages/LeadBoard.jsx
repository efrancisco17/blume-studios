import React, { useState, useEffect } from 'react';

const STATUSES = ['New', 'Replied', 'Consult', 'Proposal', 'Booked', 'Lost'];
const STATUS_COLORS = {
  New: 'badge-new', Replied: 'badge-replied', Consult: 'badge-consult',
  Proposal: 'badge-proposal', Booked: 'badge-booked', Lost: 'badge-lost',
};

const SOURCES = ['Inquiry Form', 'Google', 'Instagram', 'Referral', 'The Knot', 'WeddingWire', 'Direct', 'Other'];

function LeadModal({ lead, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(lead || {
    couple_name: '', partner1_name: '', partner2_name: '', email: '', phone: '',
    wedding_date: '', venue: '', source: 'Direct', status: 'New', contract_value: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState(null);

  async function save() {
    setSaving(true);
    const method = form.id ? 'PATCH' : 'POST';
    const url = form.id ? `/api/leads/${form.id}` : '/api/leads';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onSave(data);
  }

  async function draftReply() {
    if (!form.id) return;
    setDrafting(true);
    const res = await fetch(`/api/leads/${form.id}/draft-reply`, { method: 'POST' });
    const data = await res.json();
    setDrafting(false);
    setDraftResult(data);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-stone-800 px-6 py-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h2 className="font-serif text-2xl">{form.id ? 'Edit Lead' : 'New Lead'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Couple Name</label>
              <input className="input" value={form.couple_name} onChange={e => setForm(f => ({ ...f, couple_name: e.target.value }))} placeholder="Alex & Jordan Smith" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Wedding Date</label>
              <input className="input" type="date" value={form.wedding_date || ''} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Venue</label>
              <input className="input" value={form.venue || ''} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={form.source || 'Direct'} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status || 'New'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Contract Value ($)</label>
              <input className="input" type="number" value={form.contract_value || ''} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {draftResult && (
            <div className="bg-blume-50 dark:bg-blume-950/20 border border-blume-200 rounded-xl p-4">
              <p className="text-xs font-medium text-blume-700 mb-2">Reply drafted → <a href="/queue" className="underline">view in Approval Queue</a></p>
              <pre className="text-xs text-stone-600 whitespace-pre-wrap font-sans">{draftResult.draft}</pre>
            </div>
          )}

          <div className="flex gap-3 flex-wrap pt-2">
            <button onClick={save} disabled={saving || !form.couple_name} className="btn-primary">
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Create Lead'}
            </button>
            {form.id && (
              <button onClick={draftReply} disabled={drafting} className="btn-secondary">
                {drafting ? 'Drafting…' : '✉ Draft Reply'}
              </button>
            )}
            {form.id && (
              <button onClick={() => onDelete(form.id)} className="ml-auto text-red-500 hover:text-red-700 text-sm">Delete</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeadBoard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | lead object | 'new'
  const [view, setView] = useState('board'); // 'board' | 'table'
  const [draftingAll, setDraftingAll] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    const r = await fetch('/api/leads');
    const d = await r.json();
    setLeads(d);
    setLoading(false);
  }

  async function handleSave(updated) {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === updated.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [updated, ...prev];
    });
    setModal(null);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this lead?')) return;
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    setLeads(prev => prev.filter(l => l.id !== id));
    setModal(null);
  }

  async function draftFollowUps() {
    setDraftingAll(true);
    const r = await fetch('/api/leads/stale/draft-followups', { method: 'POST' });
    const d = await r.json();
    setDraftingAll(false);
    alert(`${d.drafted} follow-up drafts created. Check the Approval Queue.`);
  }

  const staleCount = leads.filter(l =>
    !['Booked', 'Lost'].includes(l.status) &&
    (!l.last_contact_date || (Date.now() - new Date(l.last_contact_date).getTime()) / 86400000 >= 3)
  ).length;

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-4xl">Lead Pipeline</h2>
          <p className="text-stone-500 text-sm mt-1">{leads.length} leads total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {staleCount > 0 && (
            <button onClick={draftFollowUps} disabled={draftingAll} className="btn-secondary text-amber-600">
              {draftingAll ? 'Drafting…' : `⚡ Draft Follow-ups (${staleCount} stale)`}
            </button>
          )}
          <div className="flex rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
            <button onClick={() => setView('board')} className={`px-3 py-2 text-sm ${view === 'board' ? 'bg-blume-600 text-white' : 'hover:bg-stone-100'}`}>Board</button>
            <button onClick={() => setView('table')} className={`px-3 py-2 text-sm ${view === 'table' ? 'bg-blume-600 text-white' : 'hover:bg-stone-100'}`}>Table</button>
          </div>
          <button onClick={() => setModal('new')} className="btn-primary">+ New Lead</button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STATUSES.map(status => {
            const col = leads.filter(l => l.status === status);
            return (
              <div key={status} className="min-w-[160px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge ${STATUS_COLORS[status]}`}>{status}</span>
                  <span className="text-xs text-stone-400">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setModal(lead)}
                      className="card cursor-pointer hover:border-blume-300 transition-colors p-3"
                    >
                      <p className="font-medium text-sm leading-tight">{lead.couple_name}</p>
                      {lead.wedding_date && <p className="text-xs text-stone-400 mt-1">{lead.wedding_date}</p>}
                      {lead.venue && <p className="text-xs text-stone-400 truncate">{lead.venue}</p>}
                      {lead.contract_value && (
                        <p className="text-xs text-blume-600 font-medium mt-1">${Number(lead.contract_value).toLocaleString()}</p>
                      )}
                      {!lead.last_contact_date || (Date.now() - new Date(lead.last_contact_date).getTime()) / 86400000 >= 3 ? (
                        !['Booked', 'Lost'].includes(lead.status) && (
                          <span className="text-xs text-amber-500">⚠ needs follow-up</span>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-stone-400 border-b border-stone-200 dark:border-stone-700">
                {['Couple', 'Email', 'Date', 'Venue', 'Source', 'Status', 'Value', 'Last Contact'].map(h => (
                  <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
              {leads.map(l => (
                <tr key={l.id} onClick={() => setModal(l)} className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <td className="py-2.5 pr-4 font-medium">{l.couple_name}</td>
                  <td className="py-2.5 pr-4 text-stone-500">{l.email || '—'}</td>
                  <td className="py-2.5 pr-4 text-stone-500 font-mono text-xs">{l.wedding_date || '—'}</td>
                  <td className="py-2.5 pr-4 text-stone-500 max-w-[140px] truncate">{l.venue || '—'}</td>
                  <td className="py-2.5 pr-4 text-stone-400 text-xs">{l.source}</td>
                  <td className="py-2.5 pr-4"><span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{l.contract_value ? `$${Number(l.contract_value).toLocaleString()}` : '—'}</td>
                  <td className="py-2.5 text-stone-400 text-xs">{l.last_contact_date ? new Date(l.last_contact_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <LeadModal
          lead={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
