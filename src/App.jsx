import { useState, useEffect, useRef } from "react";

const API = `http://${window.location.hostname}:3001`;
const WS  = `ws://${window.location.hostname}:3001`;

const CATEGORIES = ["Plumbing","Electrical","Garden","Cleaning","Repairs","Shopping","Admin","Other"];
const PRIORITIES = ["Low","Medium","High","Urgent"];
const STATUSES   = ["Open","In Progress","Waiting","Resolved"];
const ASSIGNEES  = ["Matt","Dessie","Both","Contractor"];

const PRIORITY_META = {
  Low:    { color:"#34d399", bg:"#022c22" },
  Medium: { color:"#fbbf24", bg:"#1c1400" },
  High:   { color:"#fb923c", bg:"#1f0e00" },
  Urgent: { color:"#f87171", bg:"#200a0a" },
};
const STATUS_META = {
  "Open":        { color:"#60a5fa", bg:"#0c1a2e" },
  "In Progress": { color:"#a78bfa", bg:"#150f2a" },
  "Waiting":     { color:"#fbbf24", bg:"#1c1400" },
  "Resolved":    { color:"#34d399", bg:"#022c22" },
};
const ASSIGNEE_COLOR = { Matt:"#38bdf8", Dessie:"#e879f9", Both:"#a3e635", Contractor:"#fb923c" };

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}) + " " +
    d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
}

function Badge({ text, type }) {
  const m = type==="priority" ? PRIORITY_META[text] : STATUS_META[text];
  if (!m) return null;
  return <span style={{ background:m.bg, color:m.color, border:`1px solid ${m.color}44`, borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{text}</span>;
}

function Pill({ label, active, color, onClick }) {
  return <button onClick={onClick} style={{ background:active?color+"22":"transparent", border:`1px solid ${active?color:"#1e293b"}`, borderRadius:20, padding:"5px 13px", color:active?color:"#475569", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", transition:"all 0.15s" }}>{label}</button>;
}

function NativeSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {label && <label style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:8, color:"#e2e8f0", padding:"10px 12px", fontSize:14, outline:"none", fontFamily:"inherit", WebkitAppearance:"none", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", paddingRight:36 }}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows=4 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {label && <label style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</label>}
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:8, color:"#e2e8f0", padding:"10px 12px", fontSize:14, outline:"none", fontFamily:"inherit", resize:"vertical", lineHeight:1.5 }} />
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {label && <label style={{ fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</label>}
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:8, color:"#e2e8f0", padding:"10px 12px", fontSize:14, outline:"none", fontFamily:"inherit" }} />
    </div>
  );
}

function Btn({ children, onClick, variant="primary", disabled, small }) {
  const s = {
    primary:{ background:"linear-gradient(135deg,#38bdf8,#818cf8)", color:"#fff", border:"none" },
    ghost:  { background:"transparent", color:"#64748b", border:"1px solid #1e293b" },
    danger: { background:"#200a0a", color:"#f87171", border:"1px solid #f8717133" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...s[variant], borderRadius:8, padding:small?"6px 14px":"10px 20px", fontSize:small?12:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit", opacity:disabled?0.4:1, transition:"opacity 0.15s", whiteSpace:"nowrap" }}>{children}</button>;
}

function StatusDot({ connected }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:connected?"#34d399":"#f87171", boxShadow:`0 0 6px ${connected?"#34d399":"#f87171"}` }} />
      <span style={{ fontSize:11, color:connected?"#34d399":"#f87171" }}>{connected?"Live":"Connecting…"}</span>
    </div>
  );
}

function NewTicketSheet({ onClose, onCreate, isMobile }) {
  const [form, setForm] = useState({ title:"", description:"", category:"Other", priority:"Medium", status:"Open", assignee:"Matt" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:isMobile?"18px 18px 0 0":14, padding:isMobile?"24px 20px 36px":"28px 32px", width:isMobile?"100%":540, maxHeight:isMobile?"90vh":"85vh", overflowY:"auto", boxShadow:"0 -10px 60px rgba(0,0,0,0.5)" }}>
        {isMobile && <div style={{ width:36, height:4, background:"#2d3f5a", borderRadius:2, margin:"0 auto 20px" }} />}
        <div style={{ fontSize:17, fontWeight:700, marginBottom:20 }}>New Ticket</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <TextInput label="Title *" value={form.title} onChange={v=>set("title",v)} placeholder="What needs doing?" />
          <TextArea label="Description" value={form.description} onChange={v=>set("description",v)} placeholder="More detail…" rows={3} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <NativeSelect label="Category" value={form.category} onChange={v=>set("category",v)} options={CATEGORIES} />
            <NativeSelect label="Priority" value={form.priority} onChange={v=>set("priority",v)} options={PRIORITIES} />
            <NativeSelect label="Status" value={form.status} onChange={v=>set("status",v)} options={STATUSES} />
            <NativeSelect label="Assign To" value={form.assignee} onChange={v=>set("assignee",v)} options={ASSIGNEES} />
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={submit} disabled={!form.title.trim()||saving}>{saving?"Saving…":"Create Ticket"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onUpdate, onBack, isMobile }) {
  const [updateText, setUpdateText] = useState("");
  const [updateAuthor, setUpdateAuthor] = useState("Matt");
  const [posting, setPosting] = useState(false);

  async function postUpdate() {
    if (!updateText.trim()) return;
    setPosting(true);
    await onUpdate(ticket.id, "addUpdate", { author:updateAuthor, text:updateText });
    setUpdateText("");
    setPosting(false);
  }

  async function patchField(key, value) {
    await onUpdate(ticket.id, "field", { key, value });
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:isMobile?"#0a0f1e":"transparent", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:isMobile?"16px 16px 12px":"20px 24px 16px", borderBottom:"1px solid #1e293b", background:"#0d1526", position:isMobile?"sticky":"relative", top:0, zIndex:10 }}>
        {isMobile && <button onClick={onBack} style={{ background:"none", border:"none", color:"#38bdf8", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, marginBottom:12, padding:0 }}>‹ Back to tickets</button>}
        <div style={{ fontSize:10, color:"#475569", fontFamily:"monospace", marginBottom:4 }}>#{ticket.id} · {ticket.category}</div>
        <div style={{ fontSize:isMobile?16:18, fontWeight:700, color:"#f1f5f9", lineHeight:1.3, marginBottom:8 }}>{ticket.title}</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <Badge text={ticket.priority} type="priority" />
          <Badge text={ticket.status} type="status" />
          <span style={{ fontSize:11, color:ASSIGNEE_COLOR[ticket.assignee]||"#94a3b8", fontWeight:600 }}>→ {ticket.assignee}</span>
        </div>
      </div>

      <div style={{ padding:isMobile?"16px":"20px 24px", display:"flex", flexDirection:"column", gap:20 }}>
        <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontSize:11, color:"#475569", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>Edit Ticket</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <NativeSelect label="Status" value={ticket.status} onChange={v=>patchField("status",v)} options={STATUSES} />
            <NativeSelect label="Priority" value={ticket.priority} onChange={v=>patchField("priority",v)} options={PRIORITIES} />
            <NativeSelect label="Assigned To" value={ticket.assignee} onChange={v=>patchField("assignee",v)} options={ASSIGNEES} />
            <NativeSelect label="Category" value={ticket.category} onChange={v=>patchField("category",v)} options={CATEGORIES} />
          </div>
          <TextArea label="Description" value={ticket.description} onChange={v=>patchField("description",v)} rows={3} />
          <div style={{ fontSize:11, color:"#475569" }}>Created {fmt(ticket.createdAt)}</div>
        </div>

        <div>
          <div style={{ fontSize:11, color:"#475569", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Activity ({ticket.updates.length})</div>
          {ticket.updates.length===0 && <div style={{ fontSize:13, color:"#334155", paddingBottom:10 }}>No updates yet.</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {ticket.updates.map((u,i)=>(
              <div key={i} style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:ASSIGNEE_COLOR[u.author]||"#94a3b8" }}>{u.author}</span>
                  <span style={{ fontSize:10, color:"#475569" }}>{fmt(u.ts)}</span>
                </div>
                <p style={{ fontSize:13, color:"#94a3b8", lineHeight:1.55, margin:0 }}>{u.text}</p>
              </div>
            ))}
          </div>

          <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:11, color:"#475569", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>Add Update</div>
            <div style={{ display:"flex", gap:8 }}>
              {["Matt","Dessie"].map(a=><Btn key={a} small variant={updateAuthor===a?"primary":"ghost"} onClick={()=>setUpdateAuthor(a)}>{a}</Btn>)}
            </div>
            <TextArea value={updateText} onChange={setUpdateText} placeholder="What's the latest update?" rows={3} />
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <Btn onClick={postUpdate} disabled={!updateText.trim()||posting}>{posting?"Posting…":"Post Update"}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileCard({ ticket, onClick }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div onClick={onClick} onTouchStart={()=>setPressed(true)} onTouchEnd={()=>setPressed(false)} style={{ background:pressed?"#1a2540":"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"background 0.1s", WebkitTapHighlightColor:"transparent" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>#{ticket.id}</span>
        <div style={{ display:"flex", gap:5 }}><Badge text={ticket.priority} type="priority" /><Badge text={ticket.status} type="status" /></div>
      </div>
      <div style={{ fontSize:15, fontWeight:600, color:"#f1f5f9", marginBottom:6, lineHeight:1.3 }}>{ticket.title}</div>
      {ticket.description && <div style={{ fontSize:12, color:"#64748b", marginBottom:8, lineHeight:1.4, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{ticket.description}</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:11, color:ASSIGNEE_COLOR[ticket.assignee]||"#94a3b8", fontWeight:600 }}>{ticket.assignee}</span>
        <span style={{ fontSize:10, color:"#334155" }}>{fmt(ticket.createdAt)}</span>
      </div>
      {ticket.updates.length>0 && <div style={{ marginTop:8, fontSize:11, color:"#475569" }}>💬 {ticket.updates.length} update{ticket.updates.length!==1?"s":""}</div>}
    </div>
  );
}

function DesktopRow({ ticket, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} style={{ display:"grid", gridTemplateColumns:"36px 1fr 100px 95px 90px 100px", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer", background:selected?"#111e36":hovered?"#0d1829":"transparent", borderLeft:`3px solid ${selected?"#38bdf8":"transparent"}`, borderBottom:"1px solid #0f1729", transition:"background 0.12s" }}>
      <span style={{ fontSize:10, color:"#334155", fontFamily:"monospace" }}>#{ticket.id}</span>
      <div>
        <div style={{ fontSize:13, color:"#e2e8f0", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ticket.title}</div>
        <div style={{ fontSize:10, color:"#475569" }}>{ticket.category}</div>
      </div>
      <Badge text={ticket.priority} type="priority" />
      <Badge text={ticket.status} type="status" />
      <span style={{ fontSize:11, color:ASSIGNEE_COLOR[ticket.assignee]||"#94a3b8", fontWeight:600 }}>{ticket.assignee}</span>
      <span style={{ fontSize:10, color:"#334155" }}>{fmt(ticket.createdAt).split(" ").slice(0,3).join(" ")}</span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [tickets, setTickets]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [showNew, setShowNew]       = useState(false);
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus]     = useState("Active");
  const [filterPriority, setFilterPriority] = useState("All");
  const [connected, setConnected]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 768);
  const wsRef = useRef(null);

  useEffect(()=>{
    const h = ()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  // WebSocket connection with auto-reconnect
  useEffect(()=>{
    let timeout;
    function connect() {
      const ws = new WebSocket(WS);
      wsRef.current = ws;
      ws.onopen = ()=>setConnected(true);
      ws.onclose = ()=>{ setConnected(false); timeout = setTimeout(connect, 2000); };
      ws.onerror = ()=>ws.close();
      ws.onmessage = (e)=>{
        const msg = JSON.parse(e.data);
        if (msg.type==="INIT") {
          setTickets(msg.tickets);
          setLoading(false);
        } else if (msg.type==="TICKET_CREATED") {
          setTickets(p=>[msg.ticket,...p]);
        } else if (msg.type==="TICKET_UPDATED") {
          setTickets(p=>p.map(t=>t.id===msg.ticket.id?msg.ticket:t));
        } else if (msg.type==="TICKET_DELETED") {
          setTickets(p=>p.filter(t=>t.id!==msg.id));
          setSelected(s=>s===msg.id?null:s);
        }
      };
    }
    connect();
    return ()=>{ clearTimeout(timeout); wsRef.current?.close(); };
  },[]);

  async function handleCreate(form) {
    await fetch(`${API}/api/tickets`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form)
    });
    setShowNew(false);
  }

  async function handleUpdate(id, type, payload) {
    if (type==="field") {
      await fetch(`${API}/api/tickets/${id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ [payload.key]:payload.value })
      });
    } else if (type==="addUpdate") {
      await fetch(`${API}/api/tickets/${id}/updates`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)
      });
    }
  }

  const filtered = tickets.filter(t=>{
    if(filterStatus==="Active"&&t.status==="Resolved") return false;
    if(filterStatus!=="All"&&filterStatus!=="Active"&&t.status!==filterStatus) return false;
    if (filterPriority!=="All"&&t.priority!==filterPriority) return false;
    if (search&&!t.title.toLowerCase().includes(search.toLowerCase())&&
      !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedTicket = tickets.find(t=>t.id===selected);

  const stats = [
    { label:"Open",   val:tickets.filter(t=>t.status==="Open").length,        color:"#60a5fa" },
    { label:"Active", val:tickets.filter(t=>t.status==="In Progress").length,  color:"#a78bfa" },
    { label:"Urgent", val:tickets.filter(t=>t.priority==="Urgent"&&t.status!=="Resolved").length, color:"#f87171" },
    { label:"Done",   val:tickets.filter(t=>t.status==="Resolved").length,     color:"#34d399" },
  ];

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`;

  if (loading) return (
    <div style={{ height:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", flexDirection:"column", gap:12 }}>
      <style>{`${fonts} *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ fontSize:24 }}>🏠</div>
      <div style={{ color:"#475569", fontSize:14 }}>Connecting to HomeDesk…</div>
    </div>
  );

  // ── MOBILE ──────────────────────────────────────────────────────
  if (isMobile) {
    if (selectedTicket) return (
      <div style={{ minHeight:"100vh", background:"#0a0f1e", color:"#e2e8f0", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <style>{`${fonts} *{box-sizing:border-box;margin:0;padding:0} textarea,input{-webkit-appearance:none}`}</style>
        <TicketDetail ticket={selectedTicket} onUpdate={handleUpdate} onBack={()=>setSelected(null)} isMobile />
      </div>
    );
    return (
      <div style={{ minHeight:"100vh", background:"#0a0f1e", color:"#e2e8f0", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <style>{`${fonts} *{box-sizing:border-box;margin:0;padding:0} textarea,input{-webkit-appearance:none}`}</style>
        <div style={{ background:"#0d1526", padding:"14px 16px 12px", borderBottom:"1px solid #1e293b", position:"sticky", top:0, zIndex:50 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#38bdf8,#818cf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏠</div>
              <div>
                <div style={{ fontWeight:700, fontSize:16, lineHeight:1 }}>HomeDesk</div>
                <div style={{ marginTop:3 }}><StatusDot connected={connected} /></div>
              </div>
            </div>
            <button onClick={()=>setShowNew(true)} style={{ background:"linear-gradient(135deg,#38bdf8,#818cf8)", border:"none", borderRadius:20, padding:"8px 16px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>+ New</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
            {stats.map(s=><div key={s.label} style={{ background:"#1a2540", borderRadius:10, padding:"8px 0", textAlign:"center", border:`1px solid ${s.color}22` }}><div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div><div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div></div>)}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search tickets…" style={{ width:"100%", background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:10, color:"#e2e8f0", padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit", WebkitAppearance:"none" }} />
        </div>
        <div style={{ padding:"10px 16px", display:"flex", gap:6, overflowX:"auto", borderBottom:"1px solid #1e293b" }}>
          {["Active","All",...STATUSES].map(s=><Pill key={s} label={s} active={filterStatus===s} color="#60a5fa" onClick={()=>setFilterStatus(s)} />)}
        </div>
        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10, paddingBottom:80 }}>
          {filtered.length===0&&<div style={{ textAlign:"center", color:"#334155", padding:32, fontSize:14 }}>No tickets found</div>}
          {filtered.map(t=><MobileCard key={t.id} ticket={t} onClick={()=>setSelected(t.id)} />)}
        </div>
        {showNew && <NewTicketSheet onClose={()=>setShowNew(false)} onCreate={handleCreate} isMobile />}
      </div>
    );
  }

  // ── DESKTOP ─────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", background:"#080d1a", color:"#e2e8f0", display:"flex", flexDirection:"column", fontFamily:"'DM Sans','Segoe UI',sans-serif", overflow:"hidden" }}>
      <style>{`${fonts} *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#080d1a} ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px} select option{background:#1a2540}`}</style>
      <div style={{ background:"#0d1526", borderBottom:"1px solid #1a2842", padding:"0 24px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,#38bdf8,#818cf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🏠</div>
          <span style={{ fontWeight:700, fontSize:15 }}>HomeDesk</span>
          <span style={{ color:"#1e293b", margin:"0 2px" }}>|</span>
          <span style={{ color:"#475569", fontSize:13 }}>Household Ticket Tracker</span>
          <StatusDot connected={connected} />
        </div>
        <button onClick={()=>setShowNew(true)} style={{ background:"linear-gradient(135deg,#38bdf8,#818cf8)", border:"none", borderRadius:8, padding:"7px 18px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>+ New Ticket</button>
      </div>
      <div style={{ background:"#0d1526", borderBottom:"1px solid #1a2842", padding:"0 24px", display:"flex", gap:24, flexShrink:0 }}>
        {stats.map(s=><div key={s.label} style={{ padding:"9px 0" }}><div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"'DM Mono',monospace" }}>{s.val}</div><div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div></div>)}
      </div>
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        <div style={{ width:selectedTicket?"50%":"100%", display:"flex", flexDirection:"column", borderRight:"1px solid #1a2842", transition:"width 0.2s", flexShrink:0 }}>
          <div style={{ padding:"10px 16px", borderBottom:"1px solid #1a2842", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search…" style={{ flex:1, background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:7, color:"#e2e8f0", padding:"7px 11px", fontSize:12, outline:"none", fontFamily:"inherit" }} />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:7, color:"#94a3b8", padding:"7px 10px", fontSize:12, outline:"none" }}>
              <option>Active</option><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{ background:"#1a2540", border:"1px solid #2d3f5a", borderRadius:7, color:"#94a3b8", padding:"7px 10px", fontSize:12, outline:"none" }}>
              <option>All</option>{PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 100px 95px 90px 100px", gap:12, padding:"6px 16px", fontSize:10, color:"#334155", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", borderBottom:"1px solid #1a2842", flexShrink:0 }}>
            <span>#</span><span>Title</span><span>Priority</span><span>Status</span><span>Assigned</span><span>Date</span>
          </div>
          <div style={{ overflowY:"auto", flex:1 }}>
            {filtered.length===0&&<div style={{ padding:32, textAlign:"center", color:"#334155", fontSize:13 }}>No tickets found</div>}
            {filtered.map(t=><DesktopRow key={t.id} ticket={t} selected={selected===t.id} onClick={()=>setSelected(t.id===selected?null:t.id)} />)}
          </div>
        </div>
        {selectedTicket && (
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"12px 24px 0", display:"flex", justifyContent:"flex-end" }}>
              <Btn small variant="ghost" onClick={()=>setSelected(null)}>✕ Close</Btn>
            </div>
            <TicketDetail ticket={selectedTicket} onUpdate={handleUpdate} isMobile={false} />
          </div>
        )}
      </div>
      {showNew && <NewTicketSheet onClose={()=>setShowNew(false)} onCreate={handleCreate} isMobile={false} />}
    </div>
  );
}
