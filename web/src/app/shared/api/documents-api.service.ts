import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'VECTORIZED';

export interface DocumentRow {
  id: string;
  firmId: string;
  originalName: string;
  sizeBytes: number;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private api = inject(ApiClient);

  /**
   * Upload a single file. The backend creates a `Document` row in
   * PENDING state and enqueues an OCR job — listDocuments() will
   * surface the row even before OCR completes.
   */
  uploadDocument(file: File): Promise<DocumentRow> {
    return this.api.upload<DocumentRow>('documents', file);
  }

  listDocuments(): Promise<DocumentRow[]> {
    return this.api.get<DocumentRow[]>('documents');
  }

  getDocument(id: string): Promise<DocumentRow> {
    return this.api.get<DocumentRow>(`documents/${id}`);
  }

  renameDocument(id: string, originalName: string): Promise<DocumentRow> {
    return this.api.patch<DocumentRow>(`documents/${id}`, { originalName });
  }

  deleteDocument(id: string): Promise<void> {
    return this.api.delete<void>(`documents/${id}`);
  }

  deleteDocuments(ids: string[]): Promise<void> {
    return this.api.delete<void>('documents', { ids });
  }
}
