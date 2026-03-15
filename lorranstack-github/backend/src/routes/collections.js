// =============================================
// LorranStack - Rotas de Coleções
// =============================================
const express = require('express');
const { query } = require('../database/db');
const router = express.Router();

// GET /api/collections
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, u.name AS curator_name
      FROM ls_collections c
      LEFT JOIN ls_users u ON u.id = c.curator_id
      ORDER BY c.is_official DESC, c.view_count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar coleções' });
  }
});

// GET /api/collections/:slug
router.get('/:slug', async (req, res) => {
  try {
    const col = await query(
      `SELECT c.*, u.name AS curator_name FROM ls_collections c
       LEFT JOIN ls_users u ON u.id = c.curator_id
       WHERE c.slug = $1`, [req.params.slug]
    );
    if (!col.rows.length) return res.status(404).json({ error: 'Coleção não encontrada' });

    const c = col.rows[0];
    const ids = c.saas_ids;
    let products = [];

    if (ids && ids.length) {
      const placeholders = ids.map((_,i) => `$${i+1}`).join(',');
      const p = await query(
        `SELECT s.id, s.name, s.slug, s.tagline, s.logo_url,
                s.pricing_type, s.price_label, s.upvotes, s.avg_rating, s.review_count,
                c2.name AS category_name, c2.icon AS category_icon
         FROM ls_saas s
         LEFT JOIN ls_categories c2 ON c2.id = s.category_id
         WHERE s.id IN (${placeholders})`, ids
      );
      products = p.rows;
    }

    // Incrementa view_count
    query('UPDATE ls_collections SET view_count = view_count + 1 WHERE id = $1', [c.id]).catch(()=>{});

    res.json({ ...c, products });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar coleção' });
  }
});

module.exports = router;
