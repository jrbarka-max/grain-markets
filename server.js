require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");
const { SCRAPERS } = require("./scrapers");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || "https://zyhzkgwhsqtbhplzekyb.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5aHprZ3doc3F0YmhwbHpla3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQyMDg2OSwiZXhwIjoyMDg3OTk2ODY5fQ.GIkyIPOBuK9k_dE0ytWTD77vUVyEWGgnx_U85x9cQT8"
);

// ─── Core scrape runner ───────────────────────────────────────────────────────
async function runScraper(scraper) {
  try {
    const bids = await scraper.scrape();
    return { success: true, bids, scrapedAt: new Date().toISOString() };
  } catch (err) {
    return { success: false, error: err.message, scrapedAt: new Date().toISOString() };
  }
}

// ─── Save live prices to Supabase ─────────────────────────────────────────────
async function savePrices(scraperId, scraperName, location, bids) {
  if (!bids || bids.length === 0) return;

  const rows = bids
    .filter(b => b.cashPrice || b.basis)
    .map(b => ({
      scraper_id: scraperId,
      source_name: scraperName,
      location,
      grain: b.commodity,
      cash_price: b.cashPrice,
      basis: b.basis,
      futures_month: b.futuresMonth || null,
      raw_text: b.rawText || null,
      scraped_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("grain_prices")
    .upsert(rows, {
      onConflict: "scraper_id,grain,futures_month,location",
      ignoreDuplicates: false,
    });

  if (error) console.error("Supabase upsert error:", error.message);
}

// ─── Save weekly Monday snapshot ──────────────────────────────────────────────
async function saveWeeklySnapshot() {
  try {
    const { data: prices, error } = await supabase
      .from("grain_prices")
      .select("*")
      .order("scraped_at", { ascending: false });

    if (error) throw error;
    if (!prices || !prices.length) { console.log("Weekly snapshot: no prices to snapshot."); return; }

    // Find spot (nearest delivery) per scraper+grain
    const spots = {};
    prices.forEach(p => {
      const key = `${p.scraper_id}|${p.grain}`;
      if (!spots[key]) { spots[key] = p; return; }
      const parseMonth = m => m ? new Date("1 " + m.replace(/([A-Za-z]+)\s+(\d+)/, "$1 20$2")) : new Date("2099");
      if (parseMonth(p.futures_month) < parseMonth(spots[key].futures_month)) spots[key] = p;
    });

    // Get Monday of current week
    const today = new Date();
    const diff = today.getUTCDay() === 0 ? -6 : 1 - today.getUTCDay();
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() + diff);
    const weekOf = monday.toISOString().slice(0, 10);

    const rows = Object.values(spots).map(p => ({
      week_of: weekOf,
      scraper_id: p.scraper_id,
      source_name: p.source_name,
      location: p.location,
      grain: p.grain,
      cash_price: p.cash_price,
      basis: p.basis,
      futures_price: (p.basis != null && p.cash_price != null)
        ? parseFloat((p.cash_price - p.basis).toFixed(4))
        : null,
      futures_month: p.futures_month,
    }));

    const { error: upsertErr } = await supabase
      .from("weekly_snapshots")
      .upsert(rows, { onConflict: "week_of,scraper_id,grain" });

    if (upsertErr) console.error("Weekly snapshot upsert error:", upsertErr.message);
    else console.log(`✓ Weekly snapshot saved — ${rows.length} rows for week of ${weekOf}`);
  } catch (e) {
    console.error("saveWeeklySnapshot error:", e.message);
  }
}

// ─── Scrape all sources ───────────────────────────────────────────────────────
async function scrapeAll() {
  console.log(`[${new Date().toISOString()}] Starting scrape run...`);
  const results = [];

  for (const scraper of SCRAPERS) {
    console.log(`  → Scraping ${scraper.name}...`);
    const result = await runScraper(scraper);

    if (result.success && result.bids?.length > 0) {
      await savePrices(scraper.id, scraper.name, scraper.location, result.bids);
      console.log(`    ✓ ${result.bids.length} bid(s) found`);
    } else {
      console.log(`    ✗ ${result.error || "No bids extracted"}`);
    }

    results.push({ scraper: scraper.id, name: scraper.name, ...result });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[${new Date().toISOString()}] Scrape run complete.`);
  return results;
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", scrapers: SCRAPERS.length }));

app.get("/prices", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("grain_prices")
      .select("*")
      .order("scraped_at", { ascending: false });

    if (error) throw error;

    const seen = new Set();
    const latest = (data || []).filter(row => {
      const key = `${row.scraper_id}:${row.grain}:${row.futures_month}:${row.location}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    res.json({ success: true, prices: latest, count: latest.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Weekly snapshots endpoint — used by the weekly tracker widget
app.get("/weekly-snapshots", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("weekly_snapshots")
      .select("*")
      .order("week_of", { ascending: false });

    if (error) throw error;
    res.json({ success: true, snapshots: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/scrape", async (req, res) => {
  const { scraperId } = req.body;
  try {
    let results;
    if (scraperId) {
      const scraper = SCRAPERS.find(s => s.id === scraperId);
      if (!scraper) return res.status(404).json({ error: "Scraper not found" });
      const result = await runScraper(scraper);
      if (result.success) await savePrices(scraper.id, scraper.name, scraper.location, result.bids);
      results = [{ scraper: scraper.id, ...result }];
    } else {
      results = await scrapeAll();
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/scrape/status", async (req, res) => {
  const sources = SCRAPERS.map(s => ({ id: s.id, name: s.name, location: s.location, grains: s.grains, url: s.url }));

  const { data } = await supabase
    .from("grain_prices")
    .select("scraper_id, scraped_at")
    .order("scraped_at", { ascending: false });

  const lastScrape = {};
  (data || []).forEach(row => { if (!lastScrape[row.scraper_id]) lastScrape[row.scraper_id] = row.scraped_at; });

  res.json({ sources: sources.map(s => ({ ...s, lastScrape: lastScrape[s.id] || null })) });
});

// ─── Cron: 9:30am CT weekdays, 2:00pm CT weekdays ────────────────────────────
cron.schedule("30 14 * * 1-5", async () => {
  console.log("Cron: 9:30am CT scrape");
  await scrapeAll();
});

cron.schedule("0 20 * * 1-5", async () => {
  console.log("Cron: 2:00pm CT scrape");
  await scrapeAll();

  // On Mondays, save weekly close snapshot
  const now = new Date();
  if (now.getUTCDay() === 1) {
    console.log("Monday 2pm — saving weekly snapshot...");
    await saveWeeklySnapshot();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Grain scraper running on port ${PORT}`);
  console.log(`Scrapers configured: ${SCRAPERS.map(s => s.name).join(", ")}`);
  setTimeout(scrapeAll, 3000);
});
