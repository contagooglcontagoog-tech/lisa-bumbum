require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..')));

const DICE_URL      = 'https://dev.use-dice.com';
const CLIENT_ID     = process.env.DICE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.DICE_CLIENT_SECRET || '';
const WEBHOOK_URL   = process.env.WEBHOOK_URL         || '';
const PORT          = process.env.PORT                || 3002;

let _token  = null;
let _expiry = 0;

async function getDiceToken() {
  if (_token && Date.now() < _expiry) return _token;
  const res = await axios.post(`${DICE_URL}/api/v1/auth/login`, {
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET
  });
  _token  = res.data.token || res.data.access_token;
  _expiry = Date.now() + 50 * 60 * 1000;
  return _token;
}

app.post('/api/criar-pagamento', async (req, res) => {
  try {
    const { nome, email, cpf, kit_label, total } = req.body;
    if (!nome || !email || !cpf || !total)
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios faltando.' });

    const token   = await getDiceToken();
    const payload = {
      product_name: `Lisa Bumbum — ${kit_label}`,
      amount:       parseFloat(total.toFixed(2)),
      payer: { name: nome, email, document: cpf.replace(/\D/g, '') }
    };
    if (WEBHOOK_URL) payload.clientCallbackUrl = WEBHOOK_URL;

    const { data } = await axios.post(
      `${DICE_URL}/api/v2/payments/deposit`, payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.json({ ok: true, qr_code_text: data.qr_code_text, payment_id: data.id || null });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    if (err.response?.status === 401) { _token = null; _expiry = 0; }
    return res.status(500).json({ ok: false, erro: msg });
  }
});

app.post('/webhook/dice', (req, res) => {
  const ev = req.body;
  if (ev.status === 'PAID') console.log(`✅ Pago — ${ev.id || ev.payment_id}`);
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`🍑 Lisa Bumbum rodando em http://localhost:${PORT}`));
