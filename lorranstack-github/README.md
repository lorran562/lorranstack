# LorranStack — Marketplace de SaaS

> Plataforma para descobrir, avaliar e publicar SaaS independentes e modernas.  
> Stack: **Node.js + Express · PostgreSQL (Supabase) · HTML + TailwindCSS**

[![Deploy Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://lorranstack.vercel.app)
[![Deploy Backend](https://img.shields.io/badge/Backend-Railway-purple?logo=railway)](https://railway.app)
[![Database](https://img.shields.io/badge/Database-Supabase-green?logo=supabase)](https://supabase.com)

---

## 🗂️ Estrutura

```
lorranstack/
├── frontend/           # HTML + TailwindCSS + JS puro → deploy no Vercel
│   ├── index.html      # Homepage
│   ├── explore.html    # Listagem com filtros
│   ├── saas.html       # Detalhe do SaaS
│   ├── collections.html# Coleções curadas
│   ├── ranking.html    # Ranking semanal
│   ├── dashboard.html  # Dashboard do criador
│   ├── admin.html      # Painel admin
│   ├── creator.html    # Perfil público do criador
│   └── config.js       # Configuração de API (dev/prod)
│
├── backend/            # Node.js + Express → deploy no Railway
│   └── src/
│       ├── server.js
│       ├── database/db.js
│       ├── middleware/auth.js
│       └── routes/
│           ├── auth.js · saas.js · reviews.js
│           ├── categories.js · collections.js
│           ├── dashboard.js · admin.js
│
├── vercel.json         # Config de deploy do Vercel
└── .gitignore
```

---

## 🚀 Deploy em 3 passos

### 1. Fork ou clone este repositório

```bash
git clone https://github.com/SEU_USUARIO/lorranstack.git
cd lorranstack
```

### 2. Backend → Railway

1. Acesse [railway.app](https://railway.app) e crie uma conta
2. **New Project → Deploy from GitHub repo** → selecione este repositório
3. Configure o **Root Directory** como `backend`
4. Adicione as **variáveis de ambiente** (copie de `backend/.env.example`):

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (URI mode, pooler) |
| `JWT_SECRET` | Chave aleatória longa (64+ chars) |
| `FRONTEND_URL` | `https://lorranstack.vercel.app` |
| `NODE_ENV` | `production` |

5. Railway detecta automaticamente o `package.json` e roda `npm start`
6. Copie a URL gerada (ex: `https://lorranstack-api.up.railway.app`)

### 3. Frontend → Vercel

1. Acesse [vercel.com](https://vercel.com) e conecte seu GitHub
2. **New Project → Import** este repositório
3. **Framework Preset**: Other (Static)
4. **Root Directory**: deixe em branco (o `vercel.json` já cuida do roteamento)
5. Sem variáveis de ambiente necessárias no frontend
6. Clique em **Deploy**

> **Importante**: após ter a URL do Railway, edite `frontend/config.js` e troque  
> `https://lorranstack-api.up.railway.app/api` pela URL real do seu backend.

---

## 💻 Rodar localmente

```bash
# Backend
cd backend
cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm install
npm run dev            # → http://localhost:3000

# Frontend
# Abra frontend/index.html com Live Server (VS Code)
# ou: cd frontend && npx serve . -p 5500
```

---

## 🔑 Credenciais demo (banco Supabase)

| Usuário | Email | Senha | Role |
|---------|-------|-------|------|
| SR Lorran | admin@lorranstack.com | Admin@1234 | admin |
| Rafael Mendes | rafael@devkitpro.com | Admin@1234 | creator |

---

## 📡 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/login` | Login |
| GET | `/api/saas` | Listar SaaS |
| GET | `/api/saas/featured` | Destaques |
| GET | `/api/saas/:slug` | Detalhe |
| POST | `/api/saas/:id/upvote` | Upvote |
| POST | `/api/reviews` | Avaliar |
| GET | `/api/categories` | Categorias |
| GET | `/api/collections` | Coleções |
| GET | `/api/dashboard` | Dashboard criador |
| GET | `/api/admin/stats` | Stats admin |
| GET | `/api/health` | Health check |

---

## 🗄️ Banco de dados

Supabase project: `jkgrmlfqgprcwfooovkx` (região: sa-east-1)

Tabelas: `ls_users` · `ls_saas` · `ls_categories` · `ls_reviews` · `ls_analytics` · `ls_upvotes` · `ls_collections`

---

Construído por **SR Lorran** · LorranStack v2.0
