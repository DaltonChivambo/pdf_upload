export interface UploadedFile {
  id: string;
  customName: string;
  originalName: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  downloadUrl: string;
}

export interface SelectedFile {
  file: File;
  customName: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  files: UploadedFile[];
  error?: string;
}

export interface FilesResponse {
  success: boolean;
  files: UploadedFile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface StatsResponse {
  success: boolean;
  stats: {
    totalFiles: number;
    totalSize: string;
    recentUploads: number;
  };
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface Message {
  text: string;
  type: 'success' | 'error';
}

export interface Pagination {
  page: number;
  totalPages: number;
}