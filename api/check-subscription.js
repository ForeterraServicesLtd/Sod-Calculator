const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer_id } = req.body;

  if (!customer_id) {
    return res.status(400).json({ active: false });
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      status: 'active',
      limit: 1,
    });

    res.status(200).json({
      active: subscriptions.data.length > 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
