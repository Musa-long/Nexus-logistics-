const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// === CONFIG FROM RENDER ENVIRONMENT ===
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NexusAdmin2025!";
const BANK_DETAILS = process.env.BANK_DETAILS || "Bank: Opay - 1234567890 - Musa Long";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "2348012345678";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set!");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

// === ADMIN PROTECTION ===
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
      return res.status(401).send('Auth error');
    }
  }
  next();
}
app.use(checkAdminAuth);
app.use(express.static(__dirname));

// === PUBLIC APIS ===

// 1. Hidden Customer Care - number never exposed
app.get("/customer-care", (req, res) => {
  res.redirect(`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20NEXUS%20Logistics,%20I%20need%20help%20with%20my%20shipment`);
});

// 2. Public config - ONLY bank, whatsapp hidden
app.get("/api/config", (req,res)=>{
  res.json({ bank: BANK_DETAILS });
});

// 3. Track single
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

// 4. Get all
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

// 5. Create / Update
app.post("/api/tracking", async (req, res) => {
  try {
    const { trackingCode, _delete } = req.body;
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

app.delete("/api/track/:code", async (req, res) => {
  try {
    await pool.query("DELETE FROM shipments WHERE code=$1", [req.params.code.toUpperCase()]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/clear", async (req, res) => {
  try {
    await pool.query("DELETE FROM shipments");
    res.json({ cleared: true, message: "All tracking deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`NEXUS running on ${PORT}`);
});
