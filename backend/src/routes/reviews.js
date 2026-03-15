// =============================================
// LorranStack - Rotas de Reviews
// =============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews  — criar review
router.post('/', authenticate, [
  body('saas_id').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 2000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { saas_id, rating, comment } = req.body;

  try {
    // Verifica se SaaS existe
    const saas = await query('SELECT id FROM ls_saas WHERE id = $1 AND status IN (\'approved\',\'featured\')', [saas_id]);
    if (saas.rows.length === 0) return res.status(404).json({ error: 'SaaS não encontrado' });

    // Upsert (atualiza se já avaliou)
    const result = await query(`
      INSERT INTO ls_reviews (user_id, saas_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, saas_id)
      DO UPDATE SET rating = $3, comment = $4, updated_at = NOW()
      RETURNING *
    `, [req.user.id, saas_id, rating, comment]);

    res.status(201).json({ message: 'Avaliação registrada', review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar avaliação' });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const review = await query('SELECT * FROM ls_reviews WHERE id = $1', [req.params.id]);
    if (review.rows.length === 0) return res.status(404).json({ error: 'Review não encontrada' });

    if (review.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await query('DELETE FROM ls_reviews WHERE id = $1', [req.params.id]);
    res.json({ message: 'Review removida' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover review' });
  }
});

module.exports = router;
