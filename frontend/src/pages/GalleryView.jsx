import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function GalleryView() {
  const { shareToken } = useParams();
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    loadGallery();
  }, [shareToken]);

  async function loadGallery() {
    try {
      const r = await fetch(`/api/galleries/view/${shareToken}`);
      if (r.ok) {
        const d = await r.json();
        setGallery(d);
      } else {
        setGallery(null);
      }
    } catch (err) {
      console.error('Error loading gallery:', err);
      setGallery(null);
    }
    setLoading(false);
  }

  async function downloadPhoto(photoId, filename) {
    try {
      const r = await fetch(`/api/content/photos/view/${photoId}`);
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error downloading photo: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading gallery…</div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-serif text-3xl text-gray-900 mb-2">Gallery Not Found</h1>
          <p className="text-gray-600">This gallery link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-serif text-4xl text-gray-900">{gallery.name}</h1>
          <p className="text-gray-600 mt-2">{gallery.client_name}</p>
          <p className="text-sm text-gray-500 mt-1">{gallery.photos?.length || 0} photos</p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-6xl mx-auto p-8">
        {!gallery.photos || gallery.photos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No photos in this gallery yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 md:grid-cols-2 sm:grid-cols-1">
            {gallery.photos.map(photo => (
              <div key={photo.id} className="group cursor-pointer">
                <div
                  onClick={() => setSelectedPhoto(photo)}
                  className="relative overflow-hidden bg-gray-100 aspect-square hover:opacity-80 transition-opacity"
                >
                  <img
                    src={`/api/content/photos/view/${photo.photo_id}`}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadPhoto(photo.photo_id, photo.filename);
                      }}
                      className="bg-white text-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-100"
                    >
                      ↓ Download
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 truncate">{photo.filename}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            <img
              src={`/api/content/photos/view/${selectedPhoto.photo_id}`}
              alt={selectedPhoto.filename}
              className="w-full h-auto"
            />
            <div className="flex items-center justify-between mt-4 text-white">
              <p className="text-sm">{selectedPhoto.filename}</p>
              <div className="space-x-4">
                <button
                  onClick={() => downloadPhoto(selectedPhoto.photo_id, selectedPhoto.filename)}
                  className="hover:text-gray-300"
                >
                  ↓ Download
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="hover:text-gray-300"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 mt-12 p-8 text-center text-gray-500 text-xs">
        <p>© Blume Studios · Your photos, beautifully presented</p>
      </div>
    </div>
  );
}
