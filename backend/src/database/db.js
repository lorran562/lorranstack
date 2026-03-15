// =============================================
// LorranStack - Conexão com PostgreSQL
// =============================================

const { Pool } = require('pg');

// Cria pool de conexões
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'lorranstack',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

// Testa conexão ao iniciar
pool.on('connect', () => {
  console.log('✅ PostgreSQL conectado');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool PostgreSQL:', err.message);
});

/**
 * Executa uma query no banco de dados
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Query (${duration}ms):`, text.substring(0, 80));
    }
    return result;
  } catch (err) {
    console.error('❌ Erro na query:', err.message);
    throw err;
  }
}

/**
 * Obtém um cliente do pool para transações
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };

  client.release = () => {
    client.query = originalQuery;
    client.release = release;
    return release();
  };

  return client;
}

module.exports = { query, getClient, pool };
