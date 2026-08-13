import express from "express";
import Database from "better-sqlite3";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(cors());
app.use(express.json());

// ── Database setup ────────────────────────────────────────────────
const db = new Database("homedesk.db");

db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'Other',
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'To Do',
  assignee TEXT DEFAULT 'Matt',
  scheduledDate TEXT DEFAULT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticketId INTEGER NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  ts TEXT NOT NULL,
  FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
);
`);

// Safe migration for existing databases
try {
  db.exec(`ALTER TABLE tickets ADD COLUMN scheduledDate TEXT DEFAULT NULL`);
} catch (_) {
  // Column already exists — safe to ignore
}

// Migrate old status names to new Kanban-style names
try {
  db.exec(`UPDATE tickets SET status = 'To Do' WHERE status = 'Open'`);
  db.exec(`UPDATE tickets SET status = 'Waiting for Vendor' WHERE status = 'Waiting'`);
  db.exec(`UPDATE tickets SET status = 'Done' WHERE status = 'Resolved'`);
} catch (_) {}

// ── Helpers ───────────────────────────────────────────────────────
function getTickets() {
  const tickets = db.prepare("SELECT * FROM tickets ORDER BY createdAt DESC").all();
  const getUpdates = db.prepare("SELECT * FROM updates WHERE ticketId = ? ORDER BY ts ASC");
  return tickets.map(t => ({ ...t, updates: getUpdates.all(t.id) }));
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ── Static frontend ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));

// ── Routes ────────────────────────────────────────────────────────

app.get("/api/tickets", (req, res) => {
  res.json(getTickets());
});

app.post("/api/tickets", (req, res) => {
  const { title, description, category, priority, status, assignee, scheduledDate } = req.body;
  const createdAt = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO tickets (title, description, category, priority, status, assignee, scheduledDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    title,
    description || "",
    category || "Other",
    priority || "Medium",
    status || "To Do",
    assignee || "Matt",
    scheduledDate || null,
    createdAt
  );

  const ticket = {
    ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid),
    updates: []
  };
  broadcast({ type: "TICKET_CREATED", ticket });
  res.json(ticket);
});

app.patch("/api/tickets/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ["title", "description", "category", "priority", "status", "assignee", "scheduledDate"];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: "No valid fields" });

  const set = updates.map(([k]) => `${k} = ?`).join(", ");
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE tickets SET ${set} WHERE id = ?`).run(...values, id);

  const ticket = {
    ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(id),
    updates: db.prepare("SELECT * FROM updates WHERE ticketId = ? ORDER BY ts ASC").all(id)
  };
  broadcast({ type: "TICKET_UPDATED", ticket });
  res.json(ticket);
});

app.delete("/api/tickets/:id", (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
  broadcast({ type: "TICKET_DELETED", id });
  res.json({ ok: true });
});

app.post("/api/tickets/:id/updates", (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { author, text } = req.body;
  const ts = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO updates (ticketId, author, text, ts) VALUES (?, ?, ?, ?)"
  ).run(ticketId, author, text, ts);
  const update = db.prepare("SELECT * FROM updates WHERE id = ?").get(result.lastInsertRowid);

  const ticket = {
    ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId),
    updates: db.prepare("SELECT * FROM updates WHERE ticketId = ? ORDER BY ts ASC").all(ticketId)
  };
  broadcast({ type: "TICKET_UPDATED", ticket });
  res.json(update);
});

// ── SPA fallback ──────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ── WebSocket ─────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "INIT", tickets: getTickets() }));
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`HomeDesk server running on http://0.0.0.0:${PORT}`);
});
