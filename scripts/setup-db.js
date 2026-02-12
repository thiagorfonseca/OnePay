/* global process, console */
/**
 * SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA DO BANCO DE DADOS
 * ES Modules (compatível com "type": "module")
 *
 * IMPORTANTE:
 * - Use APENAS em ambiente local/dev.
 * - Nunca versionar credenciais no código.
 */

import pg from 'pg';
const { Client } = pg;

import fs from 'fs';
import path from 'path';
import dns from 'dns';
import util from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function requiredEnv(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function optionalEnv(name, fallback) {
  const v = (process.env[name] || '').trim();
  return v || fallback;
}

// ⚠️ Recomendação: rodar isso só local
const NODE_ENV = optionalEnv('NODE_ENV', 'development');
if (NODE_ENV === 'production') {
  throw new Error('setup-db.js não deve ser executado em produção.');
}

const dbConfig = {
  host: requiredEnv('DB_HOST'),
  port: Number(optionalEnv('DB_PORT', '5432')),
  database: optionalEnv('DB_NAME', 'postgres'),
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASS'),
  ssl: { rejectUnauthorized: false },
};

async function getIPv4(host) {
  try {
    const resolve4 = util.promisify(dns.resolve4);
    const addresses = await resolve4(host);
    if (addresses && addresses.length > 0) return addresses[0];
  } catch {
    // ignore e usa hostname
  }
  return host;
}

async function setupDatabase() {
  console.log('🔌 Inicializando conexão...');

  const hostIP = await getIPv4(dbConfig.host);
  const finalConfig = { ...dbConfig, host: hostIP };

  if (hostIP !== dbConfig.host) {
    console.log(`📡 DNS Resolvido: Usando IPv4 ${hostIP} para evitar timeout.`);
  }

  const client = new Client(finalConfig);

  try {
    console.log('⏳ Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Executando script SQL...');
    await client.query(schemaSql);

    console.log('🎉 Tabelas criadas/atualizadas com sucesso!');
    console.log('------------------------------------------------');
    console.log('👉 Agora você pode rodar "npm run dev" para abrir o site.');
  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);

    if (err && err.code === 'ETIMEDOUT') {
      console.log('\n💡 DICA: firewall/rede pode estar bloqueando a porta 5432.');
    }
  } finally {
    await client.end();
  }
}

setupDatabase();
