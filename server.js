const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NexusAdmin2025!";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set!");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create table if not exists
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        code VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("DB Ready - Fresh start enabled");
  } catch (err) {
    console.error("DB Init Error:", err.message);
  }
}
initDB();

app.use(cors());
app.use(express.json());

// --- ADMIN PASSWORD PROTECTION ---
function checkAdminAuth(req, res, next) {
  if (req.path === '/admin.html') {
    const auth = req.headers.authorization;
    if (!auth ||!auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="NEXUS Admin"');
      return res.status(401).send('Admin login required');
    }
    try {
      const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
      const password = credentials.split(':').slice(1).join(':');
      if (password!== ADMIN_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="NEXUS Admin"');
        return res.status(401).send('Wrong password');
      }
    } catch (e) {
      res.set('WWW-Authenticate', 'Basic realm="NEXUS Admin"');
      return res.status(401).send('Auth error');
    }
  }
  next();
}
app.use(checkAdminAuth);

// Serve all static files (index.html, admin.html, jpg)
app.use(express.static(__dirname));

// --- API ROUTES ---

// Track single code - what your index.html uses
app.get("/api/track/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const result = await pool.query("SELECT data FROM shipments WHERE code=$1", [code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tracking code not found" });
    }
    res.json(result.rows[0].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all tracking (for admin)
app.get("/api/tracking", async (req, res) => {
  try {
    const result = await pool.query("SELECT code, data FROM shipments ORDER BY created_at DESC");
    const obj = {};
    result.rows.forEach(row => { obj[row.code] = row.data; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create / Update shipment
app.post("/api/tracking", async (req, res) => {
  try {
    const { trackingCode, _delete,...rest } = req.body;
    const code = (trackingCode || "").toUpperCase().trim();
    if (!code) return res.status(400).json({ error: "trackingCode required" });

    if (_delete) {
      await pool.query("DELETE FROM shipments WHERE code=$1", [code]);
      return res.json({ success: true, deleted: code });
    }

    const data = {
      trackingCode: code,
      status: req.body.status || "In Transit",
      location: req.body.location || "Warehouse",
      origin: req.body.origin || "USA",
      destination: req.body.destination || "Nigeria",
      eta: req.body.eta || "3-5 days",
      fee: req.body.fee || "Pending",
      timeline: req.body.timeline || [{ date: new Date().toISOString().slice(0,16), status: "Shipment Created", location: "Origin Warehouse", active: true }]
    };

    await pool.query(
      `INSERT INTO shipments (code, data) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET data=$2, updated_at=NOW()`,
      [code, JSON.stringify(data)]
    );

    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import bulk (for migration)
app.post("/api/import", async (req, res) => {
  try {
    const data = req.body;
    for (const code in data) {
      const upper = code.toUpperCase();
      await pool.query(
        `INSERT INTO shipments (code, data) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET data=$2, updated_at=NOW()`,
        [upper, JSON.stringify(data[code])]
      );
    }
    res.json({ success: true, imported: Object.keys(data).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete single
app.delete("/api/track/:code", async (req, res) => {
  try {
    await pool.query("DELETE FROM shipments WHERE code=$1", [req.params.code.toUpperCase()]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear ALL - Fresh Start
app.get("/api/clear", async (req, res) => {
  try {
    await pool.query("DELETE FROM shipments");
    res.json({ cleared: true, message: "All tracking deleted - fresh database ready!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`NEXUS Logistics running on port ${PORT}`);
  console.log(`Admin password set: ${ADMIN_PASSWORD!== "NexusAdmin2025!"? "YES (custom)" : "DEFAULT - change it!"}`);
});
