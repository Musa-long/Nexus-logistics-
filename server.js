const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let shipments = [];
try { shipments = JSON.parse(fs.readFileSync('shipments.json','utf8')); } catch(e){ shipments=[]; }

app.post('/api/shipments', (req,res)=>{
  const d = req.body;
  const i = shipments.findIndex(s=>s.trackingId===d.trackingId);
  if(i>=0) shipments[i]=d; else shipments.push(d);
  fs.writeFileSync('shipments.json', JSON.stringify(shipments, null, 2));
  res.json({message:'Saved'});
});

app.get('/api/shipments', (req,res)=> res.json(shipments));

app.get('/api/track/:id', (req,res)=>{
  const id = req.params.id.toLowerCase();
  const found = shipments.find(s=>s.trackingId.toLowerCase()===id);
  if(!found) return res.status(404).json({trackingId:req.params.id, status:'Not Found', currentLocation:'Not in system'});
  res.json(found);
});

app.get('/api/config', (req,res)=> res.json({bank:{name:'Sterling Bank', number:'8387778364', accName:'MFY/DATA 247 COMMUNICATION LTD'}, whatsapp:'2349167452777'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Running'));
