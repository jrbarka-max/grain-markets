const SCRAPERS = [
  // ─── Central United — Litchfield (DTN API) ──────────────────────────────
  {
    id: "ufc_litchfield",
    name: "Central United — Litchfield",
    url: "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
    location: "Litchfield, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch(
        "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
        { headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "application/json" } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const locs = [...new Set(data.map(b => b.location && b.location.name).filter(Boolean))];
        console.log("DTN locations:", locs.join(", "));
      }
      return parseDTN(data, "Litchfield");
    },
  },

  // ─── Central United — Brownton ───────────────────────────────────────────
  {
    id: "ufc_brownton",
    name: "Central United — Brownton",
    url: "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
    location: "Brownton, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch(
        "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
        { headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "application/json" } }
      );
      const data = await res.json();
      return parseDTN(data, "Brownton");
    },
  },

  // ─── Bushmills Ethanol (CIH widget — returns HTML) ───────────────────────
  {
    id: "bushmills",
    name: "Bushmills Ethanol",
    url: "https://www.cihedging.com/cih/api/index.cfm/v2/origination/cashbids/110773/widget",
    location: "Atwater, MN",
    grains: ["Corn"],
    scrape: async () => {
      const res = await fetch(
        "https://www.cihedging.com/cih/api/index.cfm/v2/origination/cashbids/110773/widget?commodity_ids=&custom_commodity_ids=&exclude_non_custom=false&exclude_custom=false&address_ids=&show_cash_bid_title=true&show_cash_bid_filters=true&show_cash_bid_note=true&show_location_names=true",
        {
          method: "POST",
          headers: {
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://bushmillsethanol.com",
            "Referer": "https://bushmillsethanol.com/corn-procurement-and-bids/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
          },
          body: null,
        }
      );
      const text = await res.text();
      console.log("Bushmills status:", res.status);

      // API returns a JSON-encoded HTML string
      let html = text;
      try { html = JSON.parse(text); } catch(e) { /* already raw HTML */ }

      const rowIdx = html.indexOf('<tr'); const firstRows = html.slice(rowIdx, rowIdx + 3000); console.log("Bushmills rows:", firstRows);

      const results = [];

      // Try data attributes first: data-cash-price="3.83" data-basis="-0.77" data-delivery-label="Mar 26"
      const bidPattern = /data-cash-price="([\d.]+)"[^>]*data-basis="([^"]*)"[^>]*data-delivery-label="([^"]*)"/g;
      let match;
      while ((match = bidPattern.exec(html)) !== null) {
        const cashPrice = parseFloat(match[1]);
        const basis = parseFloat(match[2]) || null;
        const futuresMonth = match[3] || null;
        if (cashPrice > 1) results.push({ commodity: "Corn", cashPrice, basis, futuresMonth, rawText: match[0] });
      }

      // Fallback: pull prices and month labels from table text
      if (results.length === 0) {
        console.log("Bushmills: trying fallback extraction");
        const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        rows.forEach(row => {
          const priceMatch = row.match(/\$?(3|4|5|6|7)\.\d{2,4}/);
          const monthMatch = row.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i);
          if (priceMatch) {
            const cashPrice = parseFloat(priceMatch[0].replace("$", ""));
            if (cashPrice > 1) results.push({ commodity: "Corn", cashPrice, basis: null, futuresMonth: monthMatch ? monthMatch[0] : null, rawText: row.slice(0, 2000) });
          }
        });
      }

      console.log("Bushmills extracted:", results.length, "bids");
      return results;
    },
  },

  // ─── CHS Mankato (BushelOps API) ─────────────────────────────────────────
  {
    id: "chs_mankato",
    name: "CHS — Mankato",
    url: "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
    location: "Mankato, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch(
        "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://chsag.com/grain/cash-bids/",
            "Origin": "https://chsag.com",
            "app-company": "chs",
            "app-installation-id": "",
            "app-name": "",
            "app-version": "",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
          }
        }
      );
      const text = await res.text();
      console.log("CHS status:", res.status);
      try {
        const data = JSON.parse(text);
        return parseBushelOps(data, "Mankato");
      } catch(e) {
        console.log("CHS parse error:", e.message);
        console.log("CHS raw:", text.slice(0, 300));
        return [];
      }
    },
  },
];

// ─── DTN parser — location is a nested { id, name } object ───────────────────
function parseDTN(data, locationFilter) {
  const results = [];
  if (!Array.isArray(data)) return results;

  data.forEach(bid => {
    const locName = (bid.location && bid.location.name ? bid.location.name : "").toLowerCase();
    if (locationFilter && !locName.includes(locationFilter.toLowerCase())) return;

    const name = (bid.commodityDisplayName || bid.commodityName || bid.commodity || "").toLowerCase();
    let grain = null;
    if (/corn/.test(name)) grain = "Corn";
    else if (/soy|bean/.test(name)) grain = "Soybeans";
    if (!grain) return;

    const cashPrice = parseFloat(bid.cashPrice || bid.cash_price || 0);
    const basis = parseFloat(bid.basisPrice || bid.basis || 0) || null;
    const futuresMonth = bid.contractDeliveryLabel || bid.futuresMonth || bid.month || null;

    if (!cashPrice || cashPrice < 1) return;
    results.push({ commodity: grain, cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
  });

  return results;
}

// ─── BushelOps parser — nested data[].crops[].bids[] ─────────────────────────
function parseBushelOps(data, locationFilter) {
  const results = [];
  const locations = data && data.data ? data.data : [];

  locations.forEach(loc => {
    const locName = (loc.location_name || "").toLowerCase();
    if (locationFilter && !locName.includes(locationFilter.toLowerCase())) return;

    (loc.crops || []).forEach(crop => {
      const name = (crop.name || "").toLowerCase();
      let grain = null;
      if (/corn/.test(name)) grain = "Corn";
      else if (/soy|bean/.test(name)) grain = "Soybeans";
      if (!grain) return;

      (crop.bids || []).forEach(bid => {
        const cashPrice = parseFloat(bid.current_bid || 0);
        const basis = parseFloat(bid.basis_price || 0) || null;
        const futuresMonth = bid.description || null;
        if (!cashPrice || cashPrice < 1) return;
        results.push({ commodity: grain, cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
      });
    });
  });

  return results;
}

module.exports = { SCRAPERS };
