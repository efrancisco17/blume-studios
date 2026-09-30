import React, { useState, useEffect } from 'react';

export default function ContentTools() {
  const [tab, setTab] = useState('venue');
  const [weddings, setWeddings] = useState([]);
  const [venues, setVenues] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedWedding, setSelectedWedding] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/content/weddings').then(r => r.json()).then(d => setWeddings(d));
    fetch('/api/content/venues').then(r => r.json()).then(d => setVenues(d));
  }, []);

  async function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      formData.append('photos', file);
    }

    try {
      const r = await fetch('/api/content/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const d = await r.json();
      if (r.ok) {
        loadPhotos(selectedWedding);
      } else {
        alert('Upload failed: ' + d.error);
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function loadPhotos(leadId) {
    try {
      let url = '/api/content/photos';
      if (leadId) {
        url += `/${leadId}`;
      }
      const r = await fetch(url);
      const d = await r.json();
      setPhotos(d);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  }

  async function deletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    try {
      await fetch(`/api/content/photos/${photoId}`, { method: 'DELETE' });
      loadPhotos(selectedWedding);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function associatePhotoWithWedding(photoId) {
    const weddingId = prompt('Enter wedding ID or leave blank to unassociate');
    if (weddingId === null) return;

    try {
      const r = await fetch(`/api/content/photos/${photoId}/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: weddingId || null }),
      });
      if (r.ok) {
        loadPhotos(selectedWedding);
      } else {
        alert('Association failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const handleWeddingChange = (weddingId) => {
    setSelectedWedding(weddingId);
    loadPhotos(weddingId);
  };

  const handleViewAllPhotos = () => {
    setSelectedWedding(null);
    loadPhotos(null);
  };

  async function generateVenuePage() {
    if (!selectedVenue) return;
    setGenerating(true);
    setResult(null);
    const r = await fetch('/api/content/venue-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venue_name: selectedVenue }),
    });
    const d = await r.json();
    setGenerating(false);
    if (r.ok) setResult({ type: 'venue', ...d });
  }

  async function generateGBPPost() {
    if (!selectedWedding) return;
    setGenerating(true);
    setResult(null);
    const r = await fetch('/api/content/gbp-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: selectedWedding }),
    });
    const d = await r.json();
    setGenerating(false);
    if (r.ok) setResult({ type: 'gbp', ...d });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-4xl">Content Generation</h2>
        <p className="text-gray-600 text-sm mt-1">Create SEO content and social posts from real weddings.</p>
      </div>

      {/* Photo Upload Section */}
      <div className="card space-y-4 border-l-4 border-l-gray-400">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg">Photo Portfolio</h3>
            <p className="text-gray-600 text-sm mt-1">Upload and manage your wedding photos for content generation.</p>
          </div>
          {selectedWedding && (
            <button
              onClick={handleViewAllPhotos}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              View all photos
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* Upload Section */}
          <div className="bg-gray-50 p-4 border border-gray-200 space-y-3">
            <div>
              <label className="label">Select wedding (optional)</label>
              <select
                className="input"
                value={selectedWedding || ''}
                onChange={e => handleWeddingChange(e.target.value)}
              >
                <option value="">— General portfolio (no wedding) —</option>
                {weddings.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.couple_name} at {w.venue} ({w.wedding_date})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Leave blank to upload to your general portfolio</p>
            </div>

            <div>
              <label className="label">Upload photos (JPG, PNG)</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="w-full text-sm text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Max 20 files, 50MB each • No wedding selection needed</p>
            </div>
          </div>

          {/* Gallery Section */}
          {photos.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                {selectedWedding ? '📷 Wedding Photos' : '📷 All Portfolio Photos'} ({photos.length})
              </p>
              <div className="grid grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={`/api/content/photos/${photo.lead_id || 'general'}/${photo.id}`}
                      alt={photo.filename}
                      className="w-full h-24 object-cover border border-gray-200 cursor-pointer hover:opacity-80"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2280%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22 fill=%22%23999%22%3EImage%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {!selectedWedding && (
                        <button
                          onClick={() => associatePhotoWithWedding(photo.id)}
                          className="bg-gray-800 text-white px-2 py-1 text-xs rounded hover:bg-gray-700"
                          title="Link to wedding"
                        >
                          🔗
                        </button>
                      )}
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="bg-gray-800 text-white px-2 py-1 text-xs rounded hover:bg-gray-700"
                        title="Delete photo"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate" title={photo.filename}>{photo.filename}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">📸 No photos yet</p>
              <p className="text-xs mt-1">Upload your first wedding photo to get started</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setTab('venue'); setResult(null); }}
          className={`px-4 py-2 border text-sm font-medium transition-colors ${
            tab === 'venue'
              ? 'bg-gray-900 text-white border-gray-800'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Venue Landing Pages
        </button>
        <button
          onClick={() => { setTab('gbp'); setResult(null); }}
          className={`px-4 py-2 border text-sm font-medium transition-colors ${
            tab === 'gbp'
              ? 'bg-gray-900 text-white border-gray-800'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Google Business Posts
        </button>
      </div>

      {tab === 'venue' ? (
        <div className="space-y-4">
          <div className="card">
            <label className="label">Select venue</label>
            <select
              className="input"
              value={selectedVenue || ''}
              onChange={e => setSelectedVenue(e.target.value)}
            >
              <option value="">— Choose a venue —</option>
              {venues.map(v => (
                <option key={v.venue} value={v.venue}>
                  {v.venue} ({v.count} wedding{v.count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Generates a landing page using only real weddings you've photographed there.
            </p>
            <button
              onClick={generateVenuePage}
              disabled={generating || !selectedVenue}
              className="btn-primary mt-4"
            >
              {generating ? '✍ Generating…' : '✍ Generate Page'}
            </button>
          </div>

          {result && result.type === 'venue' && (
            <div className="card bg-gray-50">
              <h3 className="font-serif text-lg mb-3">{result.venue_name}</h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {result.content}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <label className="label">Select wedding</label>
            <select
              className="input"
              value={selectedWedding || ''}
              onChange={e => handleWeddingChange(e.target.value)}
            >
              <option value="">— Choose a booked wedding —</option>
              {weddings.map(w => (
                <option key={w.id} value={w.id}>
                  {w.couple_name} at {w.venue} ({w.wedding_date})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Creates a Google Business Profile post celebrating this couple.
            </p>
            <button
              onClick={generateGBPPost}
              disabled={generating || !selectedWedding}
              className="btn-primary mt-4"
            >
              {generating ? '✍ Generating…' : '✍ Generate Post'}
            </button>
          </div>

          {result && result.type === 'gbp' && (
            <div className="card bg-gray-50">
              <div className="mb-3">
                <p className="text-sm font-medium">{result.couple_name}</p>
                <p className="text-xs text-gray-600">{result.venue}</p>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {result.content}
              </pre>
              <p className="text-xs text-gray-500 mt-3">Copy this to your Google Business Profile.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
