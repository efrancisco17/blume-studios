import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STATUS_COLORS = {
  New: 'badge-new', Replied: 'badge-replied', Consult: 'badge-consult',
  Proposal: 'badge-proposal', Booked: 'badge-booked', Lost: 'badge-lost',
};

function StatCard({ label, value, sub, href }) {
  const inner = (
    <div className="card hover:border-gray-300 transition-colors">
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className="font-serif text-3xl text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    fetch('/api/reports/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function runDaily() {
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch('/api/scheduler/run-daily', { method: 'POST' });
      const d = await r.json();
      setRunResult(d);
      // Refresh stats
      const stats = await fetch('/api/reports/dashboard').then(r => r.json());
      setData(stats);
    } catch (err) {
      setRunResult({ error: err.message });
    }
    setRunning(false);
  }

  if (loading) return <div className="text-gray-500 text-sm">Loading…</div>;
  if (!data) return <div className="text-gray-600 text-sm">Could not load dashboard. Is the backend running?</div>;

  const { stats, pipelineByStatus, recentLeads, recentActivity, morningsummary } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-4xl text-gray-900">Good morning.</h2>
          <p className="text-gray-600 text-sm mt-1">Here's where things stand.</p>
        </div>
        <button onClick={runDaily} disabled={running} className="btn-primary flex items-center gap-2">
          {running ? (
            <><span className="animate-spin">↻</span> Running…</>
          ) : (
            <><span>▶</span> Run Daily Routine</>
          )}
        </button>
      </div>

      {runResult && (
        <div className="card border-gray-300 bg-gray-50 text-sm space-y-1">
          <p className="font-medium text-gray-900">Daily routine complete</p>
          <p className="text-gray-600">
            {runResult.stale_leads_drafted} follow-ups drafted · {runResult.sequences_processed} sequences processed · {runResult.replies_detected} replies detected
          </p>
          {runResult.errors?.length > 0 && (
            <details className="text-xs text-gray-600">
              <summary>Errors ({runResult.errors.length})</summary>
              <ul className="mt-1 space-y-0.5">{runResult.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
            </details>
          )}
          <Link to="/queue" className="text-gray-700 underline hover:text-gray-900">Review new drafts →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Leads" value={stats.totalLeads} href="/leads" />
        <StatCard label="Booked" value={stats.bookedLeads} sub="this year" href="/leads" />
        <StatCard label="Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} href="/reports" />
        <StatCard label="Queue" value={stats.pendingQueue} sub="need review" href="/queue" />
        <StatCard label="Prospects" value={stats.totalProspects} href="/prospecting" />
        <StatCard label="Stale Leads" value={stats.staleLeads} sub="3+ days" href="/leads" />
      </div>

      {/* Morning summary */}
      {morningsummary && (
        <div className="card border-l-4 border-l-gray-400">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Morning Summary</p>
          <p className="text-sm text-gray-700 leading-relaxed">{morningsummary.summary}</p>
          <p className="text-xs text-gray-500 mt-2">{new Date(morningsummary.created_at).toLocaleString()}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="card">
          <h3 className="font-serif text-xl mb-4">Pipeline</h3>
          <div className="space-y-2">
            {['New', 'Replied', 'Consult', 'Proposal', 'Booked', 'Lost'].map(status => {
              const s = pipelineByStatus.find(p => p.status === status);
              const count = s?.count || 0;
              const val = s?.value || 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`badge ${STATUS_COLORS[status]} w-20 justify-center`}>{status}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (count / Math.max(stats.totalLeads, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono w-4 text-right text-gray-600">{count}</span>
                  {val > 0 && <span className="text-xs text-gray-500 w-16 text-right">${val.toLocaleString()}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <h3 className="font-serif text-xl mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {recentActivity.length === 0 && <p className="text-gray-500 text-sm">No activity yet.</p>}
            {recentActivity.map(a => (
              <div key={a.id} className="flex gap-3 text-sm">
                <span className="text-xs text-gray-500 font-mono w-32 shrink-0">
                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-gray-700 truncate">{a.action.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl">Recent Leads</h3>
          <Link to="/leads" className="text-sm text-gray-700 hover:text-gray-900 hover:underline">View all →</Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="text-gray-600 text-sm">No leads yet. <Link to="/inquiry" className="text-gray-700 hover:text-gray-900 underline">Process your first inquiry</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-4">Couple</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Venue</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLeads.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{l.couple_name}</td>
                    <td className="py-2 pr-4 text-gray-600">{l.wedding_date || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600 max-w-xs truncate">{l.venue || '—'}</td>
                    <td className="py-2 pr-4"><span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                    <td className="py-2 text-gray-600 text-xs">{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
