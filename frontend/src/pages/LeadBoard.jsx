import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../api';

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
    const res = await fetchAPI(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = res;
    setSaving(false);
    if (res) onSave(data);
  }

  async function draftReply() {
    if (!form.id) return;
    setDrafting(true);
    const res = await fetchAPI(`/api/leads/${form.id}/draft-reply`, { method: 'POST' });
    const data = res;
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
    const d = await fetchAPI('/api/leads');
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
    await fetchAPI(`/api/leads/${id}`, { method: 'DELETE' });
    setLeads(prev => prev.filter(l => l.id !== id));
    setModal(null);
  }

  async function
