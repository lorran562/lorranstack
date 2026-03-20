// api/create-payment.js — LorranStack Mercado Pago
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

// Token de producao — conta Lorran (69992905682)
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-3351698149426901-032016-814e052946e9075bccc3bd20988e8694-1272402464';

const mp = new MercadoPagoConfig({
  accessToken: MP_TOKEN,
  options: { timeout: 15000 },
});

const supabase = createClient(
  process.env.SUPABASE_URL     || 'https://jkgrmlfqgprcwfooovkx.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const BASE_URL = 'https://lorranstack-six.vercel.app';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  const { method, amount, product_name, plan_slug, user_id, user_email, user_name, success_url, cancel_url } = req.body || {};

  if (!method || !amount || !product_name || !user_email) {
    return res.status(400).json({ error: 'Campos obrigatorios: method, amount, product_name, user_email' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Valor invalido' });
  }

  const firstName = user_name ? user_name.split(' ')[0] : 'Cliente';
  const lastName  = user_name ? (user_name.split(' ').slice(1).join(' ') || 'LorranStack') : 'LorranStack';

  try {

    // ── PIX ─────────────────────────────────────────────────────────
    if (method === 'pix') {
      const paymentClient = new Payment(mp);
      const idempotencyKey = `pix_${Date.now()}_${user_email.replace('@','_')}`;

      const mpRes = await paymentClient.create({
        body: {
          transaction_amount: amountNum,
          description:        product_name,
          payment_method_id:  'pix',
          payer: {
            email:      user_email,
            first_name: firstName,
            last_name:  lastName,
          },
          statement_descriptor: 'LORRANSTACK',
          notification_url: `${BASE_URL}/api/mp-webhook`,
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          metadata: { plan_slug: plan_slug || '', user_id: user_id || '', product_name },
        },
        requestOptions: { idempotencyKey },
      });

      const pixData = mpRes.point_of_interaction?.transaction_data;

      // Salvar no banco
      let dbId = null;
      try {
        const { data } = await supabase.from('ls_payments').insert({
          user_id:            user_id || null,
          amount:             amountNum,
          status:             'pending',
          payment_method:     'pix',
          mp_payment_id:      String(mpRes.id),
          pix_qr_code:        pixData?.qr_code || null,
          pix_qr_code_base64: pixData?.qr_code_base64 || null,
          pix_expiry:         new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          plan_slug:          plan_slug || null,
          product_name,
          user_email,
          raw_response:       mpRes,
        }).select('id').single();
        dbId = data?.id;
      } catch(dbErr) {
        console.error('[DB]', dbErr.message);
      }

      return res.status(200).json({
        ok:           true,
        method:       'pix',
        payment_id:   dbId,
        mp_id:        String(mpRes.id),
        status:       mpRes.status,
        qr_code:      pixData?.qr_code      || null,
        qr_base64:    pixData?.qr_code_base64 || null,
        expires_at:   new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        amount:       amountNum,
        product_name,
      });
    }

    // ── CARTÃO — Checkout Pro ────────────────────────────────────────
    if (method === 'card') {
      const prefClient = new Preference(mp);

      const mpPref = await prefClient.create({
        body: {
          items: [{
            id:          plan_slug || 'produto',
            title:       product_name,
            quantity:    1,
            unit_price:  amountNum,
            currency_id: 'BRL',
          }],
          payer: { email: user_email, name: firstName + ' ' + lastName },
          payment_methods: {
            excluded_payment_types: [{ id: 'ticket' }],
            installments: 12,
          },
          back_urls: {
            success: success_url || `${BASE_URL}/?checkout=success&plan=${encodeURIComponent(plan_slug || product_name)}`,
            failure: cancel_url  || `${BASE_URL}/pricing.html?canceled=1`,
            pending: `${BASE_URL}/?checkout=pending`,
          },
          auto_return:          'approved',
          statement_descriptor: 'LORRANSTACK',
          notification_url:     `${BASE_URL}/api/mp-webhook`,
          metadata: { plan_slug: plan_slug || '', user_id: user_id || '', user_email },
        },
      });

      // Salvar no banco
      let dbId = null;
      try {
        const { data } = await supabase.from('ls_payments').insert({
          user_id:          user_id || null,
          amount:           amountNum,
          status:           'pending',
          payment_method:   'card',
          mp_preference_id: mpPref.id,
          plan_slug:        plan_slug || null,
          product_name,
          user_email,
          raw_response:     mpPref,
        }).select('id').single();
        dbId = data?.id;
      } catch(dbErr) {
        console.error('[DB]', dbErr.message);
      }

      // init_point = producao, sandbox_init_point = testes
      const checkoutUrl = mpPref.init_point;

      return res.status(200).json({
        ok:            true,
        method:        'card',
        payment_id:    dbId,
        preference_id: mpPref.id,
        checkout_url:  checkoutUrl,
        amount:        amountNum,
        product_name,
      });
    }

    return res.status(400).json({ error: 'method deve ser pix ou card' });

  } catch (err) {
    console.error('[create-payment]', err.message, err.cause || '');
    return res.status(500).json({ error: err.message });
  }
};
