// api/stripe-webhook.js — Vercel Serverless Function
// Recebe eventos do Stripe e atualiza o Supabase automaticamente

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Desabilitar bodyParser para validar assinatura do webhook
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getPlanIdBySlug(slug) {
  const { data } = await supabase
    .from('ls_plans').select('id').eq('slug', slug).single();
  return data?.id;
}

async function getUserByCustomer(customerId) {
  const { data } = await supabase
    .from('ls_users').select('id, email').eq('stripe_customer_id', customerId).single();
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig        = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody    = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[Webhook] Assinatura inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[Webhook] Evento recebido:', event.type);
  const data = event.data.object;

  try {
    switch (event.type) {

      // ── CHECKOUT CONCLUÍDO ────────────────────────────────
      case 'checkout.session.completed': {
        const { plan_slug, user_email, saas_id } = data.metadata;
        const customerId = data.customer;

        // Assinatura (Creator / Creator Pro)
        if (data.mode === 'subscription') {
          const planId = await getPlanIdBySlug(plan_slug);
          const { data: user } = await supabase
            .from('ls_users').select('id').eq('email', user_email).single();

          if (planId && user) {
            // Criar/atualizar assinatura
            await supabase.from('ls_subscriptions').upsert({
              user_id:                user.id,
              plan_id:                planId,
              stripe_subscription_id: data.subscription,
              stripe_customer_id:     customerId,
              status:                 'active',
              current_period_start:   new Date(),
              current_period_end:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              cancel_at_period_end:   false,
            }, { onConflict: 'stripe_subscription_id' });

            // Atualizar plano do usuário
            await supabase.from('ls_users').update({
              plan_id:            planId,
              stripe_customer_id: customerId,
            }).eq('id', user.id);

            console.log(`[Webhook] Assinatura ${plan_slug} ativada para ${user_email}`);
          }
        }

        // Pagamento avulso (Featured Slot)
        if (data.mode === 'payment' && plan_slug === 'featured-slot' && saas_id) {
          const { data: user } = await supabase
            .from('ls_users').select('id').eq('email', user_email).single();

          if (user) {
            await supabase.from('ls_featured_slots').insert({
              saas_id:               saas_id,
              user_id:               user.id,
              slot_type:             'home_featured',
              price_paid:            99,
              starts_at:             new Date(),
              ends_at:               new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              stripe_payment_intent: data.payment_intent,
              status:                'active',
            });

            // Marcar produto como featured no banco
            await supabase.from('ls_saas').update({
              is_featured: true,
              status:      'featured',
            }).eq('id', saas_id);

            console.log(`[Webhook] Featured slot ativado para produto ${saas_id}`);
          }
        }
        break;
      }

      // ── ASSINATURA RENOVADA ───────────────────────────────
      case 'invoice.payment_succeeded': {
        if (!data.subscription) break;
        await supabase
          .from('ls_subscriptions')
          .update({
            status: 'active',
            current_period_end: new Date(data.period_end * 1000),
          })
          .eq('stripe_subscription_id', data.subscription);
        console.log(`[Webhook] Assinatura renovada: ${data.subscription}`);
        break;
      }

      // ── PAGAMENTO FALHOU ──────────────────────────────────
      case 'invoice.payment_failed': {
        if (!data.subscription) break;
        await supabase
          .from('ls_subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', data.subscription);

        const user = await getUserByCustomer(data.customer);
        if (user) {
          console.log(`[Webhook] Pagamento falhou para ${user.email}`);
          // Aqui você pode disparar email de aviso via EmailJS/Resend
        }
        break;
      }

      // ── ASSINATURA CANCELADA ──────────────────────────────
      case 'customer.subscription.deleted': {
        await supabase
          .from('ls_subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', data.id);

        // Voltar para plano gratuito
        const freePlanId = await getPlanIdBySlug('free');
        if (freePlanId) {
          const user = await getUserByCustomer(data.customer);
          if (user) {
            await supabase
              .from('ls_users')
              .update({ plan_id: freePlanId })
              .eq('id', user.id);
            console.log(`[Webhook] Assinatura cancelada, ${user.email} voltou para Free`);
          }
        }
        break;
      }

      // ── FEATURED SLOT EXPIRADO (via scheduled job) ────────
      // Rodar via cron no Vercel para expirar slots vencidos
      default:
        console.log(`[Webhook] Evento não tratado: ${event.type}`);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar evento:', err.message);
    // Retornar 200 mesmo com erro para o Stripe não retentar
  }

  return res.status(200).json({ received: true });
};
