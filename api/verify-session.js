const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid' && session.status === 'complete') {
      res.status(200).json({
        active: true,
        customer: session.customer,
        email: session.customer_details?.email,
      });
    } else {
      res.status(200).json({ active: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
