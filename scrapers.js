// No Puppeteer needed — all three sources have direct APIs!
// UFC uses DTN API, CHS uses BushelOps API, Bushmills uses page fetch.

const SCRAPERS = [
  // ─── Central United — Litchfield (DTN API) ──────────────────────────────
  {
    id: "ufc_litchfield",
    name: "Central United — Litchfield",
    url: "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
    location: "Litchfield, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch("https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us");
      const data = await res.json();
      return parseDTN(data, "Litchfield");
    },
  },

  // ─── Central United — Brownton (same DTN site, filter by location) ───────
  {
    id: "ufc_brownton",
    name: "Central United — Brownton",
    url: "https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us",
    location: "Brownton, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch("https://api.dtn.com/markets/sites/E0200701/cash-bids?&apikey=0T9QFViMwN7qKJBG2VsVcv9yR7HAObJz&units=us");
      const data = await res.json();
      return parseDTN(data, "Brownton");
    },
  },

  // ─── Bushmills Ethanol (page fetch + price extraction) ───────────────────
 scrape: async () => {
  const res = await fetch(
    "https://www.cihedging.com/cih/api/index.cfm/v2/origination/cashbids/110773/widget?commodity_ids=&custom_commodity_ids=&exclude_non_custom=false&exclude_custom=false&address_ids=&show_cash_bid_title=true&show_cash_bid_filters=true&show_cash_bid_note=true&show_location_names=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
      },
      body: "{}"
    }
  );
  const data = await res.json();
  const results = [];
  const bids = Array.isArray(data) ? data : (data?.cash_bids || data?.bids || data?.data || []);
  bids.forEach(bid => {
    const name = (bid.commodity_name || bid.commodity || bid.name || "").toLowerCase();
    if (!/corn/.test(name)) return;
    const cashPrice = parseFloat(bid.cash_price || bid.cashPrice || bid.price || 0);
    const basis = parseFloat(bid.basis || bid.basis_price || 0) || null;
    const futuresMonth = bid.futures_month || bid.delivery_month || bid.month || null;
    if (!cashPrice) return;
    results.push({ commodity: "Corn", cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
  });
  return results;
},

  // ─── CHS Mankato (BushelOps API — MKTO location code) ────────────────────
  {
    id: "chs_mankato",
    name: "CHS — Mankato",
    url: "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=MKTO",
    location: "Mankato, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch(
        "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" } }
      );
      const data = await res.json();
      return parseBushelOps(data, "MKTO");
    },
  },
];

// ─── DTN API parser ───────────────────────────────────────────────────────────
function parseDTN(data, locationFilter) {
  const results = [];
  const items = Array.isArray(data) ? data : (data?.cashBids || data?.data || data?.bids || []);

  items.forEach(bid => {
    const name = (bid.commodityName || bid.commodity || bid.name || "").toLowerCase();
    const location = (bid.locationName || bid.location || bid.site || "").toLowerCase();

    // Filter by location if provided
    if (locationFilter && !location.includes(locationFilter.toLowerCase())) return;

    let grain = null;
    if (/corn/.test(name)) grain = "Corn";
    else if (/soy|bean/.test(name)) grain = "Soybeans";
    if (!grain) return;

    const cashPrice = parseFloat(bid.cashPrice || bid.cash || bid.price || 0);
    const basis     = parseFloat(bid.basis || bid.basisPrice || 0) || null;
    const futuresMonth = bid.futuresMonth || bid.deliveryMonth || bid.month || null;

    if (!cashPrice) return;

    results.push({
      commodity: grain,
      cashPrice,
      basis,
      futuresMonth,
      rawText: JSON.stringify(bid).slice(0, 200),
    });
  });

  return results;
}

// ─── BushelOps API parser ────────────────────────────────────────────────────
function parseBushelOps(data, locationCode) {
  const results = [];
  const items = Array.isArray(data) ? data : (data?.data || data?.bids || data?.cashBids || []);

  items.forEach(bid => {
    const loc = (bid.locationRemoteId || bid.location_remote_id || bid.locationId || "").toUpperCase();
    if (locationCode && loc !== locationCode) return;

    const name = (bid.commodityName || bid.commodity || bid.name || "").toLowerCase();
    let grain = null;
    if (/corn/.test(name)) grain = "Corn";
    else if (/soy|bean/.test(name)) grain = "Soybeans";
    if (!grain) return;

    const cashPrice = parseFloat(bid.cashPrice || bid.cash_price || bid.price || 0);
    const basis     = parseFloat(bid.basis || bid.basisPrice || bid.basis_price || 0) || null;
    const futuresMonth = bid.futuresMonth || bid.futures_month || bid.deliveryMonth || null;

    if (!cashPrice) return;

    results.push({
      commodity: grain,
      cashPrice,
      basis,
      futuresMonth,
      rawText: JSON.stringify(bid).slice(0, 200),
    });
  });

  return results;
}

module.exports = { SCRAPERS };
