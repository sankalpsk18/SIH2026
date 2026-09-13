// ============================================================================
// ADALAT360 - Document Detail Page
// Detailed view of a single document with version history
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Download,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  Clock,
  FileText,
  ShieldCheck,
  Timeline,
  GitBranch,
  FileSignature,
  Users,
  Settings,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { documentsApi } from '../../services/api';
import { Document, DocumentVersion, DocumentType, DocumentStatus } from '../../types';
import { toast } from 'react-hot-toast';

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'versions' | 'ocr' | 'entities' | 'custody'>('details');

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
    setIsLoading(true);
    try {
      const [docRes, verRes] = await Promise.all([
        documentsApi.get(documentId!),
        documentsApi.getVersions(documentId!),
      ]);
      setDocument(docRes.data);
      setVersions(verRes.data);
    } catch (error: any) {
      toast.error('Failed to load document');
      navigate('/documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    try {
      await documentsApi.delete(documentId!);
      toast.success('Document deleted successfully');
      navigate('/documents');
    } catch (error: any) {
      toast.error('Failed to delete document');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Document not found</h3>
        <button onClick={() => navigate('/documents')} className="btn-primary">Back to Documents</button>
      </div>
    );
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: <FileText className="w-4 h-4" /> },
    { id: 'versions', label: 'Versions', icon: <Clock className="w-4 h-4" /> },
    { id: 'ocr', label: 'OCR Text', icon: <FileText className="w-4 h-4" /> },
    { id: 'entities', label: 'Entities', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'custody', label: 'Custody', icon: <Timeline className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/documents')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
              <span className="badge badge-blue">{document.document_type.replace(/_/g, ' ')}</span>
              <span className={`badge ${getStatusBadgeColor(document.status)}`}>
                {formatStatus(document.status)}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{document.document_number} • v{document.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Link to={`/documents/${documentId}/versions`} className="btn-secondary">
            <Clock className="w-4 h-4 mr-2" />
            Version History
          </Link>
          <button onClick={handleDownload} className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
        </div>
      </div>

      {/* Document Info Bar */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <InfoItem label="Document Number" value={document.document_number} />
          <InfoItem label="File Name" value={document.original_filename} />
          <InfoItem label="MIME Type" value={document.mime_type} />
          <InfoItem label="File Size" value={formatBytes(document.file_size_bytes)} />
          <InfoItem label="SHA-256" value={`${document.file_hash_sha256.slice(0, 16)}...`} />
          <InfoItem label="Uploaded" value={new Date(document.created_at).toLocaleDateString()} />
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'details' && <DetailsTab document={document} />}
          {activeTab === 'versions' && <VersionsTab versions={versions} />}
          {activeTab === 'ocr' && <OcrTab document={document} />}
          {activeTab === 'entities' && <EntitiesTab document={document} />}
          {activeTab === 'custody' && <CustodyTab documentId={document.id} />}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ document }: { document: Document }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Basic Information</h3>
          <dl className="space-y-4">
            <DetailItem label="Title" value={document.title} />
            <DetailItem label="Description" value={document.description || '—'} />
            <DetailItem label="Document Number" value={document.document_number} />
            <DetailItem label="Document Type" value={document.document_type.replace(/_/g, ' ')} />
            <DetailItem label="Status" value={formatStatus(document.status)} />
            <DetailItem label="Version" value={`${document.version} (${document.is_latest_version ? 'Latest' : 'Historical'})`} />
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">File Information</h3>
          <dl className="space-y-4">
            <DetailItem label="Original Filename" value={document.original_filename} />
            <DetailItem label="Stored Filename" value={document.stored_filename} />
            <DetailItem label="MIME Type" value={document.mime_type} />
            <DetailItem label="File Size" value={formatBytes(document.file_size_bytes)} />
            <DetailItem label="SHA-256 Hash" value={document.file_hash_sha256} />
            <DetailItem label="Encryption Algorithm" value={document.encryption_algorithm} />
            <DetailItem label="Storage Path" value={document.storage_path} />
            <DetailItem label="Storage Bucket" value={document.storage_bucket} />
          </dl>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">OCR Information</h3>
        <dl className="space-y-4">
          <DetailItem label="OCR Language" value={document.ocr_language?.toUpperCase() || '—'} />
          <DetailItem label="OCR Confidence" value={document.ocr_confidence ? `${document.ocr_confidence}%` : '—'} />
          <DetailItem label="OCR Processed At" value={document.ocr_processed_at ? new Date(document.ocr_processed_at).toLocaleString() : '—'} />
        </dl>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {document.tags?.length ? (
            document.tags.map(tag => (
              <span key={tag} className="badge-secondary">{tag}</span>
            ))
          ) : (
            <span className="text-gray-500 text-sm">No tags</span>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Metadata</h3>
        <pre className="bg-gray-100 p-4 rounded-lg text-xs text-gray-700 overflow-x-auto">
          {JSON.stringify(document.metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function VersionsTab({ versions }: { versions: DocumentVersion[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Version History ({versions.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>File Hash</th>
              <th>Size</th>
              <th>Created By</th>
              <th>Created At</th>
              <th>Changes Summary</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No versions found</td>
              </tr>
            ) : (
              versions.map((ver) => (
                <tr key={`${ver.document_id}-${ver.version}`} className="hover:bg-gray-50">
                  <td className="font-mono font-medium text-gray-900">v{ver.version}</td>
                  <td className="font-mono text-sm text-gray-600">{ver.file_hash_sha256.slice(0, 16)}...</td>
                  <td className="text-gray-500">{formatBytes(ver.file_size_bytes)}</td>
                  <td className="text-gray-600">{ver.created_by.slice(0, 8)}...</td>
                  <td className="text-gray-500">{new Date(ver.created_at).toLocaleString()}</td>
                  <td className="text-gray-600 max-w-xs truncate">{ver.changes_summary || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OcrTab({ document }: { document: Document }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">OCR Extracted Text</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Language: {document.ocr_language?.toUpperCase() || '—'}
            {document.ocr_confidence && (
              <span className="ml-2 badge badge-green">Confidence: {document.ocr_confidence}%</span>
            )}
          </span>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-6 max-h-[60vh] overflow-y-auto font-mono text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
        {document.ocr_text ? (
          document.ocr_text
        ) : (
          <span className="text-gray-500">No OCR text available. OCR processing may still be in progress.</span>
        )}
      </div>
    </div>
  );
}

function EntitiesTab({ document }: { document: Document }) {
  const entities = document.extracted_entities || {};

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Extracted Entities</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(entities).map(([key, values]) => (
          values && values.length > 0 && (
            <div key={key} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 capitalize">{key.replace(/_/g, ' ')}</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(values)).map((value, i) => (
                  <span key={i} className="badge-secondary text-xs">{value}</span>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
      {Object.keys(entities).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No entities extracted yet. Entity extraction runs automatically after OCR.</p>
        </div>
      )}
    </div>
  );
}

function CustodyTab({ documentId }: { documentId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Custody Events</h3>
      <p className="text-gray-500 text-sm">View custody events at <a href={`/blockchain/events?documentId=${documentId}`} className="text-primary-600 hover:underline">Blockchain Events page</a></p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'badge-gray', SUBMITTED: 'badge-blue', VERIFIED: 'badge-green',
    APPROVED: 'badge-purple', REJECTED: 'badge-red', ARCHIVED: 'badge-gray',
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