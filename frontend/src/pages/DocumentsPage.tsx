// ============================================================================
// ADALAT360 - Documents Page
// Document listing and management
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Filter,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Download,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { documentsApi } from '../../services/api';
import { Document, DocumentType, DocumentStatus } from '../../types';
import { toast } from 'react-hot-toast';

const filterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  documentType: z.nativeEnum(DocumentType).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  uploadedBy: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      page: 1,
      limit: 20,
    },
  });

  const caseId = watch('caseId');

  useEffect(() => {
    loadDocuments();
  }, [page, limit, caseId]);

  const loadDocuments = async () => {
    if (!selectedCaseId) {
      // No case selected - show empty state
      setDocuments([]);
      setTotal(0);
      setTotalPages(1);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
      };
      const response = await documentsApi.listByCase(selectedCaseId, params);
      setDocuments(response.data.documents);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error: any) {
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (data: FilterFormData) => {
    setPage(1);
    setSelectedCaseId(data.caseId || '');
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    try {
      await documentsApi.delete(documentId);
      toast.success('Document deleted successfully');
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to delete document');
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const response = await documentsApi.download(document.id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast.error('Failed to download document');
    }
  };

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">Manage and view case documents</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <Link to="/documents/upload" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Upload Document
          </Link>
        </div>
      </div>

      {/* Case Selector & Filters */}
      <div className="card p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Case</label>
            <select {...register('caseId')} className="input">
              <option value="">All Cases</option>
              {/* In production, fetch user's cases */}
            </select>
          </div>
          <div>
            <label className="label">Document Type</label>
            <select {...register('documentType')} className="input">
              <option value="">All Types</option>
              {Object.values(DocumentType).map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="">All Statuses</option>
              {Object.values(DocumentStatus).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              <Search className="w-4 h-4 mr-2" />
              Apply
            </button>
          </div>
        </form>
      </div>

      {/* Documents Table */}
      <div className="card overflow-hidden">
        {isLoading && documents.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Document Number</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th>Size</th>
                    <th>Uploaded By</th>
                    <th>Created</th>
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No documents found</p>
                        <p className="text-sm text-gray-400 mt-1">Upload your first document or adjust filters</p>
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="font-mono font-medium text-gray-900">
                          <Link to={`/documents/${doc.id}`} className="hover:text-primary-600">
                            {doc.document_number}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/documents/${doc.id}`} className="font-medium text-gray-900 hover:text-primary-600 truncate block max-w-xs">
                            {doc.title}
                          </Link>
                        </td>
                        <td>
                          <span className="badge badge-blue">{doc.document_type.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeColor(doc.status)}`}>
                            {formatStatus(doc.status)}
                          </span>
                        </td>
                        <td className="font-mono text-gray-600">v{doc.version}</td>
                        <td className="text-gray-500">{formatBytes(doc.file_size_bytes)}</td>
                        <td className="text-gray-600">{doc.uploaded_by_name || doc.uploaded_by.slice(0, 8)}...</td>
                        <td className="text-gray-500 whitespace-nowrap">{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/documents/${doc.id}`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button onClick={() => handleDownload(doc)} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Download">
                              <Download className="w-4 h-4" />
                            </Link>
                            <Link to={`/documents/${doc.id}/versions`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Versions">
                              <Clock className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="dropdown-menu">
                                <Link to={`/documents/${doc.id}`} className="dropdown-item">
                                  <Eye className="w-4 h-4" />
                                  View Details
                                </Link>
                                <Link to={`/documents/${doc.id}/versions`} className="dropdown-item">
                                  <Clock className="w-4 h-4" />
                                  Version History
                                </Link>
                                <hr className="my-1 border-gray-100" />
                                <button onClick={() => handleDelete(doc.id)} className="dropdown-item text-danger-600">
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} documents
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(page - 1)} disabled={page === 1} className="btn-secondary btn-sm">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm text-gray-600">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="btn-secondary btn-sm">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'badge-gray',
    SUBMITTED: 'badge-blue',
    VERIFIED: 'badge-green',
    APPROVED: 'badge-purple',
    REJECTED: 'badge-red',
    ARCHIVED: 'badge-gray',
    REDACTED: 'badge-orange',
  };
  return colors[status] || 'badge-gray';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}