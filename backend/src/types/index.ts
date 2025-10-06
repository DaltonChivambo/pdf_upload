export interface PDFFile {
  id: string;
  custom_name: string;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  upload_date: Date;
  updated_at: Date;
}

export interface UploadedFile {
  id: string;
  customName: string;
  originalName: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  downloadUrl: string;
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

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}