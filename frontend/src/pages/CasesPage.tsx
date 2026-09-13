// ============================================================================
// ADALAT360 - Cases Page
// Case listing with filters and pagination
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  FileText,
  ShieldCheck,
  Timeline,
  GitBranch,
  FileSignature,
  Users,
  Download,
} from 'lucide-react';
import { casesApi } from '../../services/api';
import { Case, CaseStatus, CasePriority } from '../../types';
import { toast } from 'react-hot-toast';

const filterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  search: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

type FilterFormData = z.infer<typeof filterSchema>;

export function CasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      sort_order: 'desc',
    },
  });

  const status = watch('status');
  const priority = watch('priority');
  const search = watch('search');

  useEffect(() => {
    loadCases();
  }, [page, limit, status, priority, search, sortBy, sortOrder]);

  const loadCases = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        status: status || undefined,
        priority: priority || undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const response = await casesApi.list(params);
      setCases(response.data.cases);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error: any) {
      toast.error('Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (data: FilterFormData) => {
    setPage(1);
    const newParams = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        newParams.set(key, String(value));
      }
    });
    setSearchParams(newParams);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      return;
    }
    try {
      await casesApi.delete(caseId);
      toast.success('Case deleted successfully');
      loadCases();
    } catch (error: any) {
      toast.error('Failed to delete case');
    }
  };

  if (isLoading && cases.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-gray-600 mt-1">Manage and track all cases</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <Link to="/cases/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Case
          </Link>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('search')}
                  type="text"
                  placeholder="Search by case number, FIR, title..."
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="">All Statuses</option>
                {Object.values(CaseStatus).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="">All Priorities</option>
                {Object.values(CasePriority).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full">
                <Search className="w-4 h-4 mr-2" />
                Apply
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Cases Table */}
      <div className="card overflow-hidden">
        {isLoading && cases.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="cursor-pointer" onClick={() => handleSort('case_number')}>
                      Case Number {sortBy === 'case_number' && (
                        <ChevronDown className={`w-4 h-4 inline ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      )}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('title')}>
                      Title {sortBy === 'title' && (
                        <ChevronDown className={`w-4 h-4 inline ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      )}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('status')}>
                      Status {sortBy === 'status' && (
                        <ChevronDown className={`w-4 h-4 inline ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      )}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('priority')}>
                      Priority {sortBy === 'priority' && (
                        <ChevronDown className={`w-4 h-4 inline ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      )}
                    </th>
                    <th>Assigned Officer</th>
                    <th className="cursor-pointer" onClick={() => handleSort('created_at')}>
                      Created {sortBy === 'created_at' && (
                        <ChevronDown className={`w-4 h-4 inline ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      )}
                    </th>
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No cases found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or create a new case</p>
                      </td>
                    </tr>
                  ) : (
                    cases.map((caseItem) => (
                      <tr key={caseItem.id} className="hover:bg-gray-50">
                        <td className="font-mono font-medium text-gray-900">
                          <Link to={`/cases/${caseItem.id}`} className="hover:text-primary-600">
                            {caseItem.case_number}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/cases/${caseItem.id}`} className="font-medium text-gray-900 hover:text-primary-600 truncate block max-w-xs">
                            {caseItem.title}
                          </Link>
                          {caseItem.fir_number && (
                            <p className="text-xs text-gray-500">FIR: {caseItem.fir_number}</p>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeColor(caseItem.status)}`}>
                            {formatStatus(caseItem.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getPriorityBadgeColor(caseItem.priority)}`}>
                            {caseItem.priority}
                          </span>
                        </td>
                        <td className="text-gray-600">
                          {caseItem.assigned_officer_id ? 'Officer assigned' : 'Unassigned'}
                        </td>
                        <td className="text-gray-500 whitespace-nowrap">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/cases/${caseItem.id}`}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/cases/${caseItem.id}/documents`}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                              title="Documents"
                            >
                              <FileText className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/cases/${caseItem.id}/evidence`}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                              title="Evidence"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/cases/${caseItem.id}/timeline`}
                              className="p-2 text-gray-500 hover:text-primary-600 hover-bg-gray-100 rounded-lg"
                              title="Timeline"
                            >
                              <Timeline className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="dropdown-menu">
                                <Link to={`/cases/${caseItem.id}/entity-graph`} className="dropdown-item">
                                  <GitBranch className="w-4 h-4" />
                                  Entity Graph
                                </Link>
                                <Link to={`/bsa/generate?caseId=${caseItem.id}`} className="dropdown-item">
                                  <FileText className="w-4 h-4" />
                                  Generate BSA Certificate
                                </Link>
                                <hr className="my-1 border-gray-100" />
                                <button
                                  onClick={() => handleDelete(caseItem.id)}
                                  className="dropdown-item text-danger-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Case
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
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} cases
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="btn-secondary btn-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="btn-secondary btn-sm"
                  >
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
    OPEN: 'badge-blue',
    UNDER_INVESTIGATION: 'badge-yellow',
    CHARGE_SHEET_FILED: 'badge-purple',
    TRIAL_IN_PROGRESS: 'badge-indigo',
    JUDGMENT_RESERVED: 'badge-pink',
    DISPOSED: 'badge-green',
    APPEALED: 'badge-orange',
    CLOSED: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}

function getPriorityBadgeColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'badge-green',
    MEDIUM: 'badge-yellow',
    HIGH: 'badge-orange',
    CRITICAL: 'badge-red',
  };
  return colors[priority] || 'badge-gray';
}