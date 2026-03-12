import express from "express";
import Database from "better-sqlite3";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";

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
    status TEXT DEFAULT 'Open',
    assignee TEXT DEFAULT 'Matt',
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

// ── Routes ────────────────────────────────────────────────────────

// Get all tickets
app.get("/api/tickets", (req, res) => {
  res.json(getTickets());
});

// Create ticket
app.post("/api/tickets", (req, res) => {
  const { title, description, category, priority, status, assignee } = req.body;
  const createdAt = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO tickets (title, description, category, priority, status, assignee, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(title, description || "", category || "Other", priority || "Medium", status || "Open", assignee || "Matt", createdAt);

  const ticket = { ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid), updates: [] };
  broadcast({ type: "TICKET_CREATED", ticket });
  res.json(ticket);
});

// Update ticket fields
app.patch("/api/tickets/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ["title", "description", "category", "priority", "status", "assignee"];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: "No valid fields" });

  const set = updates.map(([k]) => `${k} = ?`).join(", ");
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE tickets SET ${set} WHERE id = ?`).run(...values, id);

  const ticket = { ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(id), updates: db.prepare("SELECT * FROM updates WHERE ticketId = ? ORDER BY ts ASC").all(id) };
  broadcast({ type: "TICKET_UPDATED", ticket });
  res.json(ticket);
});

// Delete ticket
app.delete("/api/tickets/:id", (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
  broadcast({ type: "TICKET_DELETED", id });
  res.json({ ok: true });
});

// Add update to ticket
app.post("/api/tickets/:id/updates", (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { author, text } = req.body;
  const ts = new Date().toISOString();
  const result = db.prepare("INSERT INTO updates (ticketId, author, text, ts) VALUES (?, ?, ?, ?)").run(ticketId, author, text, ts);
  const update = db.prepare("SELECT * FROM updates WHERE id = ?").get(result.lastInsertRowid);

  const ticket = { ...db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId), updates: db.prepare("SELECT * FROM updates WHERE ticketId = ? ORDER BY ts ASC").all(ticketId) };
  broadcast({ type: "TICKET_UPDATED", ticket });
  res.json(update);
});

// ── WebSocket ─────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  // Send full state to newly connected client
  ws.send(JSON.stringify({ type: "INIT", tickets: getTickets() }));
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`HomeDesk server running on http://0.0.0.0:${PORT}`);
});
