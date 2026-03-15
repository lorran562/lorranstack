// =============================================
// LorranStack - Rotas de SaaS Products
// =============================================

const express = require('express');
const { body, query: qv, validationResult } = require('express-validator');
const { query } = require('../database/db');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const slugify = require('slugify');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /api/saas  — lista com filtros
// ──────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      category, search, sort = 'created_at',
      order = 'DESC', page = 1, limit = 12,
      status = 'approved'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    // Admin pode ver todos; outros só veem aprovados
    if (req.user?.role === 'admin') {
      if (status !== 'all') {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }
    } else {
      conditions.push(`s.status IN ('approved', 'featured')`);
    }

    if (category) {
      params.push(category);
      conditions.push(`c.slug = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.name ILIKE $${params.length} OR s.tagline ILIKE $${params.length} OR s.description ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Ordena
    const sortMap = {
      created_at: 's.created_at',
      upvotes: 's.upvotes',
      avg_rating: 's.avg_rating',
      views: 's.views',
      name: 's.name',
    };
    const sortCol = sortMap[sort] || 's.created_at';
    const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    params.push(parseInt(limit), offset);

    const sql = `
      SELECT
        s.id, s.name, s.slug, s.tagline, s.logo_url,
        s.pricing_type, s.price, s.price_label,
        s.upvotes, s.avg_rating, s.review_count, s.views,
        s.status, s.is_featured, s.created_at,
        c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
        u.name AS creator_name, u.avatar_url AS creator_avatar
      FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      LEFT JOIN ls_users u ON u.id = s.creator_id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countSql = `
      SELECT COUNT(*) FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      ${where}
    `;

    const [data, count] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
    ]);

    res.json({
      data: data.rows,
      pagination: {
        total: parseInt(count.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count.rows[0].count / parseInt(limit)),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar SaaS' });
  }
});

// ──────────────────────────────────────────────
// GET /api/saas/featured  — SaaS em destaque
// ──────────────────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.id, s.name, s.slug, s.tagline, s.logo_url,
             s.pricing_type, s.price_label, s.upvotes, s.avg_rating, s.review_count,
             c.name AS category_name, c.icon AS category_icon,
             u.name AS creator_name
      FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      LEFT JOIN ls_users u ON u.id = s.creator_id
      WHERE s.is_featured = TRUE AND s.status IN ('approved', 'featured')
      ORDER BY s.upvotes DESC
      LIMIT 6
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar destaques' });
  }
});

// ──────────────────────────────────────────────
// GET /api/saas/:slug  — detalhes de um SaaS
// ──────────────────────────────────────────────
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.*,
        c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
        u.name AS creator_name, u.email AS creator_email,
        u.avatar_url AS creator_avatar, u.bio AS creator_bio, u.website AS creator_website
      FROM ls_saas s
      LEFT JOIN ls_categories c ON c.id = s.category_id
      LEFT JOIN ls_users u ON u.id = s.creator_id
      WHERE s.slug = $1 AND (
        s.status IN ('approved', 'featured')
        ${req.user?.role === 'admin' ? 'OR TRUE' : ''}
      )
    `, [req.params.slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SaaS não encontrado' });
    }

    // Registra view
    const saas = result.rows[0];
    query(
      `INSERT INTO ls_analytics (saas_id, event_type, user_id) VALUES ($1, 'view', $2)`,
      [saas.id, req.user?.id || null]
    ).catch(() => {});

    query(`UPDATE ls_saas SET views = views + 1 WHERE id = $1`, [saas.id]).catch(() => {});

    // Busca reviews
    const reviews = await query(`
      SELECT r.*, u.name AS user_name, u.avatar_url AS user_avatar
      FROM ls_reviews r
      LEFT JOIN ls_users u ON u.id = r.user_id
      WHERE r.saas_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [saas.id]);

    res.json({ ...saas, reviews: reviews.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar SaaS' });
  }
});

// ──────────────────────────────────────────────
// POST /api/saas  — cadastrar novo SaaS
// ──────────────────────────────────────────────
router.post('/', authenticate, requireRole('creator', 'admin'), [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Nome: 2-200 caracteres'),
  body('description').trim().isLength({ min: 20 }).withMessage('Descrição muito curta'),
  body('website_url').isURL().withMessage('URL inválida'),
  body('category_id').isUUID().withMessage('Categoria inválida'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      name, tagline, description, category_id,
      logo_url, screenshots, video_url, website_url,
      pricing_type, price, price_label, tags
    } = req.body;

    // Gera slug único
    let slug = slugify(name, { lower: true, strict: true });
    const existing = await query('SELECT id FROM ls_saas WHERE slug LIKE $1', [`${slug}%`]);
    if (existing.rows.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = await query(`
      INSERT INTO ls_saas
        (name, slug, tagline, description, category_id, creator_id,
         logo_url, screenshots, video_url, website_url,
         pricing_type, price, price_label, tags, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      name, slug, tagline, description, category_id, req.user.id,
      logo_url, JSON.stringify(screenshots || []),
      video_url, website_url,
      pricing_type || 'free',
      price || null, price_label,
      JSON.stringify(tags || []),
      req.user.role === 'admin' ? 'approved' : 'pending'
    ]);

    res.status(201).json({
      message: req.user.role === 'admin'
        ? 'SaaS publicado com sucesso!'
        : 'SaaS enviado para aprovação!',
      saas: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar SaaS' });
  }
});

// ──────────────────────────────────────────────
// PUT /api/saas/:id  — editar SaaS
// ──────────────────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Verifica propriedade
    const saas = await query('SELECT * FROM ls_saas WHERE id = $1', [req.params.id]);
    if (saas.rows.length === 0) return res.status(404).json({ error: 'SaaS não encontrado' });

    const s = saas.rows[0];
    if (s.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const {
      name, tagline, description, category_id,
      logo_url, screenshots, video_url, website_url,
      pricing_type, price, price_label, tags
    } = req.body;

    const result = await query(`
      UPDATE ls_saas SET
        name         = COALESCE($1, name),
        tagline      = COALESCE($2, tagline),
        description  = COALESCE($3, description),
        category_id  = COALESCE($4, category_id),
        logo_url     = COALESCE($5, logo_url),
        screenshots  = COALESCE($6, screenshots),
        video_url    = COALESCE($7, video_url),
        website_url  = COALESCE($8, website_url),
        pricing_type = COALESCE($9, pricing_type),
        price        = COALESCE($10, price),
        price_label  = COALESCE($11, price_label),
        tags         = COALESCE($12, tags)
      WHERE id = $13
      RETURNING *
    `, [
      name, tagline, description, category_id,
      logo_url,
      screenshots ? JSON.stringify(screenshots) : null,
      video_url, website_url, pricing_type, price, price_label,
      tags ? JSON.stringify(tags) : null,
      req.params.id
    ]);

    res.json({ message: 'SaaS atualizado', saas: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar SaaS' });
  }
});

// ──────────────────────────────────────────────
// POST /api/saas/:id/upvote
// ──────────────────────────────────────────────
router.post('/:id/upvote', authenticate, async (req, res) => {
  try {
    // Tenta inserir upvote (unique constraint previne duplicatas)
    const existing = await query(
      'SELECT id FROM ls_upvotes WHERE user_id = $1 AND saas_id = $2',
      [req.user.id, req.params.id]
    );

    if (existing.rows.length > 0) {
      // Remove upvote (toggle)
      await query('DELETE FROM ls_upvotes WHERE user_id = $1 AND saas_id = $2', [req.user.id, req.params.id]);
      await query('UPDATE ls_saas SET upvotes = upvotes - 1 WHERE id = $1', [req.params.id]);
      return res.json({ message: 'Upvote removido', upvoted: false });
    }

    await query('INSERT INTO ls_upvotes (user_id, saas_id) VALUES ($1, $2)', [req.user.id, req.params.id]);
    await query('UPDATE ls_saas SET upvotes = upvotes + 1 WHERE id = $1', [req.params.id]);

    query(`INSERT INTO ls_analytics (saas_id, event_type, user_id) VALUES ($1, 'upvote', $2)`, [req.params.id, req.user.id]).catch(() => {});

    res.json({ message: 'Upvote registrado', upvoted: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar upvote' });
  }
});

// ──────────────────────────────────────────────
// POST /api/saas/:id/click  — registra clique no link
// ──────────────────────────────────────────────
router.post('/:id/click', optionalAuth, async (req, res) => {
  try {
    await query('UPDATE ls_saas SET clicks = clicks + 1 WHERE id = $1', [req.params.id]);
    query(`INSERT INTO ls_analytics (saas_id, event_type, user_id) VALUES ($1, 'click', $2)`,
      [req.params.id, req.user?.id || null]).catch(() => {});
    res.json({ message: 'Clique registrado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar clique' });
  }
});

module.exports = router;
