// ============================================================================
// ADALAT360 - Audit Page
// Audit logs and compliance reporting (Admin/Auditor only)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Eye,
  AlertTriangle,
  Shield,
  Clock,
  User,
  Globe,
  Database,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react';
import { auditApi } from '../services/api';
import { AuditEvent } from '../types';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const auditQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  event_type: z.string().optional(),
  event_category: z.string().optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().uuid().optional(),
  action: z.string().optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
  severity: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  correlation_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(50),
});

type AuditQueryFormData = z.infer<typeof auditQuerySchema>;

export function AuditPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showComplianceReport, setShowComplianceReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AuditQueryFormData>({
    resolver: zodResolver(auditQuerySchema),
    defaultValues: {
      page: 1,
      limit: 50,
    },
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  useEffect(() => {
    loadEvents();
  }, [page, limit, startDate, endDate]);

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        user_id: watch('user_id') || undefined,
        event_type: watch('event_type') || undefined,
        event_category: watch('event_category') || undefined,
        resource_type: watch('resource_type') || undefined,
        resource_id: watch('resource_id') || undefined,
        action: watch('action') || undefined,
        outcome: watch('outcome') || undefined,
        severity: watch('severity') || undefined,
        correlation_id: watch('correlation_id') || undefined,
      };
      const response = await auditApi.query(params);
      // Handle different response structures
      const data = response.data;
      setEvents(data.events || data || []);
      setTotal(data.total || data.length || 0);
      setTotalPages(data.totalPages || Math.ceil((data.total || data.length || 0) / limit));
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to load audit logs';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (data: AuditQueryFormData) => {
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const response = await auditApi.export({
        start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        format: 'json',
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export downloaded');
    } catch (error: any) {
      toast.error('Failed to export audit logs');
    }
  };

  const generateComplianceReport = async (data: { start_date: string; end_date: string }) => {
    setIsGeneratingReport(true);
    try {
      const response = await auditApi.complianceReport(data);
      setReportData(response.data);
      setShowComplianceReport(true);
      toast.success('Compliance report generated');
    } catch (error: any) {
      toast.error('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleViewEvent = (event: AuditEvent) => {
    setSelectedEvent(event);
  };

  // Check if user has permission (AUDITOR or CENTRAL_ADMIN)
  const hasPermission = user && ['CENTRAL_ADMIN', 'AUDITOR'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">View and analyze system audit trails</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowComplianceReport(true)} className="btn-secondary">
            <FileText className="w-4 h-4 mr-2" />
            Compliance Report
          </button>
          <button onClick={handleExport} className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Permission Check */}
      {!hasPermission && (
        <div className="card p-8 text-center bg-danger-50 border-danger-200">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-danger-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600 mb-4">
            You need <strong>Auditor</strong> or <strong>Central Admin</strong> role to view audit logs.
            Current role: {user?.role || 'Unknown'}
          </p>
          <button onClick={() => window.history.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      )}

      {hasPermission && error && (
        <div className="card p-6 bg-danger-50 border-danger-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-danger-600 flex-shrink-0" />
            <div className="flex-1 text-left">
              <h3 className="font-medium text-gray-900">Error Loading Audit Logs</h3>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
            </div>
            <button onClick={loadEvents} className="btn-primary btn-sm">
              Retry
            </button>
          </div>
        </div>
      )}

      {hasPermission && !error && (
        <>
          {/* Filters */}
          <div className="card p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input {...register('start_date')} type="date" className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input {...register('end_date')} type="date" className="input" />
              </div>
              <div>
                <label className="label">User ID</label>
                <input {...register('user_id')} type="text" placeholder="Filter by user" className="input" />
              </div>
              <div>
                <label className="label">Event Type</label>
                <input {...register('event_type')} type="text" placeholder="e.g., LOGIN_SUCCESS" className="input" />
              </div>
              <div>
                <label className="label">Category</label>
                <select {...register('event_category')} className="input">
                  <option value="">All Categories</option>
                  <option value="AUTHENTICATION">Authentication</option>
                  <option value="AUTHORIZATION">Authorization</option>
                  <option value="DOCUMENT_MANAGEMENT">Document Management</option>
                  <option value="EVIDENCE_MANAGEMENT">Evidence Management</option>
                  <option value="BLOCKCHAIN">Blockchain</option>
                  <option value="SECURITY">Security</option>
                  <option value="AUDIT">Audit</option>
                  <option value="VALIDATION">Validation</option>
                </select>
              </div>
              <div>
                <label className="label">Resource Type</label>
                <input {...register('resource_type')} type="text" placeholder="e.g., CASE, DOCUMENT" className="input" />
              </div>
              <div>
                <label className="label">Action</label>
                <input {...register('action')} type="text" placeholder="e.g., create_case" className="input" />
              </div>
              <div>
                <label className="label">Outcome</label>
                <select {...register('outcome')} className="input">
                  <option value="">All Outcomes</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILURE">Failure</option>
                  <option value="DENIED">Denied</option>
                  <option value="ERROR">Error</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input {...register('start_date')} type="date" className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input {...register('end_date')} type="date" className="input" />
          </div>
          <div>
            <label className="label">User ID</label>
            <input {...register('user_id')} type="text" placeholder="Filter by user" className="input" />
          </div>
          <div>
            <label className="label">Event Type</label>
            <input {...register('event_type')} type="text" placeholder="e.g., LOGIN_SUCCESS" className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select {...register('event_category')} className="input">
              <option value="">All Categories</option>
              <option value="AUTHENTICATION">Authentication</option>
              <option value="AUTHORIZATION">Authorization</option>
              <option value="DOCUMENT_MANAGEMENT">Document Management</option>
              <option value="EVIDENCE_MANAGEMENT">Evidence Management</option>
              <option value="BLOCKCHAIN">Blockchain</option>
              <option value="SECURITY">Security</option>
              <option value="AUDIT">Audit</option>
              <option value="VALIDATION">Validation</option>
            </select>
          </div>
          <div>
            <label className="label">Resource Type</label>
            <input {...register('resource_type')} type="text" placeholder="e.g., CASE, DOCUMENT" className="input" />
          </div>
          <div>
            <label className="label">Action</label>
            <input {...register('action')} type="text" placeholder="e.g., create_case" className="input" />
          </div>
          <div>
            <label className="label">Outcome</label>
            <select {...register('outcome')} className="input">
              <option value="">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="DENIED">Denied</option>
              <option value="ERROR">Error</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
          <div>
            <label className="label">Severity</label>
            <select {...register('severity')} className="input">
              <option value="">All Severities</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="lg:col-span-1 flex items-end">
            <button type="submit" className="btn-primary w-full">
              <Search className="w-4 h-4 mr-2" />
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Events Table */}
      <div className="card overflow-hidden">
        {isLoading && events.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Category</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Outcome</th>
                    <th>Severity</th>
                    <th>IP</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No audit events found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="text-sm text-gray-500 whitespace-nowrap">
                          {new Date(event.occurred_at).toLocaleString()}
                        </td>
                        <td className="font-mono text-xs text-gray-700 max-w-xs truncate block">
                          {event.event_type}
                        </td>
                        <td>
                          <span className="badge badge-blue text-xs">{event.event_category}</span>
                        </td>
                        <td className="text-sm text-gray-600">
                          {event.user_id ? `${event.user_id.slice(0, 8)}... (${event.user_role || '—'})` : 'System'}
                        </td>
                        <td className="font-mono text-xs text-gray-700 max-w-xs truncate block">
                          {event.action}
                        </td>
                        <td className="text-sm text-gray-600">
                          {event.resource_type ? `${event.resource_type}: ${event.resource_id?.slice(0, 8)}...` : '—'}
                        </td>
                        <td>
                          <span className={`badge ${getOutcomeBadgeColor(event.outcome)}`}>
                            {event.outcome}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getSeverityBadgeColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">{event.user_ip || '—'}</td>
                        <td>
                          <button
                            onClick={() => handleViewEvent(event)}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                  Page {page} of {totalPages} — {total} total events
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

function getOutcomeBadgeColor(outcome: string): string {
  const colors: Record<string, string> = {
    SUCCESS: 'badge-green',
    FAILURE: 'badge-red',
    DENIED: 'badge-red',
    ERROR: 'badge-red',
    PARTIAL: 'badge-yellow',
  };
  return colors[outcome] || 'badge-gray';
}

function getSeverityBadgeColor(severity: string): string {
  const colors: Record<string, string> = {
    DEBUG: 'badge-gray',
    INFO: 'badge-blue',
    WARNING: 'badge-yellow',
    ERROR: 'badge-red',
    CRITICAL: 'badge-red',
  };
  return colors[severity] || 'badge-gray';
}