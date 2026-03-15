// =============================================
// LorranStack - Dashboard do Criador
// =============================================

const express = require('express');
const { query } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('creator', 'admin'));

// GET /api/dashboard  — overview dos produtos do criador
router.get('/', async (req, res) => {
  try {
    const products = await query(`
      SELECT
        s.id, s.name, s.slug, s.status, s.views, s.clicks,
        s.upvotes, s.avg_rating, s.review_count, s.created_at,
        c.name AS category_name
      FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      WHERE s.creator_id = $1
      ORDER BY s.created_at DESC
    `, [req.user.id]);

    const totals = products.rows.reduce((acc, p) => ({
      views: acc.views + (p.views || 0),
      clicks: acc.clicks + (p.clicks || 0),
      upvotes: acc.upvotes + (p.upvotes || 0),
    }), { views: 0, clicks: 0, upvotes: 0 });

    res.json({
      products: products.rows,
      totals,
      productCount: products.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dashboard' });
  }
});

// GET /api/dashboard/:saasId/analytics  — analytics detalhado
router.get('/:saasId/analytics', async (req, res) => {
  try {
    // Verifica propriedade
    const saas = await query(
      'SELECT id FROM ls_saas WHERE id = $1 AND creator_id = $2',
      [req.params.saasId, req.user.id]
    );
    if (saas.rows.length === 0) return res.status(404).json({ error: 'SaaS não encontrado' });

    // Analytics por dia (últimos 30 dias)
    const analytics = await query(`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        event_type,
        COUNT(*) AS total
      FROM ls_analytics
      WHERE saas_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day, event_type
      ORDER BY day ASC
    `, [req.params.saasId]);

    res.json(analytics.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar analytics' });
  }
});

module.exports = router;
