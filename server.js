const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serves index.html and admin.html

// YOUR CORRECT DETAILS
const BANK = {
  bankName: "Sterling Bank",
  accountNumber: "8387778364",
  accountName: "MFY/DATA 247 COMMUNICATION LTD"
};
const WHATSAPP = "2349167452777";

// API to get bank details (so frontend always shows correct one)
app.get('/api/config', (req, res) => {
  res.json({ bank: BANK, whatsapp: WHATSAPP });
});

// Mock tracking - replace with your Supabase logic later
app.get('/api/track/:id', (req, res) => {
  res.json({
    trackingId: req.params.id,
    status: "In Transit",
    currentLocation: "Lagos Hub"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
