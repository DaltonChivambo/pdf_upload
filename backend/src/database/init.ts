import { query } from './config';
import dotenv from 'dotenv';

dotenv.config();

async function initDatabase(): Promise<void> {
  try {
    console.log('🔄 Inicializando banco de dados...');

    // Testar conexão
    await query('SELECT NOW()');
    console.log('✅ Conectado ao banco com sucesso');

    // Criar tabela
    await query(`
      CREATE TABLE IF NOT EXISTS pdf_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        custom_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tabela pdf_files criada/verificada');

    // Criar índices
    await query(`
      CREATE INDEX IF NOT EXISTS idx_custom_name ON pdf_files(custom_name);
      CREATE INDEX IF NOT EXISTS idx_upload_date ON pdf_files(upload_date);
    `);

    console.log('✅ Índices criados/verificados');

    const testResult = await query('SELECT COUNT(*) as count FROM pdf_files');
    console.log(`📊 Total de arquivos: ${testResult.rows[0].count}`);

    console.log('🎉 Banco de dados inicializado com sucesso!');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    
    if (error.code === '3D000') {
      console.log('\n📝 Execute manualmente:');
      console.log('sudo -u postgres psql');
      console.log('CREATE DATABASE pdf_upload;');
    }
  } finally {
    process.exit();
  }
}

initDatabase();