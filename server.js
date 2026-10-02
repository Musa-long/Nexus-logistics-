const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Use the key you added in Render
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} catch(e){
  console.error("FIREBASE_KEY not found in env");
  serviceAccount = require('./serviceAccountKey.json'); // fallback for local
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const col = db.collection('shipments');

app.post('/api/shipments', async (req,res)=>{
  const d = req.body;
  if(!d.trackingId) return res.status(400).json({error:"No trackingId"});
  d.trackingIdLower = d.trackingId.toLowerCase();
  d.updatedAt = new Date().toISOString();
  await col.doc(d.trackingId).set(d, {merge:true});
  console.log("Saved permanently:", d.trackingId);
  res.json({message:'Saved permanently!'});
});

app.get('/api/shipments', async (req,res)=>{
  const snap = await col.orderBy('updatedAt','desc').get();
  res.json(snap.docs.map(doc=>doc.data()));
});

app.get('/api/track/:id', async (req,res)=>{
  const id = req.params.id.trim();
  // check exact
  let doc = await col.doc(id).get();
  if(!doc.exists) doc = await col.doc(id.toUpperCase()).get();
  if(!doc.exists){
    const q = await col.where('trackingIdLower','==', id.toLowerCase()).limit(1).get();
    if(q.empty) return res.status(404).json({trackingId:id, status:'Not Found', currentLocation:'Not in system'});
    return res.json(q.docs[0].data());
  }
  res.json(doc.data());
});

app.get('/api/config', (req,res)=> res.json({bank:{name:'Sterling Bank', number:'8387778364', accName:'MFY/DATA 247 COMMUNICATION LTD'}, whatsapp:'2349167452777'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Running with Firebase permanent storage!'));
