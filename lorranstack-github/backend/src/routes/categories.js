// =============================================
// LorranStack - Rotas de Categorias
// =============================================

const express = require('express');
const { query } = require('../database/db');

const router = express.Router();

// GET /api/categories  — lista todas com contagem de SaaS
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.*,
        COUNT(s.id) FILTER (WHERE s.status IN ('approved','featured')) AS saas_count
      FROM ls_categories c
      LEFT JOIN ls_saas s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

module.exports = router;
