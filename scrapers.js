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
        const locs = [...new Set(data.map(b => b.location?.name).filter(Boolean))];
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
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 Chrome/120",
            "Referer": "https://bushmillsethanol.com/",
            "Origin": "https://bushmillsethanol.com",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );
      const text = await res.text();
      console.log("Bushmills status:", res.status);
      console.log("Bushmills first 300:", text.slice(0, 300));
      try {
        const data = JSON.parse(text);
        const results = [];
        const bids = Array.isArray(data) ? data
          : (data?.cash_bids || data?.bids || data?.data || data?.cashBids || []);
        console.log("Bushmills bid count:", bids.length);
        if (bids.length > 0) console.log("Bushmills first bid:", JSON.stringify(bids[0]).slice(0, 200));
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
    url: "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
    location: "Mankato, MN",
    grains: ["Corn", "Soybeans"],
    scrape: async () => {
      const res = await fetch(
        "https://futures.bushelops.com/api/v1/cash-bids?location-remote-ids=SAV%2CWINN%2CKASS%2CCTMN%2COSTR%2CWYKO%2CSANS%2CMKTO%2CFMNT%2CCOMS",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120",
            "Accept": "application/json",
            "Referer": "https://chsag.com/",
            "Origin": "https://chsag.com",
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

// ─── DTN parser — location is a nested object ─────────────────────────────────
function parseDTN(data, locationFilter) {
  const results = [];
  if (!Array.isArray(data)) return results;

  data.forEach(bid => {
    const locName = (bid.location?.name || "").toLowerCase();
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
  const locations = data?.data || [];

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
