import React, { useState, useEffect } from 'react';

export default function GalleryManager() {
  const [galleries, setGalleries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [formData, setFormData] = useState({ name: '', client_name: '', client_email: '' });

  useEffect(() => {
    loadGalleries();
    loadPhotos();
  }, []);

  async function loadGalleries() {
    try {
      const r = await fetch('/api/galleries');
      const d = await r.json();
      setGalleries(d);
    } catch (err) {
      console.error('Error loading galleries:', err);
    }
  }

  async function loadPhotos() {
    try {
      const r = await fetch('/api/content/photos');
      const d = await r.json();
      setPhotos(d);
      setLoading(false);
    } catch (err) {
      console.error('Error loading photos:', err);
      setLoading(false);
    }
  }

  async function createGallery() {
    if (!formData.name || !formData.client_name) {
      alert('Gallery name and client name required');
      return;
    }

    setCreating(true);
    try {
      const r = await fetch('/api/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const d = await r.json();
      if (r.ok) {
        setFormData({ name: '', client_name: '', client_email: '' });
        setSelectedPhotos([]);
        loadGalleries();
      } else {
        alert('Error: ' + d.error);
      }
    } catch (err) {
      alert('Error creating gallery: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function savePhotosToGallery() {
    if (!selectedGallery || selectedPhotos.length === 0) {
      alert('Select photos to add');
      return;
    }

    try {
      const r = await fetch(`/api/galleries/${selectedGallery}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: selectedPhotos }),
      });
      if (r.ok) {
        alert('Photos added to gallery!');
        setSelectedPhotos([]);
        loadGalleries();
      } else {
        alert('Error adding photos');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function deleteGallery(id) {
    if (!confirm('Delete this gallery?')) return;
    try {
      await fetch(`/api/galleries/${id}`, { method: 'DELETE' });
      loadGalleries();
    } catch (err) {
      alert('Error deleting gallery: ' + err.message);
    }
  }

  function togglePhotoSelection(photoId) {
    setSelectedPhotos(prev =>
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  }

  function copyShareLink(shareToken) {
    const url = `${window.location.origin}/gallery/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
  }

  if (loading) return <div className="text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="font-serif text-4xl">Client Galleries</h2>
        <p className="text-gray-600 text-sm mt-1">Create and share photo galleries with clients.</p>
      </div>

      {/* Create Gallery Section */}
      <div className="card space-y-4">
        <h3 className="font-serif text-lg">Create New Gallery</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Gallery Name</label>
            <input
              className="input"
              placeholder="Wedding Gallery 2024"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Client Name</label>
            <input
              className="input"
              placeholder="John & Jane"
              value={formData.client_name}
              onChange={e => setFormData({ ...formData, client_name: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Client Email (optional)</label>
            <input
              className="input"
              type="email"
              placeholder="couple@example.com"
              value={formData.client_email}
              onChange={e => setFormData({ ...formData, client_email: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={createGallery}
          disabled={creating}
          className="btn-primary"
        >
          {creating ? 'Creating…' : 'Create Gallery'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Photo Selection */}
        <div className="card space-y-4">
          <h3 className="font-serif text-lg">Select Photos</h3>
          {photos.length === 0 ? (
            <p className="text-gray-500 text-sm">No photos uploaded yet</p>
          ) : (
            <>
              <div>
                <label className="label text-xs">Choose Gallery</label>
                <select
                  className="input"
                  value={selectedGallery || ''}
                  onChange={e => setSelectedGallery(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Select a gallery...</option>
                  {galleries.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.client_name})</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-600">Selected: {selectedPhotos.length}</p>
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => togglePhotoSelection(photo.id)}
                    className={`cursor-pointer border-2 p-2 text-center transition-all ${
                      selectedPhotos.includes(photo.id)
                        ? 'border-gray-900 bg-gray-100'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={`/api/content/photos/view/${photo.id}`}
                      alt={photo.filename}
                      className="w-full h-16 object-cover mb-1"
                    />
                    <p className="text-xs text-gray-600 truncate">{photo.filename}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={savePhotosToGallery}
                disabled={!selectedGallery || selectedPhotos.length === 0}
                className="btn-primary w-full disabled:opacity-50"
              >
                Add to Gallery
              </button>
            </>
          )}
        </div>

        {/* Galleries List */}
        <div className="card space-y-4">
          <h3 className="font-serif text-lg">Your Galleries ({galleries.length})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {galleries.length === 0 ? (
              <p className="text-gray-500 text-sm">No galleries yet</p>
            ) : (
              galleries.map(gallery => (
                <div key={gallery.id} className="p-3 border border-gray-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{gallery.name}</p>
                      <p className="text-xs text-gray-600">{gallery.client_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{gallery.photo_count || 0} photos</p>
                    </div>
                    <button
                      onClick={() => deleteGallery(gallery.id)}
                      className="text-gray-400 hover:text-gray-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <button
                    onClick={() => copyShareLink(gallery.share_token)}
                    className="text-xs text-gray-600 hover:text-gray-900 underline w-full text-left"
                  >
                    📋 Copy share link
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
