const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serves index.html, admin.html, img1.jpg etc

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipments (
      code TEXT PRIMARY KEY,
      data JSONB,
      status TEXT,
      fee TEXT,
      location TEXT
    )
  `);
  console.log("DB ready");
}
init();

// API ROUTES
app.get("/api/track/:code", async (req,res)=>{
  try{
    const code = req.params.code.toUpperCase();
    const r = await pool.query("SELECT data FROM shipments WHERE code=$1",[code]);
    if(r.rows.length==0) return res.json({found:false});
    res.json({found:true,...r.rows[0].data});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get("/api/tracking", async (req,res)=>{
  const r = await pool.query("SELECT code, data FROM shipments");
  const obj={}; r.rows.forEach(x=> obj[x.code]=x.data);
  res.json(obj);
});

app.post("/api/tracking", async (req,res)=>{
  try{
    const d = req.body;
    const code = (d.trackingCode || d.code || "").toUpperCase();
    if(!code) return res.status(400).json({error:"code required"});
    await pool.query(
      `INSERT INTO shipments (code, data, status, fee, location) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO UPDATE SET data=$2, status=$3, fee=$4, location=$5`,
      [code, d, d.status||"", d.fee||"", d.location||""]
    );
    res.json({success:true, code});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/import", async (req,res)=>{
  try{
    const data = req.body;
    let count=0;
    for(let code in data){
      let d = data[code]; d.trackingCode = code;
      await pool.query(
        `INSERT INTO shipments (code, data, status, fee, location) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (code) DO UPDATE SET data=$2, status=$3, fee=$4, location=$5`,
        [code.toUpperCase(), d, d.status||"", d.fee||"", d.location||""]
      );
      count++;
    }
    res.json({success:true, imported:count});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Serve frontend for any other route
app.get("*", (req,res)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"API not found"});
  res.sendFile(path.join(__dirname,"index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log("NEXUS live on "+PORT));
