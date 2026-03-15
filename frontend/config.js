// LorranStack — Configuração de API
// Este arquivo é carregado por todas as páginas antes do JS principal.
// Em produção, aponta para o backend no Railway.
// Em desenvolvimento local, aponta para localhost:3000.

(function () {
  const hostname = window.location.hostname;

  const isDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local');

  window.LS_CONFIG = {
    // Troque pela URL do seu backend no Railway após o deploy
    API: isDev
      ? 'http://localhost:3000/api'
      : 'https://lorranstack-api.up.railway.app/api',

    SITE_NAME: 'LorranStack',
    SITE_URL: isDev ? 'http://localhost:5500' : 'https://lorranstack.vercel.app',
    VERSION: '2.0.0',
  };

  // Atalho global
  window.API = window.LS_CONFIG.API;
})();
