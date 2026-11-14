const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

// PRIVATE TESTING ONLY: a key placed in browser code is visible to visitors.
// Leave blank for production; the Vercel /api/tmdb proxy uses TMDB_API_KEY server-side.
const PRIVATE_TEST_KEY = '';

async function request(path, params = {}) {
  const query = new URLSearchParams(params);
  const proxyUrl = `/api/tmdb?path=${encodeURIComponent(path)}&${query.toString()}`;
  try {
    const response = await fetch(proxyUrl);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) return await response.json();
    if (response.status !== 404 && response.status !== 405 && response.status !== 500 && !response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.status_message || `TMDB request failed (${response.status})`);
    }
  } catch (error) {
    if (error.name !== 'TypeError' && !/Failed to fetch/i.test(error.message)) throw error;
  }
  if (!PRIVATE_TEST_KEY) throw new Error('TMDB is not configured. Add TMDB_API_KEY to Vercel or a private testing key in src/js/api/tmdb.js.');
  const directQuery = new URLSearchParams({ ...params, api_key: PRIVATE_TEST_KEY });
  const response = await fetch(`${API_BASE}${path}?${directQuery}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.status_message || `TMDB request failed (${response.status})`);
  return data;
}

export const img = (path, size = 'w500') => path ? `${IMAGE_BASE}${size}${path}` : '';
export const backdrop = (path, size = 'w1280') => path ? `${IMAGE_BASE}${size}${path}` : '';
export const getTrending = (page = 1) => request('/trending/all/week', { page });
export const getPopularMovies = (page = 1) => request('/movie/popular', { page });
export const getPopularTV = (page = 1) => request('/tv/popular', { page });
export const getTopRated = (page = 1) => request('/movie/top_rated', { page });
export const getUpcoming = (page = 1) => request('/movie/upcoming', { page });
export const searchTitles = (query, page = 1) => request('/search/multi', { query, page, include_adult: false });
export const getDetails = (type, id) => request(`/${type}/${id}`, { append_to_response: 'videos,credits,images' });
export const getSeason = (id, season) => request(`/tv/${id}/season/${season}`);
export const getGenres = (type) => request(`/genre/${type}/list`);
export const discoverGenre = (type, genreId, page = 1) => request(`/discover/${type}`, { with_genres: genreId, sort_by: 'popularity.desc', page });
