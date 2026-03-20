// api/create-checkout.js — Vercel Serverless Function

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  'creator':            'price_1TCl0CCqEzRk7OT3KEUcrgJj',
  'creator-pro':        'price_1TCl28CqEzRk7OT3hTbyoASj',
  'featured-slot':      'price_1TCl2wCqEzRk7OT3F6PpuxKb',
  'contratofreela-pro': 'price_1TCuWXCqEzRk7OT3BsKbTPjI',
  'readme-dev-pro':     'price_1TCuWvCqEzRk7OT3wWa3YLnq',
};

const IS_SUBSCRIPTION = {
  'creator': true, 'creator-pro': true,
  'contratofreela-pro': true, 'readme-dev-pro': true,
  'featured-slot': false,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan_slug, user_email } = req.body || {};

  if (!plan_slug || !PRICE_IDS[plan_slug]) {
    return res.status(400).json({ error: 'Plano inválido: ' + plan_slug });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurada' });
  }

  const isFeatured = plan_slug === 'featured-slot';
  const baseUrl = 'https://lorranstack-six.vercel.app';

  try {
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan_slug], quantity: 1 }],
      mode: IS_SUBSCRIPTION[plan_slug] !== false ? 'subscription' : 'payment',
      success_url: baseUrl + '/?checkout=success&plan=' + plan_slug,
      cancel_url:  baseUrl + '/pricing.html?canceled=1',
      locale: 'pt-BR',
      allow_promotion_codes: true,
      metadata: { plan_slug, user_email: user_email || '' },
    };

    if (user_email) sessionParams.customer_email = user_email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[Checkout Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
