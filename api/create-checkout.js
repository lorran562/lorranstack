// api/create-checkout.js — Vercel Serverless Function
// Sistema DINÂMICO: não precisa criar price IDs manualmente no Stripe.
// O plano pode vir com name + amount + interval direto do frontend.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs fixos para planos principais (criados em test mode)
const FIXED_PRICE_IDS = {
  'creator':       'price_1TCl0CCqEzRk7OT3KEUcrgJj',
  'creator-pro':   'price_1TCl28CqEzRk7OT3hTbyoASj',
  'featured-slot': 'price_1TCl2wCqEzRk7OT3F6PpuxKb',
};

const BASE_URL = 'https://lorranstack-six.vercel.app';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurada' });
  }

  const {
    plan_slug,    // ex: 'creator', 'contratofreela-pro', 'readme-dev-pro'
    user_email,
    // Para planos dinâmicos (sem price ID fixo):
    product_name,   // ex: 'ContratoFreela Pro'
    amount_cents,   // ex: 1990 (R$19,90)
    interval,       // 'month' | 'year' | null (null = pagamento único)
    success_path,   // ex: '/contrato-freelancer?upgraded=1'
    cancel_path,    // ex: '/contrato-freelancer'
  } = req.body || {};

  try {
    let priceId;
    let mode;

    // ── PLANO FIXO ─────────────────────────────────────────────
    if (plan_slug && FIXED_PRICE_IDS[plan_slug]) {
      priceId = FIXED_PRICE_IDS[plan_slug];
      mode = plan_slug === 'featured-slot' ? 'payment' : 'subscription';

    // ── PLANO DINÂMICO ─────────────────────────────────────────
    // Cria produto + price on-demand — nunca precisa criar manualmente
    } else if (product_name && amount_cents) {
      // Buscar produto existente pelo nome para evitar duplicatas
      const existingProducts = await stripe.products.search({
        query: `name:"${product_name}" AND active:"true"`,
        limit: 1,
      });

      let productId;
      if (existingProducts.data.length > 0) {
        productId = existingProducts.data[0].id;
      } else {
        // Criar novo produto
        const product = await stripe.products.create({
          name: product_name,
          metadata: { source: 'lorranstack', plan_slug: plan_slug || product_name },
        });
        productId = product.id;
      }

      // Buscar price existente para evitar duplicatas
      const existingPrices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 10,
      });

      const matchingPrice = existingPrices.data.find(p => {
        const sameAmount = p.unit_amount === parseInt(amount_cents);
        if (interval) return sameAmount && p.recurring?.interval === interval;
        return sameAmount && !p.recurring;
      });

      if (matchingPrice) {
        priceId = matchingPrice.id;
      } else {
        // Criar novo price
        const priceParams = {
          product: productId,
          unit_amount: parseInt(amount_cents),
          currency: 'brl',
        };
        if (interval) {
          priceParams.recurring = { interval };
        }
        const price = await stripe.prices.create(priceParams);
        priceId = price.id;
      }

      mode = interval ? 'subscription' : 'payment';

    } else {
      return res.status(400).json({
        error: 'Forneça plan_slug (plano fixo) OU product_name + amount_cents (plano dinâmico)',
      });
    }

    // ── CRIAR SESSÃO DE CHECKOUT ───────────────────────────────
    const successUrl = BASE_URL + (success_path || '/?checkout=success&plan=' + (plan_slug || product_name));
    const cancelUrl  = BASE_URL + (cancel_path  || '/pricing.html?canceled=1');

    const sessionParams = {
      payment_method_types: ['card', 'boleto'],  // cartão + boleto (PIX via boleto BRL)
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      metadata: {
        plan_slug: plan_slug || product_name || '',
        user_email: user_email || '',
      },
    };

    // Adicionar PIX para pagamentos únicos (não funciona em subscription)
    if (mode === 'payment') {
      sessionParams.payment_method_types = ['card', 'boleto', 'pix'];
    }

    if (user_email) {
      sessionParams.customer_email = user_email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[Checkout Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
