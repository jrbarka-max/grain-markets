require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { SCRAPERS } = require("./scrapers");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function cleanupOldPrices() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("grain_prices")
    .delete()
    .lt("scraped_at", cutoff);
  if (error) console.error("Cleanup error:", error.message);
  else console.log("✓ Cleaned up prices older than 30 days");
}

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
  if (!rows.length) return;
  const { error } = await supabase
    .from("grain_prices")
    .upsert(rows, { onConflict: "scraper_id,grain,futures_month,location", ignoreDuplicates: false });
  if (error) console.error("Supabase upsert error:", error.message);
}

async function saveWeeklySnapshot() {
  try {
    const { data: prices, error } = await supabase
      .from("grain_prices")
      .select("*")
      .order("scraped_at", { ascending: false });
    if (error) throw error;
    if (!prices || !prices.length) { console.log("Weekly snapshot: no prices."); return; }

    const spots = {};
    prices.forEach(p => {
      const key = `${p.scraper_id}|${p.grain}`;
      if (!spots[key]) { spots[key] = p; return; }
      const parse = m => m ? new Date("1 " + m.replace(/([A-Za-z]+)\s+(\d+)/, "$1 20$2")) : new Date("2099");
      if (parse(p.futures_month) < parse(spots[key].futures_month)) spots[key] = p;
    });

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

    if (upsertErr) console.error("Weekly snapshot error:", upsertErr.message);
    else console.log(`✓ Weekly snapshot saved — ${rows.length} rows for week of ${weekOf}`);
  } catch(e) {
    console.error("saveWeeklySnapshot error:", e.message);
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting scrape run...`);

  // Clean up expired prices first
  await cleanupOldPrices();

  for (const scraper of SCRAPERS) {
    console.log(`  → Scraping ${scraper.name}...`);
    try {
      const bids = await scraper.scrape();
      if (bids && bids.length > 0) {
        await savePrices(scraper.id, scraper.name, scraper.location, bids);
        console.log(`    ✓ ${bids.length} bid(s) saved`);
      } else {
        console.log(`    ✗ No bids extracted`);
      }
    } catch(e) {
      console.error(`    ✗ Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save weekly snapshot on Monday 2pm run
  if (process.env.IS_MONDAY === 'true') {
    console.log("Monday run — saving weekly snapshot...");
    await saveWeeklySnapshot();
  }

  console.log(`[${new Date().toISOString()}] Done.`);
}

main().catch(e => { console.error(e); process.exit(1); });
