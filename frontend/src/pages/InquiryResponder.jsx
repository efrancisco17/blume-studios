import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function InquiryResponder() {
  const [inquiryText, setInquiryText] = useState('');
  const [step, setStep] = useState('input'); // input | processing | result
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function process() {
    if (!inquiryText.trim()) return;
    setStep('processing');
    setError(null);
    try {
      const r = await fetch('/api/leads/full-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiry_text: inquiryText }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setResult(data);
      setStep('result');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  }

  function reset() {
    setInquiryText('');
    setStep('input');
    setResult(null);
    setError(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-4xl">Inquiry Responder</h2>
        <p className="text-stone-500 text-sm mt-1">Paste a raw inquiry. The agent extracts details, checks your calendar, and drafts a reply.</p>
      </div>

      {step === 'input' && (
        <div className="card space-y-4">
          <div>
            <label className="label">Paste inquiry here</label>
            <textarea
              className="input font-sans"
              rows={12}
              value={inquiryText}
              onChange={e => setInquiryText(e.target.value)}
              placeholder={`Hi! My name is Alex and I'm getting married on June 14, 2026 at The Estate at Florentine Gardens. I found you on Instagram and love your style! We're looking for about 8 hours of coverage. Please let me know your availability and pricing. Thanks, Alex & Jordan`}
            />
          </div>
          {error && <p className="text-red-500 text-sm">Error: {error}</p>}
          <div className="flex gap-3">
            <button onClick={process} disabled={!inquiryText.trim()} className="btn-primary">
              Process Inquiry →
            </button>
            {inquiryText && <button onClick={reset} className="btn-ghost">Clear</button>}
          </div>
          <p className="text-xs text-stone-400">
            This will: extract couple details · check Google Calendar · draft a reply under 170 words · save lead · add to Approval Queue.
          </p>
        </div>
      )}

      {step === 'processing' && (
        <div className="card text-center py-12 space-y-4">
          <div className="text-4xl animate-pulse">✉</div>
          <p className="text-stone-600 dark:text-stone-400">Parsing inquiry and drafting reply…</p>
          <p className="text-xs text-stone-400">Checking calendar · Building draft · Creating lead</p>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-5">
          {/* Extracted data */}
          <div className="card">
            <h3 className="font-serif text-xl mb-4">Extracted Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Couple', result.lead.couple_name],
                ['Email', result.lead.email],
                ['Phone', result.lead.phone],
                ['Wedding Date', result.lead.wedding_date],
                ['Venue', result.lead.venue],
                ['Source', result.lead.source],
              ].map(([label, value]) => value && (
                <div key={label}>
                  <span className="text-xs text-stone-400 uppercase tracking-wide">{label}</span>
                  <p className="font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {result.calendar_available !== null && (
              <div className={`mt-4 text-sm px-3 py-2 rounded-lg ${result.calendar_available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {result.calendar_available
                  ? '✓ Calendar shows this date is available'
                  : '✗ This date appears booked on your calendar — verify before replying'}
              </div>
            )}
          </div>

          {/* Draft reply */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl">Draft Reply</h3>
              <span className="text-xs text-stone-400 font-mono">{result.draft?.split(/\s+/).length || 0} words</span>
            </div>
            <pre className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap font-sans leading-relaxed bg-stone-50 dark:bg-stone-900 rounded-xl p-4">
              {result.draft}
            </pre>
            <div className="mt-4 flex gap-3 flex-wrap items-center">
              <Link to="/queue" className="btn-primary">Review in Queue →</Link>
              <p className="text-xs text-stone-400">Draft queued for approval · Queue ID #{result.queue_id}</p>
            </div>
          </div>

          <button onClick={reset} className="btn-ghost">← Process another inquiry</button>
        </div>
      )}
    </div>
  );
}
