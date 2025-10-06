import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Adicione debug para ver as configurações
console.log('🔧 Configurações do Banco:');
console.log('   Host:', process.env.DB_HOST);
console.log('   Port:', process.env.DB_PORT);
console.log('   Database:', process.env.DB_NAME);
console.log('   User:', process.env.DB_USER);
console.log('   Password length:', process.env.DB_PASSWORD?.length || 0);

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pdf_upload',
  password: process.env.DB_PASSWORD || '', // Senha vazia como fallback
  port: parseInt(process.env.DB_PORT || '5432'),
});

pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err: Error) => {
  console.error('❌ Erro na conexão PostgreSQL:', err.message);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export { pool };