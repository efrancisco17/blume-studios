const API_URL = import.meta.env.VITE_API_URL || 'https://blume-studios-production.up.railway.app';

export async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
