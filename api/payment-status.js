// api/payment-status.js — verifica status de um pagamento
// Chamado pelo frontend via polling a cada 3s enquanto aguarda PIX

const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { payment_id, mp_id } = req.query;

  if (!payment_id && !mp_id) {
    return res.status(400).json({ error: 'Forneça payment_id ou mp_id' });
  }

  try {
    // Buscar no banco pelo ID interno
    let dbQuery = supabase.from('ls_payments').select('*');
    if (payment_id) dbQuery = dbQuery.eq('id', payment_id);
    else            dbQuery = dbQuery.eq('mp_payment_id', mp_id);

    const { data: payment, error } = await dbQuery.single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    // Se já está pago, retornar direto (sem chamar MP)
    if (payment.status === 'paid') {
      return res.status(200).json({ status: 'paid', payment });
    }

    // Para PIX pendente: checar status no MP
    if (payment.mp_payment_id && payment.status === 'pending') {
      try {
        const mpPayment = new Payment(mp);
        const mpData = await mpPayment.get({ id: payment.mp_payment_id });

        let newStatus = payment.status;
        if (mpData.status === 'approved')  newStatus = 'paid';
        if (mpData.status === 'rejected')  newStatus = 'failed';
        if (mpData.status === 'cancelled') newStatus = 'cancelled';

        // Atualizar banco se mudou
        if (newStatus !== payment.status) {
          await supabase.from('ls_payments').update({
            status:  newStatus,
            paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
          }).eq('id', payment.id);

          payment.status = newStatus;
        }
      } catch (mpErr) {
        console.warn('[MP Status Check]', mpErr.message);
      }
    }

    return res.status(200).json({
      status:       payment.status,
      payment_id:   payment.id,
      mp_id:        payment.mp_payment_id,
      amount:       payment.amount,
      product_name: payment.product_name,
      paid_at:      payment.paid_at,
    });

  } catch (err) {
    console.error('[payment-status Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
