export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return res.status(503).json({ error: 'TMDB_API_KEY is not configured on the server.' });
  const path = String(req.query.path || '');
  if (!path.startsWith('/') || path.includes('..') || path.includes('://')) return res.status(400).json({ error: 'Invalid TMDB path.' });
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(req.query)) {
    if (name !== 'path' && typeof value === 'string') params.set(name, value);
  }
  params.set('api_key', key);
  try {
    const upstream = await fetch(`https://api.themoviedb.org/3${path}?${params.toString()}`);
    const body = await upstream.text();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: 'Unable to reach TMDB right now.' });
  }
}
