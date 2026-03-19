// api/create-checkout.js — Vercel Serverless Function
// Cria sessão de checkout no Stripe (assinatura ou pagamento avulso)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PRICE_IDS = {
  'creator':        'price_1TCl0CCqEzRk7OT3KEUcrgJj',
  'creator-pro':    'price_1TCl28CqEzRk7OT3hTbyoASj',
  'featured-slot':  'price_1TCl2wCqEzRk7OT3F6PpuxKb',
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan_slug, user_email, saas_id } = req.body;

  if (!plan_slug || !PRICE_IDS[plan_slug]) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    const priceId  = PRICE_IDS[plan_slug];
    const isFeatured = plan_slug === 'featured-slot';
    const isSubscription = !isFeatured;
    const baseUrl  = process.env.NEXT_PUBLIC_URL || 'https://lorranstack.vercel.app';

    // Criar ou recuperar customer Stripe
    let customerId;
    if (user_email) {
      const { data: user } = await supabase
        .from('ls_users')
        .select('stripe_customer_id')
        .eq('email', user_email)
        .single();

      if (user?.stripe_customer_id) {
        customerId = user.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email: user_email });
        customerId = customer.id;
        await supabase
          .from('ls_users')
          .update({ stripe_customer_id: customerId })
          .eq('email', user_email);
      }
    }

    // Montar sessão
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `${baseUrl}/dashboard.html?success=1&plan=${plan_slug}`,
      cancel_url:  `${baseUrl}/pricing.html?canceled=1`,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      metadata: { plan_slug, user_email: user_email || '', saas_id: saas_id || '' },
    };

    if (customerId) sessionParams.customer = customerId;
    else if (user_email) sessionParams.customer_email = user_email;

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url, session_id: session.id });

  } catch (err) {
    console.error('[Stripe Checkout Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
