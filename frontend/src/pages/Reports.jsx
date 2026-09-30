import React, { useState, useEffect } from 'react';

export default function Reports() {
  const [roi, setRoi] = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/reports/roi').then(r => r.json()).then(d => setRoi(d)),
      fetch('/api/reports/trend').then(r => r.json()).then(d => setTrend(d)),
    ]).then(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="font-serif text-4xl">Reports & Analytics</h2>
        <p className="text-stone-500 text-sm mt-1">ROI by source and booking trends.</p>
      </div>

      {/* ROI by source */}
      <div className="card">
        <h3 className="font-serif text-xl mb-6">Source ROI</h3>
        {!roi || roi.bySource.length === 0 ? (
          <p className="text-stone-400 text-sm">No data yet — process inquiries to see ROI.</p>
        ) : (
          <div className="space-y-4">
            {roi.bySource.map((s, i) => (
              <div key={i} className="border-b border-stone-200 dark:border-stone-700 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{s.source}</span>
                  <span className="text-sm text-blume-600 font-medium">${s.revenue.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-stone-400">Leads:</span>
                    <p className="font-medium">{s.total_leads}</p>
                  </div>
                  <div>
                    <span className="text-stone-400">Bookings:</span>
                    <p className="font-medium">{s.bookings}</p>
                  </div>
                  <div>
                    <span className="text-stone-400">Conversion:</span>
                    <p className="font-medium">{s.conversion_rate}%</p>
                  </div>
                  <div>
                    <span className="text-stone-400">Cost/Book:</span>
                    <p className="font-medium">${s.bookings > 0 ? Math.round(s.revenue / s.bookings) : '—'}</p>
                  </div>
                </div>
                <div className="bg-stone-100 dark:bg-stone-700 rounded-full h-2 overflow-hidden">
                  <div className="bg-blume-500 h-full" style={{ width: `${s.conversion_rate}%` }} />
                </div>
              </div>
            ))}

            <div className="mt-6 space-y-3 bg-stone-50 dark:bg-stone-900/50 rounded-xl p-4">
              <h4 className="font-medium text-sm">Recommendations</h4>
              {roi.recommendations.map((rec, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-stone-800 dark:text-stone-100">
                    {rec.source}
                    <span className={`ml-2 text-xs px-2 py-1 rounded ${
                      rec.action === 'keep' ? 'bg-green-100 text-green-700' :
                      rec.action === 'cut' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {rec.action.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-stone-600 dark:text-stone-400 mt-1">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trend */}
      {trend && trend.length > 0 && (
        <div className="card">
          <h3 className="font-serif text-xl mb-6">Booking Trend</h3>
          <div className="space-y-2">
            {trend.map((t, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{t.month}</span>
                  <span className="text-xs text-stone-400">
                    {t.bookings} bookings · ${t.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-1 h-8">
                  <div
                    className="bg-blue-500 rounded h-full"
                    style={{ flex: t.leads || 0.1 }}
                    title={`${t.leads} leads`}
                  />
                  <div
                    className="bg-green-500 rounded h-full"
                    style={{ flex: t.bookings || 0.1 }}
                    title={`${t.bookings} bookings`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-4">Blue = leads, Green = bookings</p>
        </div>
      )}

      {/* Outreach stats */}
      {roi && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h4 className="font-medium text-sm mb-4">Prospect Pipeline</h4>
            <div className="space-y-2">
              {roi.outreachStats.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{s.status}</span>
                  <span className="font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h4 className="font-medium text-sm mb-4">Outreach Sequences</h4>
            <div className="space-y-2">
              {roi.sequenceStats.map((s, i) => (
                <div key={i} className="text-xs text-stone-600">
                  Step {s.step} - {s.status}: <span className="font-mono font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
