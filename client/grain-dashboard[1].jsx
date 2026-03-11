import { useState, useEffect, useCallback } from "react";

// ─── CONFIG — swap in your Railway URL ───────────────────────────────────────
const API_BASE = "https://your-grain-scraper.up.railway.app"; // ← update this

const GRAIN_COLORS = { Corn: "#f59e0b", Soybeans: "#84cc16" };
const GRAINS = ["Corn", "Soybeans"];
const CONTRACT_TYPES = ["Cash Sale", "Futures Contract", "Basis Contract", "Put Option", "Call Option"];
const MONTHS = ["Jan 25","Feb 25","Mar 25","Apr 25","May 25","Jun 25","Jul 25","Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Mar 26","May 26","Jul 26","Sep 26","Nov 26","Dec 26"];
const STATUS_OPTIONS = ["Open", "Delivered", "Expired", "Exercised", "Cancelled"];

const typeColors = {
  "Cash Sale":        { bg:"rgba(34,197,94,0.15)",  border:"#22c55e", text:"#4ade80" },
  "Futures Contract": { bg:"rgba(59,130,246,0.15)", border:"#3b82f6", text:"#60a5fa" },
  "Basis Contract":   { bg:"rgba(251,191,36,0.15)", border:"#fbbf24", text:"#fcd34d" },
  "Put Option":       { bg:"rgba(239,68,68,0.15)",  border:"#ef4444", text:"#f87171" },
  "Call Option":      { bg:"rgba(168,85,247,0.15)", border:"#a855f7", text:"#c084fc" },
};
const statusColors = { "Open":"#fbbf24","Delivered":"#22c55e","Expired":"#6b7280","Exercised":"#3b82f6","Cancelled":"#ef4444" };

const initialSales = [
  { id:1, type:"Cash Sale",       grain:"Corn",     bushels:10000, price:4.48,  basis:null,  strikePrice:null, premium:null, futuresMonth:"Mar 25", date:"2025-03-01", elevator:"Central United — Litchfield", notes:"Bin 3 corn", status:"Delivered" },
  { id:2, type:"Basis Contract",  grain:"Soybeans", bushels:5000,  price:null,  basis:-0.38, strikePrice:null, premium:null, futuresMonth:"Nov 25", date:"2025-02-14", elevator:"CHS Mankato",                 notes:"Set basis, futures open", status:"Open" },
  { id:3, type:"Futures Contract",grain:"Corn",     bushels:25000, price:4.72,  basis:null,  strikePrice:null, premium:null, futuresMonth:"Dec 25", date:"2025-01-20", elevator:"CBOT",                         notes:"5 contracts @ 5000 bu", status:"Open" },
  { id:4, type:"Put Option",      grain:"Soybeans", bushels:25000, price:null,  basis:null,  strikePrice:10.00, premium:0.28, futuresMonth:"Nov 25", date:"2025-02-01", elevator:"CBOT",                        notes:"Floor price protection", status:"Open" },
];

const fmt2    = n => n != null ? "$" + parseFloat(n).toFixed(2) : "—";
const fmtBasis = b => b != null ? (b >= 0 ? "+" : "") + parseFloat(b).toFixed(2) : "—";

const inputSt = { width:"100%", background:"#0a130a", border:"1px solid #2a3d2a", borderRadius:8, padding:"10px 12px", color:"#e8f5e9", fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"'IBM Plex Mono',monospace" };
const labelSt = { display:"block", color:"#6aa87a", fontSize:12, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" };

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#0f1a0f",border:"1px solid #2a3d2a",borderRadius:16,padding:32,minWidth:480,maxWidth:620,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
          <h3 style={{ margin:0,color:"#e8f5e9",fontSize:20,fontFamily:"'Playfair Display',serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#4a7c59",cursor:"pointer",fontSize:22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaleModal({ existing, onSave, onClose }) {
  const blank = { type:"Cash Sale",grain:"Corn",bushels:"",price:"",basis:"",strikePrice:"",premium:"",futuresMonth:"Nov 25",date:new Date().toISOString().slice(0,10),elevator:"",notes:"",status:"Open" };
  const [form,setForm] = useState(existing
    ? { ...existing, bushels:String(existing.bushels||""), price:existing.price!=null?String(existing.price):"", basis:existing.basis!=null?String(existing.basis):"", strikePrice:existing.strikePrice!=null?String(existing.strikePrice):"", premium:existing.premium!=null?String(existing.premium):"" }
    : blank);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isOption = form.type==="Put Option"||form.type==="Call Option";
  const isBasis  = form.type==="Basis Contract";
  const save = () => onSave({ ...form, id:existing?.id??Date.now(), bushels:parseFloat(form.bushels)||0, price:form.price!==""?parseFloat(form.price):null, basis:form.basis!==""?parseFloat(form.basis):null, strikePrice:form.strikePrice!==""?parseFloat(form.strikePrice):null, premium:form.premium!==""?parseFloat(form.premium):null });
  return (
    <Modal title={existing?"Edit Contract":"Add Contract"} onClose={onClose}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <div style={{ marginBottom:4 }}><label style={labelSt}>Type</label><select value={form.type} onChange={e=>set("type",e.target.value)} style={inputSt}>{CONTRACT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div style={{ marginBottom:4 }}><label style={labelSt}>Grain</label><select value={form.grain} onChange={e=>set("grain",e.target.value)} style={inputSt}>{GRAINS.map(g=><option key={g}>{g}</option>)}</select></div>
        <div style={{ marginBottom:4 }}><label style={labelSt}>Bushels</label><input type="number" value={form.bushels} onChange={e=>set("bushels",e.target.value)} style={inputSt} placeholder="10000" /></div>
        <div style={{ marginBottom:4 }}><label style={labelSt}>Date</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={inputSt} /></div>
        {!isOption&&!isBasis&&<div style={{ marginBottom:4 }}><label style={labelSt}>Price ($/bu)</label><input type="number" step="0.01" value={form.price} onChange={e=>set("price",e.target.value)} style={inputSt} placeholder="4.52" /></div>}
        {(isBasis||form.type==="Futures Contract")&&<div style={{ marginBottom:4 }}><label style={labelSt}>Basis</label><input type="number" step="0.01" value={form.basis} onChange={e=>set("basis",e.target.value)} style={inputSt} placeholder="-0.35" /></div>}
        {isOption&&<><div style={{ marginBottom:4 }}><label style={labelSt}>Strike ($/bu)</label><input type="number" step="0.01" value={form.strikePrice} onChange={e=>set("strikePrice",e.target.value)} style={inputSt} /></div><div style={{ marginBottom:4 }}><label style={labelSt}>Premium ($/bu)</label><input type="number" step="0.01" value={form.premium} onChange={e=>set("premium",e.target.value)} style={inputSt} /></div></>}
        <div style={{ marginBottom:4 }}><label style={labelSt}>Futures Month</label><select value={form.futuresMonth} onChange={e=>set("futuresMonth",e.target.value)} style={inputSt}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select></div>
        <div style={{ marginBottom:4 }}><label style={labelSt}>Status</label><select value={form.status} onChange={e=>set("status",e.target.value)} style={inputSt}>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div style={{ marginBottom:4,gridColumn:"1/-1" }}><label style={labelSt}>Elevator</label><input value={form.elevator} onChange={e=>set("elevator",e.target.value)} style={inputSt} placeholder="Central United — Litchfield" /></div>
        <div style={{ marginBottom:4,gridColumn:"1/-1" }}><label style={labelSt}>Notes</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ ...inputSt,minHeight:56,resize:"vertical" }} /></div>
      </div>
      <div style={{ display:"flex",gap:12,marginTop:12 }}>
        <button onClick={save} style={{ flex:1,padding:"12px 0",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace" }}>{existing?"Save Changes":"Add Contract"}</button>
        <button onClick={onClose} style={{ padding:"12px 20px",background:"transparent",border:"1px solid #2a3d2a",borderRadius:10,color:"#6aa87a",cursor:"pointer" }}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function GrainDashboard() {
  const [tab,setTab]                   = useState("prices");
  const [sales,setSales]               = useState(initialSales);
  const [saleModal,setSaleModal]       = useState(null);
  const [filterGrain,setFilterGrain]   = useState("All");
  const [filterType,setFilterType]     = useState("All");
  const [toast,setToast]               = useState(null);
  const [prices,setPrices]             = useState([]);
  const [scraperStatus,setScraperStatus] = useState([]);
  const [scraping,setScraping]         = useState(false);
  const [lastRefresh,setLastRefresh]   = useState(null);
  const [apiError,setApiError]         = useState(null);
  const [basisInputs,setBasisInputs]   = useState({ Corn:-0.35, Soybeans:-0.40 });

  const showToast = (msg,color="#22c55e") => { setToast({msg,color}); setTimeout(()=>setToast(null),3500); };

  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/prices`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPrices(d.prices||[]);
      setLastRefresh(new Date());
      setApiError(null);
    } catch(e) { setApiError(e.message); }
  },[]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/scrape/status`);
      if (!r.ok) return;
      const d = await r.json();
      setScraperStatus(d.sources||[]);
    } catch(_){}
  },[]);

  useEffect(()=>{
    fetchPrices(); fetchStatus();
    const iv = setInterval(fetchPrices, 5*60*1000);
    return ()=>clearInterval(iv);
  },[fetchPrices,fetchStatus]);

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const r = await fetch(`${API_BASE}/scrape`,{ method:"POST",headers:{"Content-Type":"application/json"},body:"{}" });
      const d = await r.json();
      const ok = d.results?.filter(x=>x.success).length||0;
      showToast(`✓ Scraped ${ok}/${d.results?.length||0} sources`);
      await fetchPrices();
    } catch(e){ showToast("Scrape failed: "+e.message,"#ef4444"); }
    setScraping(false);
  };

  const handleScrapeOne = async (scraperId,name) => {
    setScraping(true);
    try {
      const r = await fetch(`${API_BASE}/scrape`,{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scraperId}) });
      const d = await r.json();
      showToast(d.success?`✓ ${name} refreshed`:`✗ ${name}: ${d.error}`, d.success?"#22c55e":"#ef4444");
      await fetchPrices();
    } catch(e){ showToast("Error: "+e.message,"#ef4444"); }
    setScraping(false);
  };

  const saveSale = entry => { setSales(s=>saleModal!=="new"?s.map(x=>x.id===entry.id?entry:x):[...s,entry]); setSaleModal(null); showToast(saleModal!=="new"?"✓ Contract updated":"✓ Contract added"); };
  const deleteSale = id => { setSales(s=>s.filter(x=>x.id!==id)); showToast("Removed","#ef4444"); };

  const latestPrice = grain => prices.find(p=>p.grain===grain&&p.cash_price);
  const cornBid  = latestPrice("Corn");
  const soyBid   = latestPrice("Soybeans");
  const filteredSales = sales.filter(s=>(filterGrain==="All"||s.grain===filterGrain)&&(filterType==="All"||s.type===filterType));
  const totalCorn = sales.filter(s=>s.grain==="Corn"&&s.status!=="Cancelled").reduce((a,s)=>a+(s.bushels||0),0);
  const openCount = sales.filter(s=>s.status==="Open").length;

  const defaultSources = [
    { id:"ufc_litchfield",name:"Central United — Litchfield",location:"Litchfield, MN",grains:["Corn","Soybeans"],url:"https://www.ufcmn.com/home/#cash-bids-futures",lastScrape:null },
    { id:"ufc_brownton",  name:"Central United — Brownton",  location:"Brownton, MN",  grains:["Corn","Soybeans"],url:"https://www.ufcmn.com/home/#cash-bids-futures",lastScrape:null },
    { id:"bushmills",     name:"Bushmills Ethanol",           location:"Atwater, MN",   grains:["Corn"],           url:"https://bushmillsethanol.com/corn-procurement-and-bids/",lastScrape:null },
    { id:"chs_mankato",   name:"CHS — Mankato",              location:"Mankato, MN",   grains:["Corn","Soybeans"],url:"https://chsag.com/grain/cash-bids/",lastScrape:null },
  ];
  const displaySources = scraperStatus.length > 0 ? scraperStatus : defaultSources;

  const tabs = [{id:"prices",label:"📡 Live Prices"},{id:"tracker",label:"📋 Sales & Contracts"},{id:"basis",label:"📊 Basis Tracker"}];

  return (
    <div style={{ minHeight:"100vh",background:"#060d06",fontFamily:"'IBM Plex Mono',monospace",color:"#e8f5e9" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a130a}::-webkit-scrollbar-thumb{background:#2a3d2a;border-radius:3px}
        select option{background:#0f1a0f}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6)}
      `}</style>

      {toast&&<div style={{ position:"fixed",top:24,right:24,zIndex:9999,background:"#0f1a0f",border:`1px solid ${toast.color}`,borderRadius:10,padding:"12px 20px",color:toast.color,fontSize:14,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",animation:"slideIn 0.3s ease" }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ borderBottom:"1px solid #1a2e1a",padding:"18px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ width:34,height:34,borderRadius:8,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🌽</div>
          <div>
            <div style={{ fontSize:17,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#e8f5e9" }}>Grain Marketing Desk</div>
            <div style={{ fontSize:10,color:"#4a7c59",letterSpacing:"0.1em",textTransform:"uppercase" }}>Corn · Soybeans · West Central MN</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:6 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 16px",borderRadius:8,border:"1px solid",borderColor:tab===t.id?"#22c55e":"#1a2e1a",background:tab===t.id?"rgba(34,197,94,0.12)":"transparent",color:tab===t.id?"#4ade80":"#4a7c59",cursor:"pointer",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",transition:"all 0.2s" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#1a2e1a",borderBottom:"1px solid #1a2e1a" }}>
        {[
          { label:"Corn Cash Bid",    value:cornBid?fmt2(cornBid.cash_price):"—",    sub:cornBid?`Basis ${fmtBasis(cornBid.basis)} · ${cornBid.source_name}`:"Waiting for scrape",    color:GRAIN_COLORS.Corn },
          { label:"Soybean Cash Bid", value:soyBid ?fmt2(soyBid.cash_price) :"—",    sub:soyBid ?`Basis ${fmtBasis(soyBid.basis)} · ${soyBid.source_name}` :"Waiting for scrape",    color:GRAIN_COLORS.Soybeans },
          { label:"Corn Contracted",  value:totalCorn.toLocaleString()+" bu",         sub:cornBid?`~$${(totalCorn*(cornBid.cash_price||0)/1000).toFixed(0)}K est.`:"",              color:"#22c55e" },
          { label:"Open Positions",   value:openCount,                                sub:`${sales.length} total contracts`,                                                          color:"#fbbf24" },
        ].map((s,i)=>(
          <div key={i} style={{ background:"#060d06",padding:"14px 22px" }}>
            <div style={{ fontSize:10,color:"#4a7c59",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:22,fontWeight:700,color:s.color,fontFamily:"'Playfair Display',serif" }}>{s.value}</div>
            <div style={{ fontSize:11,color:"#2a5a3a",marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:"24px 28px" }}>

        {/* ══ PRICES ════════════════════════════════════════════════════ */}
        {tab==="prices"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
              <div>
                <h2 style={{ margin:0,fontSize:20,fontFamily:"'Playfair Display',serif" }}>Live Elevator Bids</h2>
                <p style={{ margin:"4px 0 0",color:"#4a7c59",fontSize:12 }}>{lastRefresh?`Last refreshed ${lastRefresh.toLocaleTimeString()}`:"Not yet fetched"} · Auto-refreshes every 5 min</p>
              </div>
              <button onClick={handleScrapeAll} disabled={scraping} style={{ padding:"10px 20px",background:scraping?"#1a2e1a":"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:10,color:"#fff",fontWeight:600,cursor:scraping?"not-allowed":"pointer",fontSize:13,fontFamily:"'IBM Plex Mono',monospace",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ display:"inline-block",animation:scraping?"spin 1s linear infinite":"none" }}>⟳</span>
                {scraping?"Scraping...":"Scrape All Now"}
              </button>
            </div>

            {apiError&&(
              <div style={{ marginBottom:18,padding:"14px 18px",background:"rgba(239,68,68,0.08)",border:"1px solid #7f1d1d",borderRadius:12,fontSize:13,color:"#f87171" }}>
                ⚠ Cannot reach scraper backend: <strong>{apiError}</strong>
                <div style={{ marginTop:6,color:"#9ca3af",fontSize:12 }}>Deploy the Railway backend and update <code style={{ color:"#fbbf24" }}>API_BASE</code> at the top of this file.</div>
              </div>
            )}

            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,marginBottom:22 }}>
              {displaySources.map(src=>{
                const srcPrices = prices.filter(p=>p.scraper_id===src.id);
                return (
                  <div key={src.id} style={{ background:"#0a130a",border:"1px solid #1e3a1e",borderRadius:14,padding:20 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:11,color:"#4a7c59",marginBottom:3 }}>{src.location}</div>
                        <div style={{ fontSize:15,color:"#e8f5e9",fontWeight:600 }}>{src.name}</div>
                        <div style={{ display:"flex",gap:6,marginTop:6 }}>
                          {src.grains?.map(g=><span key={g} style={{ fontSize:11,padding:"2px 8px",borderRadius:10,background:`${GRAIN_COLORS[g]}22`,border:`1px solid ${GRAIN_COLORS[g]}55`,color:GRAIN_COLORS[g] }}>{g}</span>)}
                        </div>
                      </div>
                      <button onClick={()=>handleScrapeOne(src.id,src.name)} disabled={scraping} style={{ background:"none",border:"1px solid #2a3d2a",borderRadius:8,color:"#4a7c59",padding:"5px 12px",cursor:"pointer",fontSize:12 }}>↻</button>
                    </div>
                    {srcPrices.length>0?(
                      <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(srcPrices.length,2)},1fr)`,gap:10 }}>
                        {srcPrices.map(p=>(
                          <div key={p.id} style={{ textAlign:"center",padding:"10px 8px",background:"#060d06",borderRadius:10,border:"1px solid #1a2e1a" }}>
                            <div style={{ fontSize:10,color:GRAIN_COLORS[p.grain]||"#6aa87a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4 }}>{p.grain}</div>
                            <div style={{ fontSize:22,fontFamily:"'Playfair Display',serif",fontWeight:700,color:"#e8f5e9" }}>{fmt2(p.cash_price)}</div>
                            <div style={{ fontSize:12,color:p.basis<0?"#f87171":"#4ade80",marginTop:3 }}>Basis {fmtBasis(p.basis)}</div>
                            {p.futures_month&&<div style={{ fontSize:10,color:"#2a5a3a",marginTop:2 }}>{p.futures_month}</div>}
                          </div>
                        ))}
                      </div>
                    ):(
                      <div style={{ padding:"14px",background:"rgba(251,191,36,0.04)",border:"1px dashed #3a3000",borderRadius:10,fontSize:12,color:"#78716c",textAlign:"center" }}>
                        {apiError?"Backend offline — deploy Railway service":"No data yet — click ↻ to refresh"}
                      </div>
                    )}
                    {src.lastScrape&&<div style={{ marginTop:10,fontSize:11,color:"#2a3d2a" }}>Updated: {new Date(src.lastScrape).toLocaleTimeString()}</div>}
                  </div>
                );
              })}
            </div>

            {prices.length>0&&(
              <div>
                <h3 style={{ fontSize:14,color:"#4a7c59",margin:"0 0 10px",fontFamily:"'Playfair Display',serif" }}>All Live Bids</h3>
                <div style={{ background:"#0a130a",border:"1px solid #1a2e1a",borderRadius:12,overflow:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",minWidth:600 }}>
                    <thead><tr style={{ borderBottom:"1px solid #1a2e1a" }}>
                      {["Source","Location","Grain","Cash","Basis","Month","Time"].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:10,color:"#4a7c59",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {prices.map((p,i)=>(
                        <tr key={p.id||i} style={{ borderBottom:"1px solid #0f1a0f",background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                          <td style={{ padding:"11px 14px",color:"#c8e6c9",fontSize:13 }}>{p.source_name}</td>
                          <td style={{ padding:"11px 14px",color:"#4a7c59",fontSize:12 }}>{p.location}</td>
                          <td style={{ padding:"11px 14px",color:GRAIN_COLORS[p.grain]||"#e8f5e9",fontSize:13,fontWeight:600 }}>{p.grain}</td>
                          <td style={{ padding:"11px 14px",color:"#e8f5e9",fontSize:15,fontFamily:"'Playfair Display',serif",fontWeight:700 }}>{fmt2(p.cash_price)}</td>
                          <td style={{ padding:"11px 14px",color:p.basis<0?"#f87171":"#4ade80",fontSize:13 }}>{fmtBasis(p.basis)}</td>
                          <td style={{ padding:"11px 14px",color:"#6aa87a",fontSize:12 }}>{p.futures_month||"—"}</td>
                          <td style={{ padding:"11px 14px",color:"#2a3d2a",fontSize:11 }}>{p.scraped_at?new Date(p.scraped_at).toLocaleTimeString():"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop:18,padding:16,background:"#0a130a",border:"1px solid #1a2e1a",borderRadius:12 }}>
              <div style={{ fontSize:12,color:"#4a7c59",marginBottom:6 }}>📌 Architecture</div>
              <div style={{ fontSize:12,color:"#2a5a2a",lineHeight:1.8 }}>
                Railway backend → <strong style={{ color:"#4a7c59" }}>Puppeteer headless Chrome</strong> renders each elevator site, waits for DTN/JS price widgets, extracts bids → stored in <code style={{ color:"#fbbf24" }}>grain_prices</code> Supabase table → this dashboard reads via REST. Auto-scrapes every 30 min weekdays 7am–5pm CT.
              </div>
            </div>
          </div>
        )}

        {/* ══ TRACKER ═══════════════════════════════════════════════════ */}
        {tab==="tracker"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
              <div>
                <h2 style={{ margin:0,fontSize:20,fontFamily:"'Playfair Display',serif" }}>Sales & Contracts</h2>
                <p style={{ margin:"4px 0 0",color:"#4a7c59",fontSize:12 }}>{filteredSales.length} positions shown</p>
              </div>
              <button onClick={()=>setSaleModal("new")} style={{ padding:"10px 20px",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace" }}>+ Add Contract</button>
            </div>

            <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
              {["All","Corn","Soybeans"].map(g=><button key={g} onClick={()=>setFilterGrain(g)} style={{ padding:"5px 14px",borderRadius:20,border:"1px solid",borderColor:filterGrain===g?(GRAIN_COLORS[g]||"#22c55e"):"#1a2e1a",background:filterGrain===g?"rgba(34,197,94,0.1)":"transparent",color:filterGrain===g?(GRAIN_COLORS[g]||"#4ade80"):"#4a7c59",cursor:"pointer",fontSize:12,fontFamily:"'IBM Plex Mono',monospace" }}>{g}</button>)}
              <div style={{ width:1,background:"#1a2e1a",margin:"0 2px" }} />
              {["All",...CONTRACT_TYPES].map(t=>{const tc=typeColors[t]||{};return <button key={t} onClick={()=>setFilterType(t)} style={{ padding:"5px 14px",borderRadius:20,border:"1px solid",borderColor:filterType===t?(tc.border||"#22c55e"):"#1a2e1a",background:filterType===t?(tc.bg||"rgba(34,197,94,0.1)"):"transparent",color:filterType===t?(tc.text||"#4ade80"):"#4a7c59",cursor:"pointer",fontSize:12,fontFamily:"'IBM Plex Mono',monospace" }}>{t}</button>;})}
            </div>

            <div style={{ background:"#0a130a",border:"1px solid #1a2e1a",borderRadius:14,overflow:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",minWidth:750 }}>
                <thead><tr style={{ borderBottom:"1px solid #1a2e1a" }}>
                  {["Type","Grain","Bushels","Price/Strike","Basis","Month","Elevator","Status",""].map(h=><th key={h} style={{ padding:"11px 14px",textAlign:"left",fontSize:10,color:"#4a7c59",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,whiteSpace:"nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredSales.map((s,i)=>{
                    const tc=typeColors[s.type]||{};
                    return (
                      <tr key={s.id} style={{ borderBottom:"1px solid #0f1a0f",background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                        <td style={{ padding:"12px 14px" }}><span style={{ padding:"3px 10px",borderRadius:20,background:tc.bg,border:`1px solid ${tc.border}`,color:tc.text,fontSize:11,whiteSpace:"nowrap" }}>{s.type}</span></td>
                        <td style={{ padding:"12px 14px",color:GRAIN_COLORS[s.grain],fontSize:13,fontWeight:600 }}>{s.grain}</td>
                        <td style={{ padding:"12px 14px",color:"#c8e6c9",fontSize:13 }}>{s.bushels?.toLocaleString()}</td>
                        <td style={{ padding:"12px 14px",color:"#e8f5e9",fontSize:13,fontFamily:"'Playfair Display',serif" }}>{s.strikePrice!=null?`${fmt2(s.strikePrice)}${s.premium!=null?` (−${parseFloat(s.premium).toFixed(2)} prem)`:""}`:fmt2(s.price)}</td>
                        <td style={{ padding:"12px 14px",color:s.basis!=null?(s.basis<0?"#f87171":"#4ade80"):"#2a3d2a",fontSize:13 }}>{fmtBasis(s.basis)}</td>
                        <td style={{ padding:"12px 14px",color:"#6aa87a",fontSize:12,whiteSpace:"nowrap" }}>{s.futuresMonth||"—"}</td>
                        <td style={{ padding:"12px 14px",color:"#4a7c59",fontSize:12,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.elevator}</td>
                        <td style={{ padding:"12px 14px" }}><span style={{ padding:"3px 10px",borderRadius:20,border:`1px solid ${statusColors[s.status]}`,color:statusColors[s.status],fontSize:11 }}>{s.status}</span></td>
                        <td style={{ padding:"12px 10px" }}>
                          <div style={{ display:"flex",gap:5 }}>
                            <button onClick={()=>setSaleModal(s)} style={{ background:"none",border:"1px solid #2a3d2a",borderRadius:6,color:"#4a7c59",padding:"3px 10px",cursor:"pointer",fontSize:11 }}>Edit</button>
                            <button onClick={()=>deleteSale(s.id)} style={{ background:"none",border:"1px solid #2a1414",borderRadius:6,color:"#7c4a4a",padding:"3px 8px",cursor:"pointer",fontSize:11 }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSales.length===0&&<tr><td colSpan={9} style={{ padding:36,textAlign:"center",color:"#2a3d2a",fontSize:12 }}>No contracts found.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginTop:14 }}>
              {GRAINS.map(g=>{
                const gs=filteredSales.filter(s=>s.grain===g&&s.status!=="Cancelled");
                const total=gs.reduce((a,s)=>a+(s.bushels||0),0);
                const priced=gs.filter(s=>s.price);
                const avg=priced.length?(priced.reduce((a,s)=>a+s.price*s.bushels,0)/priced.reduce((a,s)=>a+s.bushels,0)).toFixed(2):null;
                return <div key={g} style={{ background:"#0a130a",border:"1px solid #1a2e1a",borderRadius:12,padding:16 }}><div style={{ color:GRAIN_COLORS[g],fontSize:11,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.08em" }}>{g}</div><div style={{ color:"#e8f5e9",fontSize:20,fontFamily:"'Playfair Display',serif",fontWeight:700 }}>{total.toLocaleString()} bu</div><div style={{ color:"#4a7c59",fontSize:12,marginTop:3 }}>Avg: {avg?`$${avg}`:"—"}</div></div>;
              })}
            </div>
          </div>
        )}

        {/* ══ BASIS ════════════════════════════════════════════════════ */}
        {tab==="basis"&&(
          <div>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ margin:"0 0 4px",fontSize:20,fontFamily:"'Playfair Display',serif" }}>Basis Tracker</h2>
              <p style={{ margin:0,color:"#4a7c59",fontSize:12 }}>Cash = Futures + Basis. Compare locked basis contracts against live elevator bids.</p>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:24 }}>
              {GRAINS.map(grain=>{
                const liveBid=prices.find(p=>p.grain===grain&&p.cash_price);
                const futures=liveBid?.cash_price?(liveBid.cash_price-(liveBid.basis||0)):null;
                const basis=basisInputs[grain];
                const cash=futures?futures+basis:null;
                return (
                  <div key={grain} style={{ background:"#0a130a",border:`1px solid ${GRAIN_COLORS[grain]}33`,borderRadius:16,padding:22 }}>
                    <div style={{ color:GRAIN_COLORS[grain],fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16 }}>{grain}</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:16 }}>
                      {[{label:"Futures",val:futures?fmt2(futures):"—"},{label:"My Basis",val:(basis>=0?"+":"")+basis.toFixed(2)},{label:"Cash Price",val:cash?fmt2(cash):"—",hi:true}].map(item=>(
                        <div key={item.label} style={{ textAlign:"center" }}>
                          <div style={{ fontSize:10,color:"#4a7c59",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5 }}>{item.label}</div>
                          <div style={{ fontSize:20,fontFamily:"'Playfair Display',serif",fontWeight:700,color:item.hi?GRAIN_COLORS[grain]:"#e8f5e9" }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    {liveBid&&<div style={{ fontSize:11,color:"#2a5a3a",marginBottom:10 }}>Live: {liveBid.source_name} — Cash {fmt2(liveBid.cash_price)} / Basis {fmtBasis(liveBid.basis)}</div>}
                    <div><label style={labelSt}>Adjust Local Basis</label><input type="number" step="0.01" value={basisInputs[grain]} onChange={e=>setBasisInputs(b=>({...b,[grain]:parseFloat(e.target.value)||0}))} style={inputSt} /></div>
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize:15,color:"#e8f5e9",margin:"0 0 12px",fontFamily:"'Playfair Display',serif" }}>Open Basis Positions</h3>
            <div style={{ background:"#0a130a",border:"1px solid #1a2e1a",borderRadius:14,overflow:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",minWidth:700 }}>
                <thead><tr style={{ borderBottom:"1px solid #1a2e1a" }}>
                  {["Grain","Bushels","Locked Basis","Month","Elevator","Target Cash","Current Cash","Δ P&L","Status"].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:10,color:"#4a7c59",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,whiteSpace:"nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sales.filter(s=>s.basis!=null&&s.type!=="Cash Sale").map((s,i)=>{
                    const liveBid=prices.find(p=>p.grain===s.grain&&p.cash_price);
                    const liveFutures=liveBid?liveBid.cash_price-(liveBid.basis||0):null;
                    const targetCash=liveFutures?liveFutures+s.basis:null;
                    const currentCash=liveBid?.cash_price||null;
                    const delta=(targetCash&&currentCash)?((targetCash-currentCash)*s.bushels):null;
                    return (
                      <tr key={s.id} style={{ borderBottom:"1px solid #0f1a0f",background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                        <td style={{ padding:"12px 14px",color:GRAIN_COLORS[s.grain],fontWeight:600,fontSize:13 }}>{s.grain}</td>
                        <td style={{ padding:"12px 14px",color:"#c8e6c9",fontSize:13 }}>{s.bushels?.toLocaleString()}</td>
                        <td style={{ padding:"12px 14px",fontSize:16,fontFamily:"'Playfair Display',serif",color:s.basis<0?"#f87171":"#4ade80" }}>{fmtBasis(s.basis)}</td>
                        <td style={{ padding:"12px 14px",color:"#6aa87a",fontSize:12 }}>{s.futuresMonth}</td>
                        <td style={{ padding:"12px 14px",color:"#4a7c59",fontSize:12 }}>{s.elevator}</td>
                        <td style={{ padding:"12px 14px",color:"#fbbf24",fontSize:15,fontFamily:"'Playfair Display',serif",fontWeight:700 }}>{targetCash?fmt2(targetCash):"—"}</td>
                        <td style={{ padding:"12px 14px",color:"#c8e6c9",fontSize:14,fontFamily:"'Playfair Display',serif" }}>{currentCash?fmt2(currentCash):"—"}</td>
                        <td style={{ padding:"12px 14px",color:delta==null?"#2a3d2a":delta>=0?"#4ade80":"#f87171",fontSize:13,fontWeight:600 }}>{delta!=null?(delta>=0?"+":"")+`$${(delta/1000).toFixed(1)}K`:"—"}</td>
                        <td style={{ padding:"12px 14px" }}><span style={{ padding:"3px 10px",borderRadius:20,border:`1px solid ${statusColors[s.status]}`,color:statusColors[s.status],fontSize:11 }}>{s.status}</span></td>
                      </tr>
                    );
                  })}
                  {sales.filter(s=>s.basis!=null&&s.type!=="Cash Sale").length===0&&<tr><td colSpan={9} style={{ padding:32,textAlign:"center",color:"#2a3d2a",fontSize:12 }}>No basis positions yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {saleModal&&<SaleModal existing={saleModal!=="new"?saleModal:null} onSave={saveSale} onClose={()=>setSaleModal(null)} />}
    </div>
  );
}
