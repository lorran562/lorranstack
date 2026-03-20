// stripe-checkout.js — LorranStack
// Inclua em qualquer página que precise de checkout Stripe.
// Suporta planos fixos (por slug) e planos dinâmicos (nome + valor).

const LORRANSTACK_CONFIG = {
  PUBLIC_KEY: 'pk_test_51SGlekCqEzRk7OT36E6iybyjw0LHJkHIoU2az7K90Lm4c0rb0ebw80Fbke5A622sDIvBvLiXmM5VPqJUqxfhqMQU00EsAGVjFv',
  API_BASE:   'https://lorranstack-six.vercel.app/api',
};

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('ls_user') || 'null'); }
  catch { return null; }
}

// ── CHECKOUT POR SLUG (planos fixos: creator, creator-pro, featured-slot) ──
async function startCheckout(planSlug) {
  return _doCheckout({ plan_slug: planSlug });
}

// ── CHECKOUT DINÂMICO (qualquer produto, sem criar price ID manualmente) ──
// Exemplo: startDynamicCheckout('ContratoFreela Pro', 1990, 'month', '/contrato-freelancer?ok=1')
async function startDynamicCheckout(productName, amountCents, interval, successPath, cancelPath) {
  return _doCheckout({
    product_name:  productName,
    amount_cents:  amountCents,
    interval:      interval || null,
    success_path:  successPath || null,
    cancel_path:   cancelPath || null,
  });
}

// ── FUNÇÃO INTERNA ─────────────────────────────────────────────────────────
async function _doCheckout(params) {
  const user = getCurrentUser();

  // Não logado → cadastro primeiro
  if (!user) {
    sessionStorage.setItem('openModal', 'm-register');
    window.location.href = '/';
    return;
  }

  // Loading no botão clicado
  const activeBtns = document.querySelectorAll('button:focus, .btn-plan-pro, .nav-pro');
  const clickedBtn = activeBtns[0];
  const originalText = clickedBtn?.innerHTML;
  if (clickedBtn) {
    clickedBtn.innerHTML = '<span style="opacity:.7">Abrindo checkout...</span>';
    clickedBtn.disabled = true;
  }

  try {
    const payload = { ...params, user_email: user.email };

    const response = await fetch(`${LORRANSTACK_CONFIG.API_BASE}/create-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Erro ao criar sessão de checkout');
    }

  } catch (err) {
    console.error('[Checkout]', err.message);
    _showCheckoutError(err.message);
    if (clickedBtn) {
      clickedBtn.innerHTML = originalText;
      clickedBtn.disabled = false;
    }
  }
}

// ── TOAST DE ERRO ───────────────────────────────────────────────────────────
function _showCheckoutError(msg) {
  const tc = document.getElementById('tc');
  if (!tc) { alert('Erro no checkout: ' + msg); return; }
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = 'background:#1a0a0a;border-color:rgba(255,80,80,.3)';
  el.innerHTML = `<span style="color:#ff7070;font-weight:700">✗</span><span>${msg}</span>`;
  tc.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
