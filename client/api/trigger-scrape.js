export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    const response = await fetch(
      'https://api.github.com/repos/jrbarka-max/grain-markets/actions/workflows/scrape.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    if (response.status === 204) {
      res.status(200).json({ success: true, message: 'Scrape triggered' });
    } else {
      const text = await response.text();
      res.status(response.status).json({ success: false, error: text });
    }
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
