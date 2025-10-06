import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  UploadedFile, 
  SelectedFile, 
  UploadResponse, 
  FilesResponse, 
  StatsResponse, 
  DeleteResponse,
  Message,
  Pagination 
} from './types';

const API_BASE = '/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'search'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: '0 MB', recentUploads: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<Message>({ text: '', type: 'success' });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState<string>('');

  const showMessage = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 5000);
  }, []);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const response = await axios.get<StatsResponse>(`${API_BASE}/stats`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  const loadFiles = useCallback(async (page: number = 1): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<FilesResponse>(`${API_BASE}/files?page=${page}&limit=9`);
      if (response.data.success) {
        setFiles(response.data.files);
        setPagination({
          page: response.data.pagination.page,
          totalPages: response.data.pagination.totalPages
        });
      }
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      showMessage('Erro ao carregar arquivos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  const searchFiles = useCallback(async (): Promise<void> => {
    if (searchTerm.length < 2) return;
    
    try {
      setLoading(true);
      const response = await axios.get<FilesResponse>(
        `${API_BASE}/files?search=${encodeURIComponent(searchTerm)}`
      );
      if (response.data.success) {
        setFiles(response.data.files);
        setPagination({
          page: response.data.pagination.page,
          totalPages: response.data.pagination.totalPages
        });
      }
    } catch (error) {
      console.error('Erro na busca:', error);
      showMessage('Erro na busca', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, showMessage]);

  useEffect(() => {
    loadStats();
    loadFiles();
  }, [loadStats, loadFiles]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newFiles = Array.from(event.target.files || []).filter(file => 
      file.type === 'application/pdf' && file.size <= 10 * 1024 * 1024
    );
    
    const filesWithCustomNames: SelectedFile[] = newFiles.map(file => ({
      file,
      customName: file.name.replace('.pdf', '')
    }));
    
    setSelectedFiles(prev => [...prev, ...filesWithCustomNames]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const droppedFiles = Array.from(event.dataTransfer.files).filter(file => 
      file.type === 'application/pdf' && file.size <= 10 * 1024 * 1024
    );
    
    const filesWithCustomNames: SelectedFile[] = droppedFiles.map(file => ({
      file,
      customName: file.name.replace('.pdf', '')
    }));
    
    setSelectedFiles(prev => [...prev, ...filesWithCustomNames]);
  };

  const updateCustomName = (index: number, newName: string): void => {
    setSelectedFiles(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, customName: newName } : item
      )
    );
  };

  const removeFile = (index: number): void => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<void> => {
    if (selectedFiles.length === 0) {
      showMessage('Por favor, selecione pelo menos um arquivo PDF.', 'error');
      return;
    }

    const formData = new FormData();
    const customNames = selectedFiles.map(item => item.customName);
    
    selectedFiles.forEach(item => {
      formData.append('pdfFiles', item.file);
    });
    formData.append('customNames', JSON.stringify(customNames));

    try {
      setLoading(true);
      const response = await axios.post<UploadResponse>(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        showMessage(response.data.message);
        setSelectedFiles([]);
        loadStats();
        loadFiles();
        setActiveTab('files');
      } else {
        showMessage(response.data.error || 'Erro no upload', 'error');
      }
    } catch (error: any) {
      console.error('Erro no upload:', error);
      showMessage(error.response?.data?.error || 'Erro no upload', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (fileId: string): void => {
    window.open(`${API_BASE}/download/${fileId}`, '_blank');
  };

  const deleteFile = async (fileId: string): Promise<void> => {
    if (!confirm('Tem certeza que deseja deletar este arquivo?')) return;

    try {
      const response = await axios.delete<DeleteResponse>(`${API_BASE}/files/${fileId}`);
      if (response.data.success) {
        showMessage(response.data.message);
        loadStats();
        loadFiles();
      } else {
        showMessage(response.data.error || 'Erro ao deletar arquivo', 'error');
      }
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      showMessage(error.response?.data?.error || 'Erro ao deletar arquivo', 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container">
      <div className="header">
        <h1><i className="fas fa-file-pdf"></i> Sistema de Upload de PDFs</h1>
        <p>Upload múltiplo com nomes customizados e PostgreSQL</p>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalFiles}</span>
            <span>Total de Arquivos</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalSize}</span>
            <span>Espaço Utilizado</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.recentUploads}</span>
            <span>Uploads Recentes</span>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <i className="fas fa-upload"></i> Upload
          </div>
          <div 
            className={`tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <i className="fas fa-files"></i> Arquivos
          </div>
          <div 
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <i className="fas fa-search"></i> Buscar
          </div>
        </div>

        {/* Tab Upload */}
        {activeTab === 'upload' && (
          <div className="tab-content active">
            <div 
              className="upload-area"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                <i className="fas fa-cloud-upload-alt"></i>
              </div>
              <h3>Arraste seus PDFs aqui</h3>
              <p>ou</p>
              <input 
                type="file" 
                id="fileInput" 
                className="file-input" 
                accept=".pdf" 
                multiple
                onChange={handleFileSelect}
              />
              <button 
                className="btn" 
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <i className="fas fa-folder-open"></i> Selecione os Arquivos
              </button>
              <p style={{ marginTop: '15px', color: '#7f8c8d' }}>
                <i className="fas fa-info-circle"></i> Apenas arquivos PDF • Máximo 10MB cada
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <h3>Arquivos selecionados ({selectedFiles.length}):</h3>
                {selectedFiles.map((item, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      <div className="file-icon">
                        <i className="fas fa-file-pdf"></i>
                      </div>
                      <div className="file-details">
                        <div className="file-name">{item.file.name}</div>
                        <div className="file-size">{formatFileSize(item.file.size)}</div>
                      </div>
                    </div>
                    <div>
                      <input 
                        type="text" 
                        className="custom-name-input" 
                        value={item.customName}
                        placeholder="Nome customizado"
                        onChange={(e) => updateCustomName(index, e.target.value)}
                      />
                      <button 
                        className="btn btn-danger" 
                        onClick={() => removeFile(index)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button 
                className="btn btn-success" 
                onClick={uploadFiles}
                disabled={loading || selectedFiles.length === 0}
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-upload"></i>
                )}
                {loading ? ' Enviando...' : ' Fazer Upload dos Arquivos'}
              </button>
            </div>
          </div>
        )}

        {/* Tab Arquivos */}
        {activeTab === 'files' && (
          <div className="tab-content active">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button className="btn" onClick={() => loadFiles()}>
                <i className="fas fa-sync-alt"></i> Atualizar Lista
              </button>
            </div>
            
            {loading ? (
              <div className="loading">
                <i className="fas fa-spinner fa-spin"></i> Carregando arquivos...
              </div>
            ) : (
              <>
                <div className="files-grid">
                  {files.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '40px' }}>
                      Nenhum arquivo encontrado.
                    </div>
                  ) : (
                    files.map(file => (
                      <div key={file.id} className="file-card">
                        <div className="file-card-header">
                          <div>
                            <h4><i className="fas fa-file-pdf"></i> {file.customName}</h4>
                            <small style={{ color: '#7f8c8d' }}>Original: {file.originalName}</small>
                          </div>
                          <div className="file-card-actions">
                            <button 
                              className="btn" 
                              onClick={() => downloadFile(file.id)}
                              title="Download"
                            >
                              <i className="fas fa-download"></i>
                            </button>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => deleteFile(file.id)}
                              title="Deletar"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: '10px' }}>
                          <small><strong>Tamanho:</strong> {file.fileSize}</small><br />
                          <small><strong>Upload:</strong> {file.uploadDate}</small><br />
                          <small><strong>ID:</strong> {file.id.substring(0, 8)}...</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {pagination.totalPages > 1 && (
                  <div className="pagination">
                    {pagination.page > 1 && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => loadFiles(pagination.page - 1)}
                      >
                        <i className="fas fa-chevron-left"></i> Anterior
                      </button>
                    )}
                    
                    <span>Página {pagination.page} de {pagination.totalPages}</span>
                    
                    {pagination.page < pagination.totalPages && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => loadFiles(pagination.page + 1)}
                      >
                        Próxima <i className="fas fa-chevron-right"></i>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab Busca */}
        {activeTab === 'search' && (
          <div className="tab-content active">
            <div className="search-box">
              <input 
                type="text" 
                className="search-input" 
                placeholder="Buscar por nome customizado ou original..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && searchFiles()}
              />
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button className="btn" onClick={searchFiles}>
                <i className="fas fa-search"></i> Buscar
              </button>
            </div>

            {loading ? (
              <div className="loading">
                <i className="fas fa-spinner fa-spin"></i> Buscando arquivos...
              </div>
            ) : (
              <div className="files-grid">
                {files.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '40px' }}>
                    {searchTerm ? 'Nenhum arquivo encontrado.' : 'Digite acima para buscar arquivos...'}
                  </div>
                ) : (
                  files.map(file => (
                    <div key={file.id} className="file-card">
                      <div className="file-card-header">
                        <div>
                          <h4><i className="fas fa-file-pdf"></i> {file.customName}</h4>
                          <small style={{ color: '#7f8c8d' }}>Original: {file.originalName}</small>
                        </div>
                        <div className="file-card-actions">
                          <button 
                            className="btn" 
                            onClick={() => downloadFile(file.id)}
                            title="Download"
                          >
                            <i className="fas fa-download"></i>
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <small><strong>Tamanho:</strong> {file.fileSize}</small><br />
                        <small><strong>Upload:</strong> {file.uploadDate}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;