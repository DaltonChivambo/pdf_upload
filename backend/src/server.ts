import express, { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import { query } from './database/config';
import { 
  UploadResponse, 
  FilesResponse, 
  StatsResponse, 
  DeleteResponse,
  HealthResponse,
  UploadedFile 
} from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760');

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Criar diretório de uploads
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, 'pdf-' + uniqueSuffix + '-' + safeName);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimes = ['application/pdf', 'application/x-pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Middleware de erro
const handleUploadError = (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const response: UploadResponse = {
        success: false,
        message: '',
        files: [],
        error: 'Arquivo muito grande. Máximo 10MB permitido.'
      };
      return res.status(400).json(response);
    }
  }
  const response: UploadResponse = {
    success: false,
    message: '',
    files: [],
    error: error.message
  };
  res.status(400).json(response);
};

// Função utilitária
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Rotas da API
app.get('/api/health', (req: Request, res: Response<HealthResponse>) => {
  const response: HealthResponse = {
    success: true,
    message: 'Backend está funcionando!',
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Upload de arquivos
app.post('/api/upload', upload.array('pdfFiles', 10), handleUploadError, async (req: Request, res: Response<UploadResponse>) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      const response: UploadResponse = {
        success: false,
        message: '',
        files: [],
        error: 'Nenhum arquivo selecionado'
      };
      return res.status(400).json(response);
    }

    const files = req.files as Express.Multer.File[];
    const { customNames } = req.body;
    let customNamesArray: string[] = [];

    try {
      customNamesArray = customNames ? JSON.parse(customNames) : [];
    } catch (e) {
      const response: UploadResponse = {
        success: false,
        message: '',
        files: [],
        error: 'Formato inválido para nomes customizados'
      };
      return res.status(400).json(response);
    }

    const results: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const customName = customNamesArray[i] || file.originalname.replace('.pdf', '');
      const fileId = uuidv4();

      const result = await query(
        `INSERT INTO pdf_files 
         (id, custom_name, original_name, file_name, file_path, file_size, mime_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [fileId, customName, file.originalname, file.filename, file.path, file.size, file.mimetype]
      );

      results.push({
        id: fileId,
        customName,
        originalName: file.originalname,
        fileName: file.filename,
        fileSize: formatFileSize(file.size),
        uploadDate: new Date().toLocaleString('pt-BR'),
        downloadUrl: `/api/download/${fileId}`
      });
    }

    const response: UploadResponse = {
      success: true,
      message: `${results.length} arquivo(s) upload realizado com sucesso!`,
      files: results
    };
    res.json(response);

  } catch (error: any) {
    console.error('Erro no upload:', error);
    const response: UploadResponse = {
      success: false,
      message: '',
      files: [],
      error: 'Erro interno no servidor'
    };
    res.status(500).json(response);
  }
});

// Listar arquivos
app.get('/api/files', async (req: Request, res: Response<FilesResponse>) => {
  try {
    const { search, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    let queryParams: any[] = [limitNum, offset];

    if (search) {
      whereClause = `WHERE custom_name ILIKE $3 OR original_name ILIKE $3`;
      queryParams.push(`%${search}%`);
    }

    const result = await query(
      `SELECT * FROM pdf_files 
       ${whereClause} 
       ORDER BY upload_date DESC 
       LIMIT $1 OFFSET $2`,
      queryParams
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM pdf_files ${whereClause}`,
      search ? [`%${search}%`] : []
    );

    const files: UploadedFile[] = result.rows.map(file => ({
      id: file.id,
      customName: file.custom_name,
      originalName: file.original_name,
      fileName: file.file_name,
      fileSize: formatFileSize(file.file_size),
      uploadDate: new Date(file.upload_date).toLocaleString('pt-BR'),
      downloadUrl: `/api/download/${file.id}`
    }));

    const response: FilesResponse = {
      success: true,
      files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
      }
    };
    res.json(response);

  } catch (error: any) {
    console.error('Erro ao listar arquivos:', error);
    const response: FilesResponse = {
      success: false,
      files: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      error: 'Erro ao carregar arquivos'
    };
    res.status(500).json(response);
  }
});

// Download de arquivo
app.get('/api/download/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM pdf_files WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '..', file.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Arquivo físico não encontrado' });
    }

    res.download(filePath, `${file.custom_name}.pdf`);

  } catch (error: any) {
    console.error('Erro no download:', error);
    res.status(500).json({ success: false, error: 'Erro interno no servidor' });
  }
});

// Deletar arquivo
app.delete('/api/files/:id', async (req: Request, res: Response<DeleteResponse>) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM pdf_files WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const response: DeleteResponse = {
        success: false,
        message: '',
        error: 'Arquivo não encontrado'
      };
      return res.status(404).json(response);
    }

    const file = result.rows[0];

    await query('DELETE FROM pdf_files WHERE id = $1', [id]);

    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    const response: DeleteResponse = {
      success: true,
      message: 'Arquivo deletado com sucesso'
    };
    res.json(response);

  } catch (error: any) {
    console.error('Erro ao deletar:', error);
    const response: DeleteResponse = {
      success: false,
      message: '',
      error: 'Erro ao deletar arquivo'
    };
    res.status(500).json(response);
  }
});

// Estatísticas
app.get('/api/stats', async (req: Request, res: Response<StatsResponse>) => {
  try {
    const totalFiles = await query('SELECT COUNT(*) FROM pdf_files');
    const totalSize = await query('SELECT SUM(file_size) as total_size FROM pdf_files');
    const recentUploads = await query(
      'SELECT COUNT(*) FROM pdf_files WHERE upload_date >= NOW() - INTERVAL \'7 days\''
    );

    const response: StatsResponse = {
      success: true,
      stats: {
        totalFiles: parseInt(totalFiles.rows[0].count),
        totalSize: formatFileSize(parseInt(totalSize.rows[0].total_size || '0')),
        recentUploads: parseInt(recentUploads.rows[0].count)
      }
    };
    res.json(response);

  } catch (error: any) {
    console.error('Erro nas estatísticas:', error);
    const response: StatsResponse = {
      success: false,
      stats: { totalFiles: 0, totalSize: '0 Bytes', recentUploads: 0 },
      error: 'Erro ao carregar estatísticas'
    };
    res.status(500).json(response);
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend TypeScript rodando em http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${path.resolve(UPLOAD_DIR)}`);
});