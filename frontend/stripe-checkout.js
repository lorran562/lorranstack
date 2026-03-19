// stripe-checkout.js — inclui em pricing.html e dashboard.html
// Conecta os botões da interface com a API de checkout

const LORRANSTACK_CONFIG = {
  PUBLIC_KEY:  'pk_test_51SGlekCqEzRk7OT36E6iybyjw0LHJkHIoU2az7K90Lm4c0rb0ebw80Fbke5A622sDIvBvLiXmM5VPqJUqxfhqMQU00EsAGVjFv', // pk_test_...
  API_BASE:    'https://lorranstack.vercel.app/api',
  PLANS: {
    'creator':       { price_id: 'price_1TCl0CCqEzRk7OT3KEUcrgJj', mode: 'subscription' },
    'creator-pro':   { price_id: 'price_1TCl28CqEzRk7OT3hTbyoASj', mode: 'subscription' },
    'featured-slot': { price_id: 'price_1TCl2wCqEzRk7OT3F6PpuxKb', mode: 'payment'      },
  },
};

// ── Pegar usuário logado do localStorage ───────────────────
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('ls_user') || 'null');
  } catch { return null; }
}

// ── Iniciar checkout ────────────────────────────────────────
async function startCheckout(planSlug, saasId = null) {
  const user = getCurrentUser();

  // Se não está logado, redirecionar para cadastro
  if (!user) {
    const returnUrl = encodeURIComponent(`/pricing.html?plan=${planSlug}`);
    sessionStorage.setItem('openModal','register-modal'); window.location.href = '/index.html';
    return;
  }

  // Mostrar loading no botão
  const btn = document.querySelector(`[data-plan="${planSlug}"]`);
  const originalText = btn?.textContent;
  if (btn) {
    btn.textContent = 'Aguarde...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`${LORRANSTACK_CONFIG.API_BASE}/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_slug:  planSlug,
        user_email: user.email,
        saas_id:    saasId,
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Erro ao criar checkout');
    }

  } catch (err) {
    console.error('[Checkout]', err.message);
    showCheckoutError(err.message);
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

// ── Verificar sucesso após retorno do Stripe ────────────────
function checkCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('success') === '1') {
    const plan = params.get('plan');
    showSuccessMessage(plan);
    // Limpar URL
    window.history.replaceState({}, '', window.location.pathname);
    // Recarregar dados do usuário após 2s
    setTimeout(() => window.location.reload(), 3000);
  }

  if (params.get('canceled') === '1') {
    showCanceledMessage();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// ── Mensagem de sucesso ─────────────────────────────────────
function showSuccessMessage(plan) {
  const labels = {
    'creator':       'Creator — R$29/mês',
    'creator-pro':   'Creator Pro — R$79/mês',
    'featured-slot': 'Produto em Destaque',
  };
  showToast(`🎉 Pagamento confirmado! Plano ${labels[plan] || plan} ativado.`, 'success');
}

function showCanceledMessage() {
  showToast('Pagamento cancelado. Nenhuma cobrança foi feita.', 'info');
}

function showCheckoutError(msg) {
  showToast(`Erro: ${msg}`, 'error');
}

// ── Toast de notificação ────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.getElementById('ls-toast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#064e3b', border: '#10b981', text: '#6ee7b7' },
    error:   { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' },
    info:    { bg: '#0c1a3a', border: '#4f8eff', text: '#93c5fd' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'ls-toast';
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${c.bg}; border:1px solid ${c.border};
    color:${c.text}; padding:14px 20px; border-radius:12px;
    font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500;
    max-width:360px; box-shadow:0 8px 32px rgba(0,0,0,.4);
    animation: slideIn .3s ease;
  `;
  toast.textContent = message;

  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`;
  document.head.appendChild(style);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ── Verificar plano atual do usuário ────────────────────────
async function checkUserPlan() {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const supabase = createClient(
      'https://jkgrmlfqgprcwfooovkx.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ3JtbGZxZ3ByY3dmb29vdmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTY4NTIsImV4cCI6MjA4ODgzMjg1Mn0.f0N9ase2ZoYKq4JL7zVT9rzrjjsslYMPLcwd-k5Z8DA'
    );

    const { data } = await supabase
      .from('ls_users')
      .select('plan_id, ls_plans(name, slug)')
      .eq('email', user.email)
      .single();

    return data?.ls_plans || null;
  } catch { return null; }
}

// Rodar ao carregar a página
document.addEventListener('DOMContentLoaded', checkCheckoutReturn);
