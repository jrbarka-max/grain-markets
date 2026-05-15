export default async function handler(req, res) {
  // Handle futures quotes request
  if (req.method === 'GET' && req.query.quotes) {
    const symbols = ['ZCK26', 'ZCN26', 'ZCZ26', 'ZSK26', 'ZSN26', 'ZSX26'];
    try {
      const results = await Promise.all(symbols.map(async sym => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const data = await r.json();
        const meta = data?.chart?.result?.[0]?.meta;
        return {
          symbol: sym,
          price: meta?.regularMarketPrice,
          prev: meta?.previousClose,
          change: meta?.regularMarketPrice && meta?.previousClose
            ? parseFloat((meta.regularMarketPrice - meta.previousClose).toFixed(4))
            : null,
          time: meta?.regularMarketTime,
        };
      }));
      return res.status(200).json({ success: true, quotes: results });
    } catch(e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // Handle scrape trigger
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
