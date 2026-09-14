// ============================================================================
// ADALAT360 - Evidence Page
// Evidence listing and management
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
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Download,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
  QrCode,
  ArrowRightLeft,
  FlaskConical,
  Gavel,
  Truck,
  Archive,
} from 'lucide-react';
import { evidenceApi } from '../../services/api';
import { Evidence, EvidenceType, EvidenceStatus } from '../../types';
import { toast } from 'react-hot-toast';

const filterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  evidenceType: z.nativeEnum(EvidenceType).optional(),
  status: z.nativeEnum(EvidenceStatus).optional(),
  current_custodian_id: z.string().uuid().optional(),
  forensic_lab_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

export function EvidencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
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
    loadEvidence();
  }, [page, limit, caseId]);

  const loadEvidence = async () => {
    if (!selectedCaseId) {
      // No case selected - show empty state
      setEvidence([]);
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
      const response = await evidenceApi.listByCase(selectedCaseId, params);
      setEvidence(response.data.evidence);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error: any) {
      toast.error('Failed to load evidence');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (data: FilterFormData) => {
    setPage(1);
    setSelectedCaseId(data.caseId || '');
  };

  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
      return;
    }
    // Note: Delete endpoint not implemented in API yet
    toast.error('Delete not implemented');
  };

  const getStatusIcon = (status: EvidenceStatus) => {
    const icons: Record<EvidenceStatus, React.ReactNode> = {
      SEIZED: <ShieldCheck className="w-4 h-4" />,
      IN_CUSTODY: <ShieldCheck className="w-4 h-4" />,
      SENT_FOR_ANALYSIS: <FlaskConical className="w-4 h-4" />,
      UNDER_ANALYSIS: <FlaskConical className="w-4 h-4" />,
      ANALYSIS_COMPLETE: <CheckCircle2 className="w-4 h-4" />,
      PRESENTED_IN_COURT: <Gavel className="w-4 h-4" />,
      RETURNED: <ArrowRightLeft className="w-4 h-4" />,
      DISPOSED: <Archive className="w-4 h-4" />,
      DESTROYED: <Trash2 className="w-4 h-4" />,
    };
    return icons[status] || <ShieldCheck className="w-4 h-4" />;
  };

  if (isLoading && evidence.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Evidence</h1>
          <p className="text-gray-600 mt-1">Manage physical and digital evidence</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <Link to="/evidence/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Evidence
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
            </select>
          </div>
          <div>
            <label className="label">Evidence Type</label>
            <select {...register('evidenceType')} className="input">
              <option value="">All Types</option>
              {Object.values(EvidenceType).map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="">All Statuses</option>
              {Object.values(EvidenceStatus).map(s => (
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

      {/* Evidence Table */}
      <div className="card overflow-hidden">
        {isLoading && evidence.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Evidence Number</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Seized</th>
                    <th>Current Custodian</th>
                    <th>Location</th>
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No evidence found</p>
                        <p className="text-sm text-gray-400 mt-1">Add your first evidence item or adjust filters</p>
                      </td>
                    </tr>
                  ) : (
                    evidence.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="font-mono font-medium text-gray-900">
                          <Link to={`/evidence/${item.id}`} className="hover:text-primary-600">
                            {item.evidence_number}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/evidence/${item.id}`} className="font-medium text-gray-900 hover:text-primary-600 truncate block max-w-xs">
                            {item.name}
                          </Link>
                          {item.description && (
                            <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-blue">{item.evidence_type.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className={`badge ${getStatusBadgeColor(item.status)}`}>
                              {formatStatus(item.status)}
                            </span>
                          </div>
                        </td>
                        <td className="text-gray-500 whitespace-nowrap">
                          {new Date(item.seized_at).toLocaleDateString()}
                        </td>
                        <td className="text-gray-600">
                          {item.current_custodian_name || item.current_custodian_id?.slice(0, 8) + '...' || '—'}
                        </td>
                        <td className="text-gray-500 truncate max-w-xs">
                          {item.current_location || '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/evidence/${item.id}`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link to={`/evidence/${item.id}/custody-chain`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Custody Chain">
                              <Clock className="w-4 h-4" />
                            </Link>
                            <Link to={`/evidence/${item.id}/qr-code`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="QR Code">
                              <QrCode className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="dropdown-menu">
                                <Link to={`/evidence/${item.id}/transfer`} className="dropdown-item">
                                  <ArrowRightLeft className="w-4 h-4" />
                                  Transfer Custody
                                </Link>
                                <Link to={`/evidence/${item.id}/send-to-lab`} className="dropdown-item">
                                  <FlaskConical className="w-4 h-4" />
                                  Send to Lab
                                </Link>
                                <Link to={`/evidence/${item.id}/court-submission`} className="dropdown-item">
                                  <Gavel className="w-4 h-4" />
                                  Submit to Court
                                </Link>
                                <hr className="my-1 border-gray-100" />
                                <button onClick={() => handleDelete(item.id)} className="dropdown-item text-danger-600">
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
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} evidence items
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
    SEIZED: 'badge-blue',
    IN_CUSTODY: 'badge-green',
    SENT_FOR_ANALYSIS: 'badge-yellow',
    UNDER_ANALYSIS: 'badge-orange',
    ANALYSIS_COMPLETE: 'badge-green',
    PRESENTED_IN_COURT: 'badge-purple',
    RETURNED: 'badge-blue',
    DISPOSED: 'badge-gray',
    DESTROYED: 'badge-red',
  };
  return colors[status] || 'badge-gray';
}