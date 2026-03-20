// api/mp-webhook.js — Webhook do Mercado Pago
// Recebe notificações de pagamento e atualiza o banco automaticamente

const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || 
  'APP_USR-3351698149426901-032016-814e052946e9075bccc3bd20988e8694-1272402464';
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  // MP envia GET para validar a URL
  if (req.method === 'GET') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { type, data, action } = req.body || {};

    console.log('[MP Webhook]', JSON.stringify({ type, action, data }));

    // Ignorar eventos que não são de pagamento
    if (type !== 'payment' && action !== 'payment.updated') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const mpPaymentId = data?.id;
    if (!mpPaymentId) return res.status(200).json({ ok: true });

    // Buscar dados do pagamento no MP
    const mpClient = new Payment(mp);
    const mpPayment = await mpClient.get({ id: String(mpPaymentId) });

    const mpStatus    = mpPayment.status;          // approved, rejected, pending, cancelled
    const mpMetadata  = mpPayment.metadata || {};
    const mpAmount    = mpPayment.transaction_amount;

    // Mapear status MP → status interno
    const statusMap = {
      approved:   'paid',
      rejected:   'failed',
      cancelled:  'cancelled',
      pending:    'pending',
      in_process: 'processing',
      in_mediation: 'processing',
    };
    const newStatus = statusMap[mpStatus] || 'pending';

    // Atualizar pagamento no banco pelo mp_payment_id
    const { data: updated, error } = await supabase
      .from('ls_payments')
      .update({
        status:       newStatus,
        paid_at:      newStatus === 'paid' ? new Date().toISOString() : null,
        raw_response: mpPayment,
        error_message: mpStatus === 'rejected'
          ? (mpPayment.status_detail || 'Pagamento rejeitado')
          : null,
      })
      .eq('mp_payment_id', String(mpPaymentId))
      .select('id, user_id, plan_slug, product_name, user_email')
      .single();

    if (error) {
      console.error('[Webhook DB Error]', error.message);
      // Tentar criar o registro se não existir (pagamento criado direto pelo MP)
      if (error.code === 'PGRST116') {
        await supabase.from('ls_payments').insert({
          mp_payment_id:  String(mpPaymentId),
          amount:         mpAmount,
          status:         newStatus,
          payment_method: mpPayment.payment_method_id === 'pix' ? 'pix' : 'card',
          user_email:     mpPayment.payer?.email || mpMetadata.user_email || '',
          user_id:        mpMetadata.user_id || null,
          plan_slug:      mpMetadata.plan_slug || null,
          product_name:   mpPayment.description || mpMetadata.product_name || '',
          paid_at:        newStatus === 'paid' ? new Date().toISOString() : null,
          raw_response:   mpPayment,
        });
      }
    }

    // Se aprovado: atualizar subscription no banco
    if (newStatus === 'paid' && updated?.user_id && updated?.plan_slug) {
      try {
        const planId = await getPlanId(updated.plan_slug);
        if (planId) {
          await supabase.from('ls_subscriptions').upsert({
            user_id:   updated.user_id,
            plan_id:   planId,
            status:    'active',
            start_date: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
      } catch (subErr) {
        console.warn('[Subscription update]', subErr.message);
      }
    }

    console.log(`[MP Webhook] Payment ${mpPaymentId}: ${mpStatus} → ${newStatus}`);
    return res.status(200).json({ ok: true, status: newStatus });

  } catch (err) {
    console.error('[MP Webhook Error]', err.message);
    // Retornar 200 para evitar reenvio do MP
    return res.status(200).json({ ok: false, error: err.message });
  }
};

async function getPlanId(planSlug) {
  const { data } = await supabase
    .from('ls_plans')
    .select('id')
    .eq('slug', planSlug)
    .single();
  return data?.id || null;
}
