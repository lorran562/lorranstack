// =============================================
// LorranStack - Servidor Principal (Express)
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// Segurança & middlewares globais
// ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads estáticos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api', limiter);

// Rate limiting para auth (mais restrito)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

// ──────────────────────────────────────────────
// Rotas
// ──────────────────────────────────────────────
app.use('/api/auth',       authLimiter, require('./routes/auth'));
app.use('/api/saas',       require('./routes/saas'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/collections',require('./routes/collections'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/admin',      require('./routes/admin'));

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'LorranStack API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────
// Error handler global
// ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Erro interno do servidor',
  });
});

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 LorranStack API rodando em http://localhost:${PORT}`);
  console.log(`📄 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
