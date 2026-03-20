// checkout.js — LorranStack
// Componente de checkout PIX + Cartão via Mercado Pago
// Inclua antes do </body> em qualquer página que precise de pagamentos

(function() {
'use strict';

const API = 'https://lorranstack-six.vercel.app/api';

// ── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  #ls-checkout-overlay{
    display:none;position:fixed;inset:0;z-index:9000;
    background:rgba(4,6,15,.92);backdrop-filter:blur(12px);
    align-items:center;justify-content:center;padding:1rem;
  }
  #ls-checkout-overlay.open{display:flex}
  #ls-checkout-box{
    background:#080d1a;border:1px solid rgba(0,140,255,.2);
    border-radius:20px;padding:0;width:100%;max-width:420px;
    box-shadow:0 32px 80px rgba(0,0,0,.7),0 0 50px rgba(0,80,255,.1);
    animation:lsBoxIn .25s ease;overflow:hidden;
    font-family:'DM Sans',system-ui,sans-serif;
  }
  @keyframes lsBoxIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1)}}
  #ls-checkout-box *{box-sizing:border-box}
  .ls-cx-header{
    padding:1.4rem 1.5rem 1.2rem;
    border-bottom:1px solid rgba(0,120,255,.1);
    display:flex;align-items:flex-start;justify-content:space-between;
  }
  .ls-cx-prod-name{font-size:.82rem;color:rgba(0,200,255,.7);font-weight:500;margin-bottom:.2rem;letter-spacing:.04em;text-transform:uppercase}
  .ls-cx-title{font-size:1.35rem;font-weight:700;color:#fff;font-family:'Rajdhani',system-ui,sans-serif;letter-spacing:.02em}
  .ls-cx-price{font-family:'Rajdhani',system-ui,sans-serif;font-size:1.8rem;font-weight:700;color:#fff;line-height:1}
  .ls-cx-price span{font-size:.9rem;color:#6080a8;font-weight:400}
  .ls-cx-close{
    width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.1);color:#6080a8;font-size:1rem;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transition:all .15s;flex-shrink:0;margin-left:1rem;margin-top:.2rem;
  }
  .ls-cx-close:hover{background:rgba(255,80,80,.1);color:#ff7070;border-color:rgba(255,80,80,.3)}
  .ls-cx-body{padding:1.3rem 1.5rem}
  .ls-cx-methods{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1.4rem}
  .ls-cx-method{
    padding:.8rem .9rem;border-radius:10px;border:1.5px solid rgba(0,120,255,.15);
    background:rgba(0,40,120,.06);cursor:pointer;transition:all .2s;
    display:flex;flex-direction:column;align-items:center;gap:.35rem;
  }
  .ls-cx-method:hover{border-color:rgba(0,160,255,.4);background:rgba(0,80,255,.08)}
  .ls-cx-method.active{
    border-color:rgba(0,170,255,.6);background:rgba(0,80,255,.12);
    box-shadow:0 0 16px rgba(0,100,255,.2);
  }
  .ls-cx-method-icon{font-size:1.5rem;line-height:1}
  .ls-cx-method-name{font-size:.78rem;font-weight:700;color:#ddeeff;letter-spacing:.03em}
  .ls-cx-method-desc{font-size:.68rem;color:#6080a8;text-align:center;line-height:1.3}
  .ls-cx-btn{
    width:100%;padding:.82rem;border-radius:11px;
    background:linear-gradient(135deg,#0055ff,#0099ff,#00ccff);
    color:#fff;font-size:.9rem;font-weight:700;border:none;cursor:pointer;
    font-family:'Rajdhani',system-ui,sans-serif;letter-spacing:.05em;
    box-shadow:0 4px 20px rgba(0,100,255,.35);transition:all .2s;
  }
  .ls-cx-btn:hover:not(:disabled){box-shadow:0 6px 30px rgba(0,100,255,.55);transform:translateY(-1px)}
  .ls-cx-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .ls-cx-safe{display:flex;align-items:center;justify-content:center;gap:.35rem;
    margin-top:.75rem;font-size:.71rem;color:#3a5070}
  /* PIX SCREEN */
  .ls-pix-screen{display:none}
  .ls-pix-screen.show{display:block}
  .ls-pix-waiting{
    display:flex;align-items:center;gap:.6rem;
    background:rgba(0,255,170,.05);border:1px solid rgba(0,255,170,.15);
    border-radius:9px;padding:.75rem 1rem;margin-bottom:1.1rem;
  }
  .ls-pix-dot{width:8px;height:8px;border-radius:50%;background:#00ffaa;
    animation:pDot 1.5s ease-in-out infinite;flex-shrink:0}
  @keyframes pDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
  .ls-pix-waiting-text{font-size:.8rem;color:#00ffaa;font-weight:500}
  .ls-pix-qr-wrap{
    background:#fff;border-radius:12px;padding:1rem;
    display:flex;align-items:center;justify-content:center;
    margin-bottom:1rem;min-height:180px;
  }
  .ls-pix-qr-wrap img{max-width:160px;max-height:160px}
  .ls-pix-copy-label{font-size:.74rem;color:#6080a8;margin-bottom:.4rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
  .ls-pix-copy-box{
    display:flex;gap:.4rem;align-items:center;
    background:#0d1525;border:1px solid rgba(0,120,255,.15);
    border-radius:8px;padding:.5rem .7rem;margin-bottom:1.1rem;
  }
  .ls-pix-code{font-size:.68rem;color:#8899b0;font-family:'DM Mono',monospace;
    flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ls-pix-copy-btn{
    flex-shrink:0;padding:.35rem .7rem;border-radius:6px;
    background:rgba(0,100,255,.15);border:1px solid rgba(0,120,255,.3);
    color:#00aaff;font-size:.73rem;font-weight:700;cursor:pointer;
    transition:all .15s;font-family:'DM Sans',sans-serif;
  }
  .ls-pix-copy-btn:hover{background:rgba(0,100,255,.25)}
  .ls-pix-timer{text-align:center;font-size:.75rem;color:#3a5070;margin-bottom:1rem}
  .ls-pix-timer strong{color:#fbbf24}
  /* SUCCESS SCREEN */
  .ls-success-screen{display:none;text-align:center;padding:1rem 0}
  .ls-success-screen.show{display:block}
  .ls-success-icon{font-size:3.5rem;margin-bottom:.75rem;animation:successPop .5s ease}
  @keyframes successPop{from{transform:scale(0)}to{transform:scale(1)}}
  .ls-success-title{font-family:'Rajdhani',system-ui,sans-serif;font-size:1.6rem;font-weight:700;color:#00ffaa;margin-bottom:.35rem}
  .ls-success-text{font-size:.85rem;color:#6080a8;line-height:1.6}
  /* ERROR */
  .ls-cx-error{
    background:rgba(255,80,80,.07);border:1px solid rgba(255,80,80,.2);
    border-radius:8px;padding:.7rem .9rem;margin-bottom:.9rem;
    font-size:.8rem;color:#fca5a5;display:none;
  }
  .ls-cx-error.show{display:block}
  /* LOADING SPINNER */
  .ls-spinner{
    display:inline-block;width:16px;height:16px;
    border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
    border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:.4rem;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
`;

// Injetar CSS
const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);

// ── HTML DO MODAL ────────────────────────────────────────────────────
const overlay = document.createElement('div');
overlay.id = 'ls-checkout-overlay';
overlay.innerHTML = `
  <div id="ls-checkout-box">
    <div class="ls-cx-header">
      <div>
        <div class="ls-cx-prod-name" id="ls-cx-prod-name">Produto</div>
        <div class="ls-cx-title">Finalizar compra</div>
      </div>
      <div style="text-align:right">
        <div class="ls-cx-price" id="ls-cx-price">R$ —</div>
        <div style="font-size:.7rem;color:#3a5070;margin-top:.1rem">/mês</div>
      </div>
      <button class="ls-cx-close" id="ls-cx-close">✕</button>
    </div>
    <div class="ls-cx-body">
      <!-- TELA: Escolha do método -->
      <div id="ls-method-screen">
        <div style="font-size:.79rem;color:#6080a8;margin-bottom:.9rem;font-weight:500">Como você quer pagar?</div>
        <div class="ls-cx-methods">
          <div class="ls-cx-method active" data-method="pix" onclick="lsSelectMethod('pix',this)">
            <div class="ls-cx-method-icon">⚡</div>
            <div class="ls-cx-method-name">PIX</div>
            <div class="ls-cx-method-desc">Instantâneo<br/>Aprovação imediata</div>
          </div>
          <div class="ls-cx-method" data-method="card" onclick="lsSelectMethod('card',this)">
            <div class="ls-cx-method-icon">💳</div>
            <div class="ls-cx-method-name">Cartão</div>
            <div class="ls-cx-method-desc">Crédito/débito<br/>Até 12x</div>
          </div>
        </div>
        <div class="ls-cx-error" id="ls-cx-error"></div>
        <button class="ls-cx-btn" id="ls-cx-confirm" onclick="lsConfirmPayment()">
          Pagar com PIX ⚡
        </button>
        <div class="ls-cx-safe">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Pagamento seguro · Mercado Pago
        </div>
      </div>

      <!-- TELA: QR Code PIX -->
      <div class="ls-pix-screen" id="ls-pix-screen">
        <div class="ls-pix-waiting">
          <div class="ls-pix-dot"></div>
          <div class="ls-pix-waiting-text" id="ls-pix-status-text">Aguardando pagamento...</div>
        </div>
        <div class="ls-pix-qr-wrap" id="ls-pix-qr-wrap">
          <div style="text-align:center;color:#3a5070;font-size:.82rem">Carregando QR Code...</div>
        </div>
        <div class="ls-pix-copy-label">Código PIX (copia e cola)</div>
        <div class="ls-pix-copy-box">
          <div class="ls-pix-code" id="ls-pix-code">—</div>
          <button class="ls-pix-copy-btn" onclick="lsCopyPix()">Copiar</button>
        </div>
        <div class="ls-pix-timer">Expira em <strong id="ls-pix-timer">30:00</strong></div>
        <button class="ls-cx-btn" style="background:rgba(0,40,120,.15);box-shadow:none;border:1px solid rgba(0,120,255,.2);color:#6080a8" onclick="lsGoBack()">
          ← Voltar
        </button>
      </div>

      <!-- TELA: Sucesso -->
      <div class="ls-success-screen" id="ls-success-screen">
        <div class="ls-success-icon">🎉</div>
        <div class="ls-success-title">Pagamento confirmado!</div>
        <div class="ls-success-text" id="ls-success-text">
          Seu acesso foi liberado.<br/>Aproveite o LorranStack!
        </div>
        <button class="ls-cx-btn" style="margin-top:1.5rem" onclick="lsCloseCheckout()">
          Continuar →
        </button>
      </div>
    </div>
  </div>
`;
document.body.appendChild(overlay);

// ── ESTADO ──────────────────────────────────────────────────────────
let _state = {
  selectedMethod: 'pix',
  currentPaymentId: null,
  currentMpId: null,
  pixCode: null,
  pixExpiry: null,
  pollInterval: null,
  timerInterval: null,
  onSuccess: null,
  productName: '',
  amount: 0,
  planSlug: '',
};

document.getElementById('ls-cx-close').onclick = lsCloseCheckout;
overlay.addEventListener('click', e => { if (e.target === overlay) lsCloseCheckout(); });

// ── API PÚBLICA ──────────────────────────────────────────────────────
window.lsCheckout = function({ productName, amount, planSlug, successPath, onSuccess }) {
  const user = _getUser();
  if (!user) {
    sessionStorage.setItem('openModal', 'm-register');
    window.location.href = '/';
    return;
  }

  _state.productName = productName;
  _state.amount      = parseFloat(amount);
  _state.planSlug    = planSlug || '';
  _state.onSuccess   = onSuccess || null;
  _state.selectedMethod = 'pix';

  // Reset UI
  _showScreen('method');
  _setError('');
  document.getElementById('ls-cx-prod-name').textContent = productName;
  document.getElementById('ls-cx-price').innerHTML =
    'R$ ' + _state.amount.toFixed(2).replace('.', ',');
  document.querySelectorAll('.ls-cx-method').forEach(m => {
    m.classList.toggle('active', m.dataset.method === 'pix');
  });
  document.getElementById('ls-cx-confirm').textContent = 'Pagar com PIX ⚡';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.lsSelectMethod = function(method, el) {
  _state.selectedMethod = method;
  document.querySelectorAll('.ls-cx-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ls-cx-confirm').textContent =
    method === 'pix' ? 'Pagar com PIX ⚡' : 'Pagar com Cartão 💳';
};

window.lsConfirmPayment = async function() {
  const user = _getUser();
  if (!user) { lsCloseCheckout(); return; }

  const btn = document.getElementById('ls-cx-confirm');
  btn.innerHTML = '<span class="ls-spinner"></span>Processando...';
  btn.disabled = true;
  _setError('');

  try {
    const payload = {
      method:       _state.selectedMethod,
      amount:       _state.amount,
      product_name: _state.productName,
      plan_slug:    _state.planSlug,
      user_id:      user.id,
      user_email:   user.email,
      user_name:    user.name,
      success_url:  window.location.origin + (window.location.pathname) + '?checkout=success',
      cancel_url:   window.location.href,
    };

    const res  = await fetch(`${API}/create-payment`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.ok || data.error) throw new Error(data.error || 'Erro ao criar pagamento');

    if (_state.selectedMethod === 'pix') {
      _state.currentPaymentId = data.payment_id;
      _state.currentMpId      = data.mp_id;
      _state.pixCode          = data.qr_code;
      _state.pixExpiry        = new Date(data.expires_at);
      _showPixScreen(data);
    } else {
      // Cartão: redirecionar para Checkout Pro do MP
      const url = data.sandbox_url || data.checkout_url;
      window.location.href = url;
    }

  } catch (err) {
    _setError(err.message);
    btn.innerHTML = 'Tentar novamente';
    btn.disabled = false;
  }
};

function _showPixScreen(data) {
  _showScreen('pix');

  // QR Code
  const qrWrap = document.getElementById('ls-pix-qr-wrap');
  if (data.qr_base64) {
    qrWrap.innerHTML = `<img src="data:image/png;base64,${data.qr_base64}" alt="QR Code PIX"/>`;
  } else {
    qrWrap.innerHTML = `<div style="color:#3a5070;font-size:.8rem;text-align:center">QR Code não disponível<br/>Use o código abaixo</div>`;
  }

  // Código copia e cola
  document.getElementById('ls-pix-code').textContent = data.qr_code || '—';

  // Timer
  _startTimer();

  // Polling para verificar pagamento
  _startPolling();
}

window.lsCopyPix = function() {
  const code = document.getElementById('ls-pix-code').textContent;
  if (!code || code === '—') return;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.querySelector('.ls-pix-copy-btn');
    btn.textContent = '✓ Copiado!';
    btn.style.color = '#00ffaa';
    setTimeout(() => { btn.textContent = 'Copiar'; btn.style.color = ''; }, 2500);
  }).catch(() => {});
};

window.lsGoBack = function() {
  _stopPolling();
  _stopTimer();
  _showScreen('method');
  const btn = document.getElementById('ls-cx-confirm');
  btn.innerHTML = 'Pagar com PIX ⚡';
  btn.disabled = false;
};

function _startPolling() {
  _stopPolling();
  _state.pollInterval = setInterval(async () => {
    if (!_state.currentPaymentId && !_state.currentMpId) return;
    try {
      const id = _state.currentPaymentId || _state.currentMpId;
      const param = _state.currentPaymentId ? 'payment_id' : 'mp_id';
      const res  = await fetch(`${API}/payment-status?${param}=${id}`);
      const data = await res.json();

      if (data.status === 'paid') {
        _stopPolling();
        _stopTimer();
        _showSuccessScreen(data);
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        _stopPolling();
        _stopTimer();
        _setError('Pagamento não aprovado. Tente novamente.');
        _showScreen('method');
        document.getElementById('ls-cx-confirm').disabled = false;
        document.getElementById('ls-cx-confirm').textContent = 'Tentar novamente';
      }
    } catch(e) {
      // Falha silenciosa no polling
    }
  }, 3000);
}

function _stopPolling() {
  if (_state.pollInterval) { clearInterval(_state.pollInterval); _state.pollInterval = null; }
}

function _startTimer() {
  _stopTimer();
  const timerEl = document.getElementById('ls-pix-timer');
  let seconds = 30 * 60;
  _state.timerInterval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      _stopTimer();
      timerEl.textContent = '00:00';
      return;
    }
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function _stopTimer() {
  if (_state.timerInterval) { clearInterval(_state.timerInterval); _state.timerInterval = null; }
}

function _showSuccessScreen(data) {
  _showScreen('success');
  document.getElementById('ls-success-text').innerHTML =
    `Acesso ao <strong style="color:#00ccff">${_state.productName}</strong> liberado!<br/>Obrigado pela confiança 🚀`;

  if (_state.onSuccess) {
    try { _state.onSuccess(data); } catch(e) {}
  }

  // Auto-fechar após 5s
  setTimeout(() => {
    lsCloseCheckout();
    // Mostrar toast se disponível
    if (typeof toast === 'function') {
      toast(_state.productName + ' ativado com sucesso! 🎉', 'success');
    }
  }, 5000);
}

function _showScreen(name) {
  document.getElementById('ls-method-screen').style.display = name === 'method' ? 'block' : 'none';
  document.getElementById('ls-pix-screen').classList.toggle('show',   name === 'pix');
  document.getElementById('ls-success-screen').classList.toggle('show', name === 'success');
}

function _setError(msg) {
  const el = document.getElementById('ls-cx-error');
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

function lsCloseCheckout() {
  _stopPolling();
  _stopTimer();
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}
window.lsCloseCheckout = lsCloseCheckout;

function _getUser() {
  try { return JSON.parse(localStorage.getItem('ls_user') || 'null'); }
  catch { return null; }
}

})();
