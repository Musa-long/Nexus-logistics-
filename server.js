const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let shipments = [];
try{ shipments = JSON.parse(fs.readFileSync('shipments.json')); }catch{}

// Save shipment with phone, receiver, sender
app.post('/api/shipments', (req, res)=>{
  const data = req.body;
  const existing = shipments.findIndex(s=>s.trackingId===data.trackingId);
  if(existing>=0) shipments[existing]=data;
  else shipments.push(data);
  fs.writeFileSync('shipments.json', JSON.stringify(shipments, null, 2));
  res.json({message:`Shipment ${data.trackingId} created! Receiver: ${data.receiverName} - ${data.receiverPhone}`});
});

app.get('/api/shipments', (req,res)=> res.json(shipments));

app.get('/api/track/:id', (req,res)=>{
  const found = shipments.find(s=>s.trackingId.toLowerCase()===req.params.id.toLowerCase());
  if(!found) return res.json({trackingId:req.params.id, status:'Not Found', currentLocation:'Not in system'});
  res.json(found);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Running on '+PORT));
