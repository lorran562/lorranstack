// api/create-payment.js — LorranStack
// Cria pagamento via Mercado Pago (PIX ou Cartão)
// Armazena no Supabase e retorna dados para o frontend

const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 10000 },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BASE_URL = 'https://lorranstack-six.vercel.app';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });
  }

  const {
    method,         // 'pix' | 'card'
    amount,         // valor em reais, ex: 27.00
    product_name,   // ex: 'README.dev Pro'
    plan_slug,      // ex: 'readme-dev-pro'
    user_id,
    user_email,
    user_name,
    // Para cartão via Mercado Pago Checkout Pro
    success_url,
    cancel_url,
  } = req.body || {};

  if (!method || !amount || !product_name || !user_email) {
    return res.status(400).json({ error: 'Campos obrigatórios: method, amount, product_name, user_email' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  try {
    // ── PIX ───────────────────────────────────────────────────────────
    if (method === 'pix') {
      const payment = new Payment(mp);

      const idempotencyKey = `pix_${user_email}_${plan_slug || product_name}_${Date.now()}`;

      const pixPayload = {
        transaction_amount: amountNum,
        description: product_name,
        payment_method_id: 'pix',
        payer: {
          email: user_email,
          first_name: user_name ? user_name.split(' ')[0] : 'Cliente',
          last_name:  user_name ? user_name.split(' ').slice(1).join(' ') || 'LorranStack' : 'LorranStack',
        },
        statement_descriptor: 'LORRANSTACK',
        metadata: {
          plan_slug:    plan_slug || '',
          product_name: product_name,
          user_id:      user_id || '',
        },
        notification_url: `${BASE_URL}/api/mp-webhook`,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      };

      const mpResponse = await payment.create({
        body: pixPayload,
        requestOptions: { idempotencyKey },
      });

      const pixData = mpResponse.point_of_interaction?.transaction_data;

      // Salvar no banco
      const { data: dbPayment, error: dbError } = await supabase
        .from('ls_payments')
        .insert({
          user_id:           user_id || null,
          amount:            amountNum,
          currency:          'BRL',
          status:            'pending',
          payment_method:    'pix',
          mp_payment_id:     String(mpResponse.id),
          pix_qr_code:       pixData?.qr_code || null,
          pix_qr_code_base64: pixData?.qr_code_base64 || null,
          pix_expiry:        new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          plan_slug:         plan_slug || null,
          product_name:      product_name,
          user_email:        user_email,
          raw_response:      mpResponse,
        })
        .select('id')
        .single();

      if (dbError) console.error('[DB Error]', dbError.message);

      return res.status(200).json({
        ok: true,
        method: 'pix',
        payment_id:   dbPayment?.id || null,
        mp_id:        String(mpResponse.id),
        status:       mpResponse.status,
        qr_code:      pixData?.qr_code || null,
        qr_base64:    pixData?.qr_code_base64 || null,
        expires_at:   new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        amount:       amountNum,
        product_name: product_name,
      });
    }

    // ── CARTÃO — Checkout Pro (redirect) ─────────────────────────────
    if (method === 'card') {
      const preference = new Preference(mp);

      const prefPayload = {
        items: [{
          id:          plan_slug || 'produto',
          title:       product_name,
          quantity:    1,
          unit_price:  amountNum,
          currency_id: 'BRL',
        }],
        payer: {
          email: user_email,
          name:  user_name || 'Cliente',
        },
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }], // sem boleto
          installments: 12,
        },
        back_urls: {
          success: success_url || `${BASE_URL}/?checkout=success&method=card&plan=${encodeURIComponent(plan_slug || product_name)}`,
          failure: cancel_url  || `${BASE_URL}/pricing.html?canceled=1`,
          pending: `${BASE_URL}/?checkout=pending`,
        },
        auto_return: 'approved',
        statement_descriptor: 'LORRANSTACK',
        notification_url: `${BASE_URL}/api/mp-webhook`,
        metadata: {
          plan_slug:    plan_slug || '',
          product_name: product_name,
          user_id:      user_id || '',
          user_email:   user_email,
        },
      };

      const mpPref = await preference.create({ body: prefPayload });

      // Salvar no banco
      const { data: dbPayment } = await supabase
        .from('ls_payments')
        .insert({
          user_id:          user_id || null,
          amount:           amountNum,
          currency:         'BRL',
          status:           'pending',
          payment_method:   'card',
          mp_preference_id: mpPref.id,
          plan_slug:        plan_slug || null,
          product_name:     product_name,
          user_email:       user_email,
          raw_response:     mpPref,
        })
        .select('id')
        .single();

      return res.status(200).json({
        ok: true,
        method:       'card',
        payment_id:   dbPayment?.id || null,
        preference_id: mpPref.id,
        checkout_url:  mpPref.init_point,      // produção
        sandbox_url:   mpPref.sandbox_init_point, // sandbox
        amount:        amountNum,
        product_name:  product_name,
      });
    }

    return res.status(400).json({ error: 'method deve ser "pix" ou "card"' });

  } catch (err) {
    console.error('[create-payment Error]', err.message, err.cause || '');
    return res.status(500).json({ error: err.message });
  }
};
