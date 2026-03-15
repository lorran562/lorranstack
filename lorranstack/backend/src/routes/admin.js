// =============================================
// LorranStack - Rotas Admin
// =============================================

const express = require('express');
const { query } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, saas, reviews, pending] = await Promise.all([
      query('SELECT COUNT(*) FROM ls_users'),
      query('SELECT COUNT(*) FROM ls_saas WHERE status IN (\'approved\',\'featured\')'),
      query('SELECT COUNT(*) FROM ls_reviews'),
      query('SELECT COUNT(*) FROM ls_saas WHERE status = \'pending\''),
    ]);

    const topSaas = await query(`
      SELECT name, views, clicks, upvotes, avg_rating
      FROM ls_saas WHERE status IN ('approved','featured')
      ORDER BY views DESC LIMIT 5
    `);

    res.json({
      users: parseInt(users.rows[0].count),
      saas: parseInt(saas.rows[0].count),
      reviews: parseInt(reviews.rows[0].count),
      pending: parseInt(pending.rows[0].count),
      topSaas: topSaas.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/admin/saas/pending
router.get('/saas/pending', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, c.name AS category_name, u.name AS creator_name, u.email AS creator_email
      FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      LEFT JOIN ls_users u ON u.id = s.creator_id
      WHERE s.status = 'pending'
      ORDER BY s.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pendentes' });
  }
});

// PATCH /api/admin/saas/:id/status
router.patch('/saas/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatus = ['approved', 'rejected', 'featured', 'pending'];
  if (!validStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const result = await query(
      `UPDATE ls_saas SET status = $1, is_featured = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, name, status`,
      [status, status === 'featured', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'SaaS não encontrado' });
    res.json({ message: 'Status atualizado', saas: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// DELETE /api/admin/saas/:id
router.delete('/saas/:id', async (req, res) => {
  try {
    await query('DELETE FROM ls_saas WHERE id = $1', [req.params.id]);
    res.json({ message: 'SaaS removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover SaaS' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, email, role, is_verified, created_at,
             (SELECT COUNT(*) FROM ls_saas WHERE creator_id = ls_users.id) AS saas_count
      FROM ls_users ORDER BY created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['user', 'creator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role inválida' });
  }
  try {
    await query('UPDATE ls_users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ message: 'Role atualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar role' });
  }
});

module.exports = router;
