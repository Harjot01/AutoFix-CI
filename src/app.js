const express = require('express');
const { formatPrice, applyDiscount, isValidEmail } = require('./utils');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AutoFix CI demo app is running' });
});

// GET /price?amount=100&discount=10
app.get('/price', (req, res) => {
  const amount = parseFloat(req.query.amount);
  const discount = parseFloat(req.query.discount || '0');

  if (Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount query param is required and must be a number' });
  }

  const discounted = applyDiscount(amount, discount);
  res.json({
    original: formatPrice(amount),
    discountPercent: discount,
    finalPrice: formatPrice(discounted),
  });
});

// POST /signup { "email": "someone@example.com" }
app.post('/signup', (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  res.status(201).json({ message: `Signed up ${email}` });
});

// Only start listening if this file is run directly (not when imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
