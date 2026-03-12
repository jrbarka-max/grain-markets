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
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "Accept": "application/json" } }
      );
      const text = await res.text();
      console.log("DTN status:", res.status);
      console.log("DTN response (first 500):", text.slice(0, 500));
      try {
        const data = JSON.parse(text);
        return parseDTN(data, "Litchfield");
      } catch(e) {
        console.log("DTN parse error:", e.message);
        return [];
      }
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
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "Accept": "application/json" } }
      );
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return parseDTN(data, "Brownton");
      } catch(e) {
        return [];
      }
    },
  },

  // ─── Bushmills Ethanol (CIH API) ─────────────────────────────────────────
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
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
            "Referer": "https://bushmillsethanol.com/",
            "Origin": "https://bushmillsethanol.com",
          },
          body: "",
        }
      );
      const text = await res.text();
      console.log("Bushmills status:", res.status);
      console.log("Bushmills response (first 500):", text.slice(0, 500));
      try {
        const data = JSON.parse(text);
        const results = [];
        const bids = Array.isArray(data) ? data
          : (data?.cash_bids || data?.bids || data?.data || data?.cashBids || []);
        bids.forEach(bid => {
          const name = (bid.commodity_name || bid.commodity || bid.name || bid.commodityName || "").toLowerCase();
          if (!/corn/.test(name)) return;
          const cashPrice = parseFloat(bid.cash_price || bid.cashPrice || bid.price || bid.cash || 0);
          const basis = parseFloat(bid.basis || bid.basis_price || bid.basisPrice || 0) || null;
          const futuresMonth = bid.futures_month || bid.delivery_month || bid.futuresMonth || bid.month || null;
          if (!cashPrice) return;
          results.push({ commodity: "Corn", cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
        });
        return results;
      } catch(e) {
        console.log("Bushmills parse error:", e.message);
        return [];
      }
    },
  },

  // ─── CHS Mankato (BushelOps API) ─────────────────────────────────────────
  {
    id: "chs_mankato",
    name: "CHS — Mankato",
    url: "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=MKTO",
    location: "Mankato, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      // Try with full original URL that we saw in the browser
      const res = await fetch(
        "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
            "Accept": "application/json",
            "Referer": "https://chsag.com/",
            "Origin": "https://chsag.com",
          }
        }
      );
      const text = await res.text();
      console.log("CHS status:", res.status);
      console.log("CHS response (first 500):", text.slice(0, 500));
      try {
        const data = JSON.parse(text);
        return parseBushelOps(data);
      } catch(e) {
        console.log("CHS parse error:", e.message);
        return [];
      }
    },
  },
];

// ─── DTN parser ───────────────────────────────────────────────────────────────
function parseDTN(data, locationFilter) {
  const results = [];
  let items = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data?.locations) {
    data.locations.forEach(loc => {
      const locName = (loc.name || loc.locationName || "").toLowerCase();
      if (locationFilter && !locName.includes(locationFilter.toLowerCase())) return;
      (loc.bids || loc.cashBids || []).forEach(bid => items.push({ ...bid, _location: loc.name }));
    });
  } else if (data?.cashBids) {
    items = data.cashBids;
  } else if (data?.data) {
    items = data.data;
  } else {
    Object.values(data).forEach(v => { if (Array.isArray(v)) items.push(...v); });
  }

  items.forEach(bid => {
    if (locationFilter && !data?.locations) {
      const loc = bid.locationName || bid.location || bid.site || bid.location_name || "";
      if (typeof loc === "string" && loc && !loc.toLowerCase().includes(locationFilter.toLowerCase())) return;
    }
    const name = (bid.commodityName || bid.commodity || bid.name || bid.commodity_name || "").toLowerCase();
    let grain = null;
    if (/corn/.test(name)) grain = "Corn";
    else if (/soy|bean/.test(name)) grain = "Soybeans";
    if (!grain) return;
    const cashPrice = parseFloat(bid.cashPrice || bid.cash_price || bid.price || bid.cash || 0);
    const basis = parseFloat(bid.basis || bid.basisPrice || bid.basis_price || 0) || null;
    const futuresMonth = bid.futuresMonth || bid.futures_month || bid.deliveryMonth || bid.delivery_month || bid.month || null;
    if (!cashPrice || cashPrice < 1) return;
    results.push({ commodity: grain, cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
  });

  return results;
}

// ─── BushelOps parser ────────────────────────────────────────────────────────
function parseBushelOps(data) {
  const results = [];
  const items = Array.isArray(data) ? data : (data?.data || data?.bids || data?.cashBids || []);
  items.forEach(bid => {
    const name = (bid.commodityName || bid.commodity || bid.name || bid.commodity_name || "").toLowerCase();
    let grain = null;
    if (/corn/.test(name)) grain = "Corn";
    else if (/soy|bean/.test(name)) grain = "Soybeans";
    if (!grain) return;
    const cashPrice = parseFloat(bid.cashPrice || bid.cash_price || bid.price || 0);
    const basis = parseFloat(bid.basis || bid.basisPrice || bid.basis_price || 0) || null;
    const futuresMonth = bid.futuresMonth || bid.futures_month || bid.deliveryMonth || null;
    if (!cashPrice || cashPrice < 1) return;
    results.push({ commodity: grain, cashPrice, basis, futuresMonth, rawText: JSON.stringify(bid).slice(0, 200) });
  });
  return results;
}

module.exports = { SCRAPERS };
