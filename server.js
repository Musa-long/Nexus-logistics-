const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();
app.use(cors());
app.use(express.json());

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
  console.log("DB ready - shipments table created");
}
init();

app.get("/", (req,res)=> res.json({status:"NEXUS API live with PostgreSQL", db:"Render"}));

// Get single tracking
app.get("/api/track/:code", async (req,res)=>{
  try{
    const code = req.params.code.toUpperCase();
    const r = await pool.query("SELECT data FROM shipments WHERE code=$1",[code]);
    if(r.rows.length==0) return res.json({found:false});
    res.json({found:true,...r.rows[0].data});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Get all (for backup)
app.get("/api/tracking", async (req,res)=>{
  const r = await pool.query("SELECT code, data FROM shipments ORDER BY code");
  const obj={};
  r.rows.forEach(x=> obj[x.code]=x.data);
  res.json(obj);
});

// Save / Update shipment
app.post("/api/tracking", async (req,res)=>{
  try{
    const d = req.body;
    const code = (d.trackingCode || d.code || "").toUpperCase();
    if(!code) return res.status(400).json({error:"tracking code required"});
    await pool.query(
      `INSERT INTO shipments (code, data, status, fee, location)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO UPDATE SET data=$2, status=$3, fee=$4, location=$5`,
      [code, d, d.status||"", d.fee||"", d.location||""]
    );
    res.json({success:true, code});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ONE-TIME import your old tracking.json
app.post("/api/import", async (req,res)=>{
  try{
    const data = req.body;
    let count=0;
    for(let code in data){
      let d = data[code];
      d.trackingCode = code;
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

app.listen(process.env.PORT||10000, ()=> console.log("NEXUS API running"));
