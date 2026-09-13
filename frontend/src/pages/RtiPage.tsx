// ============================================================================
// ADALAT360 - RTI Page
// Right to Information request management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Shield,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { rtiApi } from '../../services/api';
import { RTIRequest, RTIStatus } from '../../types';
import { toast } from 'react-hot-toast';

const rtiQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(RTIStatus).optional(),
  assigned_to: z.string().uuid().optional(),
  search: z.string().optional(),
});

type RTIQueryFormData = z.infer<typeof rtiQuerySchema>;

const createRTISchema = z.object({
  applicant_name: z.string().min(1, 'Applicant name is required').max(255),
  applicant_address: z.string().optional(),
  applicant_email: z.string().email('Invalid email').optional(),
  applicant_phone: z.string().max(20).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  description: z.string().optional(),
  information_sought: z.string().min(1, 'Information sought is required'),
  case_ids: z.array(z.string().uuid()).optional(),
  document_ids: z.array(z.string().uuid()).optional(),
  evidence_ids: z.array(z.string().uuid()).optional(),
});

type CreateRTIFormData = z.infer<typeof createRTISchema>;

const updateRTISchema = z.object({
  status: z.nativeEnum(RTIStatus).optional(),
  assigned_to: z.string().uuid().optional(),
  response_text: z.string().optional(),
  response_documents: z.array(z.string().uuid()).optional(),
  denied_reasons: z.array(z.string()).optional(),
  exemption_sections: z.array(z.string()).optional(),
});

export function RtiPage() {
  const [requests, setRequests] = useState<RTIRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<RTIRequest | null>(null);
  const [respondingRequest, setRespondingRequest] = useState<RTIRequest | null>(null);
  const [denyingRequest, setDenyingRequest] = useState<RTIRequest | null>(null);
  const [appealingRequest, setAppealingRequest] = useState<RTIRequest | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RTIQueryFormData>({
    resolver: zodResolver(rtiQuerySchema),
    defaultValues: {
      page: 1,
      limit: 20,
    },
  });

  const status = watch('status');
  const assigned_to = watch('assigned_to');
  const search = watch('search');

  useEffect(() => {
    loadRequests();
  }, [page, limit, status, assigned_to, search]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        status: status || undefined,
        assigned_to: assigned_to || undefined,
        search: search || undefined,
      };
      const response = await rtiApi.list(params);
      setRequests(response.data.requests);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error: any) {
      toast.error('Failed to load RTI requests');
    } finally {
      setIsLoading(false);
    }
  };

  const onCreate = async (data: CreateRTIFormData) => {
    try {
      await rtiApi.create(data);
      toast.success('RTI request submitted successfully');
      setShowCreateModal(false);
      loadRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit RTI request');
    }
  };

  const onRespond = async (requestId: string, data: { response_text: string; response_documents?: string[] }) => {
    try {
      await rtiApi.respond(requestId, data);
      toast.success('RTI response submitted');
      setRespondingRequest(null);
      loadRequests();
    } catch (error: any) {
      toast.error('Failed to submit response');
    }
  };

  const onDeny = async (requestId: string, data: { denied_reasons: string[]; exemption_sections?: string[] }) => {
    try {
      await rtiApi.deny(requestId, data);
      toast.success('RTI denied');
      setDenyingRequest(null);
      loadRequests();
    } catch (error: any) {
      toast.error('Failed to deny RTI');
    }
  };

  const onAppeal = async (requestId: string, data: { appeal_level: 'FIRST' | 'SECOND'; appeal_details?: any }) => {
    try {
      await rtiApi.appeal(requestId, data);
      toast.success('Appeal filed successfully');
      setAppealingRequest(null);
      loadRequests();
    } catch (error: any) {
      toast.error('Failed to file appeal');
    }
  };

  const onAssign = async (requestId: string, assigned_to: string) => {
    try {
      await rtiApi.assign(requestId, assigned_to);
      toast.success('RTI assigned successfully');
      loadRequests();
    } catch (error: any) {
      toast.error('Failed to assign RTI');
    }
  };

  const handleSubmit = (data: any) => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RTI Requests</h1>
          <p className="text-gray-600 mt-1">Manage Right to Information requests</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New RTI Request
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('search')} type="text" placeholder="Search by request number, applicant, subject..." className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="">All Statuses</option>
              {Object.values(RTIStatus).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assigned To</label>
            <input {...register('assigned_to')} type="text" placeholder="Filter by assignee" className="input" />
          </div>
          <div>
            <label className="label">&nbsp;</label>
            <button type="submit" className="btn-primary w-full">
              <Search className="w-4 h-4 mr-2" />
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Requests Table */}
      <div className="card overflow-hidden">
        {isLoading && requests.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Request Number</th>
                    <th>Applicant</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Received</th>
                    <th>Due Date</th>
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No RTI requests found</p>
                        <p className="text-sm text-gray-400 mt-1">Submit your first RTI request</p>
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="font-mono font-medium text-gray-900">
                          <Link to={`/rti/${request.id}`} className="hover:text-primary-600">
                            {request.request_number}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-gray-900">{request.applicant_name}</p>
                            {request.applicant_email && (
                              <p className="text-xs text-gray-500">{request.applicant_email}</p>
                            )}
                          </div>
                        </td>
                        <td className="max-w-xs truncate">
                          <Link to={`/rti/${request.id}`} className="font-medium text-gray-900 hover:text-primary-600 truncate block">
                            {request.subject}
                          </Link>
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeColor(request.status)}`}>
                            {formatStatus(request.status)}
                          </span>
                        </td>
                        <td className="text-gray-600">
                          {request.assigned_to_name || request.assigned_to?.slice(0, 8) + '...' || 'Unassigned'}
                        </td>
                        <td className="text-gray-500 whitespace-nowrap">
                          {new Date(request.received_at).toLocaleDateString()}
                        </td>
                        <td className="text-gray-500 whitespace-nowrap">
                          {request.due_date ? (
                            <span className={new Date(request.due_date) < new Date() ? 'text-danger-600' : ''}>
                              {new Date(request.due_date).toLocaleDateString()}
                              {new Date(request.due_date) < new Date() && !['RESPONDED', 'DENIED', 'CLOSED'].includes(request.status) && (
                                <AlertTriangle className="w-3 h-3 inline ml-1" />
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/rti/${request.id}`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="dropdown-menu">
                                <Link to={`/rti/${request.id}`} className="dropdown-item">
                                  <Eye className="w-4 h-4" />
                                  View Details
                                </Link>
                                {['RECEIVED', 'UNDER_PROCESS', 'INFORMATION_GATHERED'].includes(request.status) && (
                                  <>
                                    <button onClick={() => setRespondingRequest(request)} className="dropdown-item">
                                      <Send className="w-4 h-4" />
                                      Respond
                                    </button>
                                    <button onClick={() => setDenyingRequest(request)} className="dropdown-item text-danger-600">
                                      <Ban className="w-4 h-4" />
                                      Deny
                                    </button>
                                  </>
                                }
                                {['RESPONDED', 'DENIED'].includes(request.status) && !request.first_appeal_filed && (
                                  <button onClick={() => setAppealingRequest({ ...request, appeal_level: 'FIRST' })} className="dropdown-item">
                                    <RotateCcw className="w-4 h-4" />
                                    File First Appeal
                                  </button>
                                )}
                                {request.first_appeal_filed && !request.second_appeal_filed && (
                                  <button onClick={() => setAppealingRequest({ ...request, appeal_level: 'SECOND' })} className="dropdown-item">
                                    <RotateCcw className="w-4 h-4" />
                                    File Second Appeal
                                  </button>
                                )}
                                <hr className="my-1 border-gray-100" />
                                <button onClick={() => setViewingRequest(request)} className="dropdown-item">
                                  <Eye className="w-4 h-4" />
                                  View Full Details
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
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} requests
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
    RECEIVED: 'badge-blue',
    UNDER_PROCESS: 'badge-yellow',
    INFORMATION_GATHERED: 'badge-blue',
    RESPONDED: 'badge-green',
    DENIED: 'badge-red',
    APPEALED: 'badge-purple',
    CLOSED: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}