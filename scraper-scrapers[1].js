const puppeteer = require("puppeteer");

// ─────────────────────────────────────────────────────────────
// SCRAPER CONFIG — one entry per location/site
// Each scraper defines how to extract bids from that site.
// ─────────────────────────────────────────────────────────────
const SCRAPERS = [
  {
    id: "ufc_litchfield",
    name: "Central United — Litchfield",
    url: "https://www.ufcmn.com/home/#cash-bids-futures",
    location: "Litchfield, MN",
    grains: ["Corn", "Soybeans"],
    // UFC uses a DTN widget — we wait for the bid table to render
    scrape: async (page) => {
      await page.goto("https://www.ufcmn.com/home/", {
        waitUntil: "networkidle2",
        timeout: 45000,
      });

      // Select Litchfield location if a dropdown exists
      try {
        await page.waitForSelector('select[name*="location"], select[id*="location"], .dtn-location-select', { timeout: 8000 });
        await page.select('select[name*="location"], select[id*="location"]', "Litchfield").catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
      } catch (_) {}

      // Wait for bid rows to render
      await page.waitForSelector(
        '.dtn-cash-bid, .cash-bid-row, table.bids tr, [class*="bid"], [class*="cash"]',
        { timeout: 20000 }
      ).catch(() => {});

      return await page.evaluate(() => {
        const results = [];
        // DTN widget typically renders a table with commodity + price + basis
        const rows = document.querySelectorAll(
          'table tr, .dtn-cash-bid-row, [class*="bid-row"], [class*="cashbid"]'
        );
        rows.forEach(row => {
          const text = row.innerText || "";
          const cells = Array.from(row.querySelectorAll("td, th, [class*='cell']"))
            .map(c => c.innerText.trim());

          if (cells.length >= 2) {
            const commodity = cells[0]?.trim();
            // Look for corn / soybean rows
            if (/corn/i.test(commodity) || /soy/i.test(commodity) || /bean/i.test(commodity)) {
              results.push({
                commodity: /corn/i.test(commodity) ? "Corn" : "Soybeans",
                cashPrice: parseFloat(cells.find(c => /^\$?\d+\.\d+$/.test(c.trim()))?.replace("$", "")) || null,
                basis: parseFloat(cells.find(c => /^[+-]?\d+\.?\d*$/.test(c.trim()) && parseFloat(c) < 1)?.replace("$", "")) || null,
                futuresMonth: cells.find(c => /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(c)) || null,
                rawText: cells.join(" | "),
              });
            }
          }
        });
        return results;
      });
    },
  },

  {
    id: "ufc_brownton",
    name: "Central United — Brownton",
    url: "https://www.ufcmn.com/home/#cash-bids-futures",
    location: "Brownton, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async (page) => {
      await page.goto("https://www.ufcmn.com/home/", {
        waitUntil: "networkidle2",
        timeout: 45000,
      });

      // Try to select Brownton location
      try {
        await page.waitForSelector('select', { timeout: 8000 });
        const selects = await page.$$("select");
        for (const sel of selects) {
          const options = await sel.$$eval("option", opts =>
            opts.map(o => ({ value: o.value, text: o.innerText }))
          );
          const brownton = options.find(o => /brownton/i.test(o.text));
          if (brownton) {
            await sel.select(brownton.value);
            await new Promise(r => setTimeout(r, 2500));
            break;
          }
        }
      } catch (_) {}

      await page.waitForSelector(
        '.dtn-cash-bid, table.bids tr, [class*="bid"]',
        { timeout: 20000 }
      ).catch(() => {});

      return await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('table tr, [class*="bid-row"]');
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll("td, th"))
            .map(c => c.innerText.trim());
          if (cells.length >= 2) {
            const commodity = cells[0]?.trim();
            if (/corn/i.test(commodity) || /soy/i.test(commodity) || /bean/i.test(commodity)) {
              results.push({
                commodity: /corn/i.test(commodity) ? "Corn" : "Soybeans",
                cashPrice: parseFloat(cells.find(c => /^\$?\d+\.\d+$/.test(c))?.replace("$", "")) || null,
                basis: parseFloat(cells.find(c => /^[+-]\d+\.?\d*$/.test(c))) || null,
                futuresMonth: cells.find(c => /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(c)) || null,
                rawText: cells.join(" | "),
              });
            }
          }
        });
        return results;
      });
    },
  },

  {
    id: "bushmills",
    name: "Bushmills Ethanol",
    url: "https://bushmills.cihedging.com/cih/grower/login.cfm",
    location: "Atwater, MN",
    grains: ["Corn"],
    // Bushmills uses the CIH Hedging portal — the public bids page
    scrape: async (page) => {
      // Try the public bids endpoint first
      await page.goto("https://bushmillsethanol.com/corn-procurement-and-bids/", {
        waitUntil: "networkidle2",
        timeout: 45000,
      });

      // Wait for any embedded bid widget
      await new Promise(r => setTimeout(r, 5000));

      const bids = await page.evaluate(() => {
        const results = [];
        // Look for any price-like elements on the page
        const allText = document.body.innerText;
        const priceMatches = allText.match(/\$?\d+\.\d{2,4}/g) || [];
        const basisMatches = allText.match(/[+-]\d+\.?\d*/g) || [];

        // Also check for embedded iframes
        const iframes = document.querySelectorAll("iframe");
        const iframeSrcs = Array.from(iframes).map(f => f.src);

        // Look for structured bid tables
        document.querySelectorAll("table tr").forEach(row => {
          const cells = Array.from(row.querySelectorAll("td")).map(c => c.innerText.trim());
          if (cells.some(c => /corn/i.test(c))) {
            results.push({
              commodity: "Corn",
              cashPrice: parseFloat(cells.find(c => /^\$?\d+\.\d+$/.test(c))?.replace("$", "")) || null,
              basis: parseFloat(cells.find(c => /^[+-]\d+/.test(c))) || null,
              rawText: cells.join(" | "),
              iframeSrcs,
            });
          }
        });

        if (results.length === 0 && priceMatches.length > 0) {
          results.push({
            commodity: "Corn",
            cashPrice: parseFloat(priceMatches[0]?.replace("$", "")) || null,
            basis: null,
            rawText: `Found prices: ${priceMatches.slice(0,3).join(", ")}`,
            note: "Bids may require login — check CIH portal",
          });
        }

        return results;
      });

      return bids;
    },
  },

  {
    id: "chs_mankato",
    name: "CHS — Mankato",
    url: "https://chsag.com/grain/cash-bids/",
    location: "Mankato, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async (page) => {
      await page.goto("https://chsag.com/grain/cash-bids/", {
        waitUntil: "networkidle2",
        timeout: 45000,
      });

      // CHS uses DTN/DTN widgets — give extra time for JS render
      await new Promise(r => setTimeout(r, 6000));

      // Try to find and click Mankato location filter
      try {
        await page.waitForSelector('[data-location], .location-tab, .location-filter', { timeout: 5000 });
        const mankato = await page.$('[data-location*="mankato" i], [data-location*="Mankato"]');
        if (mankato) { await mankato.click(); await new Promise(r => setTimeout(r, 2000)); }
      } catch (_) {}

      await page.waitForSelector(
        'table tr td, .dtn-cash-bid, [class*="bid"], [class*="cash-bid"]',
        { timeout: 20000 }
      ).catch(() => {});

      return await page.evaluate(() => {
        const results = [];

        // Check for DTN widget markup
        const bidContainers = document.querySelectorAll(
          '[class*="dtn"], [class*="bid"], [id*="bid"], [class*="cash"]'
        );

        document.querySelectorAll("table").forEach(table => {
          const rows = table.querySelectorAll("tr");
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll("td, th")).map(c => c.innerText.trim());
            const text = cells.join(" ").toLowerCase();
            if (/corn|soybean|beans/.test(text) && cells.length >= 2) {
              const grain = /soybean|beans/.test(text) ? "Soybeans" : "Corn";
              results.push({
                commodity: grain,
                cashPrice: parseFloat(cells.find(c => /^\$?\d+\.\d+$/.test(c.trim()))?.replace("$", "")) || null,
                basis: parseFloat(cells.find(c => /^[+-]\d+\.?\d*$/.test(c.trim()))) || null,
                futuresMonth: cells.find(c => /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(c)) || null,
                rawText: cells.join(" | "),
              });
            }
          });
        });

        // Fallback: check all visible text for price patterns near grain names
        if (results.length === 0) {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const texts = [];
          let node;
          while ((node = walker.nextNode())) texts.push(node.textContent.trim());
          const grainIdx = texts.findIndex(t => /corn|soybean/i.test(t));
          if (grainIdx > -1) {
            const nearby = texts.slice(grainIdx, grainIdx + 10).join(" ");
            results.push({ commodity: "Unknown", rawText: nearby, cashPrice: null, basis: null, note: "Widget may be behind login or iframe" });
          }
        }

        return results;
      });
    },
  },
];

module.exports = { SCRAPERS };
