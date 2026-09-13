// ============================================================================
// ADALAT360 - Case Detail Page
// Detailed view of a single case with tabs
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  FileText,
  ShieldCheck,
  Timeline,
  GitBranch,
  FileSignature,
  Users,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { casesApi, documentsApi, evidenceApi, timelineApi, bsaApi } from '../../services/api';
import { Case, CaseStatus, CasePriority, Document, Evidence } from '../../types';
import { toast } from 'react-hot-toast';

const updateCaseSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  police_station: z.string().max(200).optional(),
  district: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  jurisdiction_court: z.string().max(200).optional(),
  ipc_sections: z.array(z.string()).optional(),
  bns_sections: z.array(z.string()).optional(),
  special_acts: z.array(z.string()).optional(),
});

type UpdateCaseFormData = z.infer<typeof updateCaseSchema>;

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'evidence' | 'timeline' | 'entity-graph' | 'assignments'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<UpdateCaseFormData>({
    resolver: zodResolver(updateCaseSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (caseId) {
      loadCase();
    }
  }, [caseId]);

  const loadCase = async () => {
    setIsLoading(true);
    try {
      const response = await casesApi.get(caseId!);
      setCaseData(response.data);
      reset(response.data);
    } catch (error: any) {
      toast.error('Failed to load case');
      navigate('/cases');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateCaseFormData) => {
    try {
      await casesApi.update(caseId!, data);
      toast.success('Case updated successfully');
      setIsEditing(false);
      loadCase();
    } catch (error: any) {
      setEditError(error.response?.data?.message || 'Failed to update case');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      return;
    }
    try {
      await casesApi.delete(caseId!);
      toast.success('Case deleted successfully');
      navigate('/cases');
    } catch (error: any) {
      toast.error('Failed to delete case');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'evidence', label: 'Evidence', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Timeline className="w-4 h-4" /> },
    { id: 'entity-graph', label: 'Entity Graph', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'assignments', label: 'Assignments', icon: <Users className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Case not found</h3>
        <button onClick={() => navigate('/cases')} className="btn-primary">Back to Cases</button>
      </div>
    );
  }

  const handleIpcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const values = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    setValue('ipc_sections', values);
  };

  const handleBnsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const values = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    setValue('bns_sections', values);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/cases')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{caseData.title}</h1>
              <span className={`badge ${getStatusBadgeColor(caseData.status)}`}>
                {formatStatus(caseData.status)}
              </span>
              <span className={`badge ${getPriorityBadgeColor(caseData.priority)}`}>
                {caseData.priority}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{caseData.case_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {!isEditing && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              <div className="relative">
                <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-4 h-4" />
                </button>
                <div className="dropdown-menu">
                  <Link to={`/cases/${caseId}/documents`} className="dropdown-item">
                    <FileText className="w-4 h-4" />
                    Documents
                  </Link>
                  <Link to={`/cases/${caseId}/evidence`} className="dropdown-item">
                    <ShieldCheck className="w-4 h-4" />
                    Evidence
                  </Link>
                  <Link to={`/cases/${caseId}/timeline`} className="dropdown-item">
                    <Timeline className="w-4 h-4" />
                    Timeline
                  </Link>
                  <Link to={`/cases/${caseId}/entity-graph`} className="dropdown-item">
                    <GitBranch className="w-4 h-4" />
                    Entity Graph
                  </Link>
                  <Link to={`/bsa/generate?caseId=${caseId}`} className="dropdown-item">
                    <FileSignature className="w-4 h-4" />
                    Generate BSA Certificate
                  </Link>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={handleDelete}
                    className="dropdown-item text-danger-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Case
                  </button>
                </div>
              </div>
            </>
          }
          {isEditing && (
            <>
              <button onClick={handleSubmit(onSubmit)} className="btn-primary">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save
              </button>
              <button onClick={() => { setIsEditing(false); reset(caseData); setEditError(null); }} className="btn-secondary">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Case Info Bar */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <InfoItem label="Case Number" value={caseData.case_number} />
          <InfoItem label="FIR Number" value={caseData.fir_number || '—'} />
          <InfoItem label="Police Station" value={caseData.police_station || '—'} />
          <InfoItem label="District" value={caseData.district || '—'} />
          <InfoItem label="State" value={caseData.state || '—'} />
          <InfoItem label="Court" value={caseData.jurisdiction_court || '—'} />
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
          {activeTab === 'overview' && <OverviewTab caseData={caseData} isEditing={isEditing} register={register} errors={errors} />}
          {activeTab === 'documents' && <DocumentsTab caseId={caseId!} />}
          {activeTab === 'evidence' && <EvidenceTab caseId={caseId!} />}
          {activeTab === 'timeline' && <TimelineTab caseId={caseId!} />}
          {activeTab === 'entity-graph' && <EntityGraphTab caseId={caseId!} />}
          {activeTab === 'assignments' && <AssignmentsTab caseId={caseId!} />}
        </div>
      </div>
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

function OverviewTab({ caseData, isEditing, register, errors }: { caseData: any; isEditing: boolean; register: any; errors: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Basic Information</h3>
          <div className="space-y-4">
            <FormField label="Title" isEditing={isEditing}>
              <input {...register('title')} className="input" disabled={!isEditing} />
            </FormField>
            <FormField label="Description" isEditing={isEditing}>
              <textarea {...register('description')} rows={4} className="input" disabled={!isEditing} />
            </FormField>
            <FormField label="Police Station" isEditing={isEditing}>
              <input {...register('police_station')} className="input" disabled={!isEditing} />
            </FormField>
            <FormField label="District" isEditing={isEditing}>
              <input {...register('district')} className="input" disabled={!isEditing} />
            </FormField>
            <FormField label="State" isEditing={isEditing}>
              <input {...register('state')} className="input" disabled={!isEditing} />
            </FormField>
            <FormField label="Court" isEditing={isEditing}>
              <input {...register('jurisdiction_court')} className="input" disabled={!isEditing} />
            </FormField>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Case Classification</h3>
          <div className="space-y-4">
            <FormField label="Status" isEditing={isEditing}>
              <select {...register('status')} className="input" disabled={!isEditing}>
                {['OPEN', 'UNDER_INVESTIGATION', 'CHARGE_SHEET_FILED', 'TRIAL_IN_PROGRESS', 'JUDGMENT_RESERVED', 'DISPOSED', 'APPEALED', 'CLOSED'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority" isEditing={isEditing}>
              <select {...register('priority')} className="input" disabled={!isEditing}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Legal Sections</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="IPC Sections (comma-separated)" isEditing={isEditing}>
            <input
              type="text"
              placeholder="e.g., 420, 467, 468"
              className="input"
              value={caseData.ipc_sections?.join(', ') || ''}
              onChange={(e) => {}}
              disabled={!isEditing}
            />
          </FormField>
          <FormField label="BNS Sections (comma-separated)" isEditing={isEditing}>
            <input
              type="text"
              placeholder="e.g., 316, 318, 319"
              className="input"
              value={caseData.bns_sections?.join(', ') || ''}
              onChange={(e) => {}}
              disabled={!isEditing}
            />
          </FormField>
          <FormField label="Special Acts (comma-separated)" isEditing={isEditing}>
            <input
              type="text"
              placeholder="e.g., IT Act, POCSO"
              className="input"
              value={caseData.special_acts?.join(', ') || ''}
              onChange={(e) => {}}
              disabled={!isEditing}
            />
          </FormField>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Dates</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <DateItem label="Incident Date" value={caseData.incident_date} />
          <DateItem label="FIR Registered" value={caseData.fir_registered_at} />
          <DateItem label="Charge Sheet Filed" value={caseData.charge_sheet_filed_at} />
          <DateItem label="Trial Started" value={caseData.trial_started_at} />
          <DateItem label="Judgment Date" value={caseData.judgment_date} />
          <DateItem label="Disposal Date" value={caseData.disposal_date} />
        </div>
      </div>
    );
  }

function DocumentsTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
        <a href={`/cases/${caseId}/documents`} className="btn-primary btn-sm">
          <Plus className="w-4 h-4 mr-2" />
          Upload Document
        </a>
      </div>
      <p className="text-gray-500 text-sm">View all documents at <a href={`/cases/${caseId}/documents`} className="text-primary-600 hover:underline">Documents page</a></p>
    </div>
  );
}

function EvidenceTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Evidence</h3>
        <a href={`/cases/${caseId}/evidence`} className="btn-primary btn-sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Evidence
        </a>
      </div>
      <p className="text-gray-500 text-sm">View all evidence at <a href={`/cases/${caseId}/evidence`} className="text-primary-600 hover:underline">Evidence page</a></p>
    </div>
  );
}

function TimelineTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
        <a href={`/cases/${caseId}/timeline`} className="btn-primary btn-sm">
          View Full Timeline
        </a>
      </div>
      <p className="text-gray-500 text-sm">View complete timeline at <a href={`/cases/${caseId}/timeline`} className="text-primary-600 hover:underline">Timeline page</a></p>
    </div>
  );
}

function EntityGraphTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Entity Graph</h3>
        <a href={`/cases/${caseId}/entity-graph`} className="btn-primary btn-sm">
          View Graph
        </a>
      </div>
      <p className="text-gray-500 text-sm">Explore entity relationships at <a href={`/cases/${caseId}/entity-graph`} className="text-primary-600 hover:underline">Entity Graph page</a></p>
    </div>
  );
}

function AssignmentsTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Case Assignments</h3>
        <button className="btn-primary btn-sm">
          <Plus className="w-4 h-4 mr-2" />
          Assign User
        </button>
      </div>
      <p className="text-gray-500 text-sm">Manage case assignments</p>
    </div>
  );
}

function DateItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium text-gray-900">{value ? new Date(value).toLocaleDateString() : '—'}</p>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'badge-blue', UNDER_INVESTIGATION: 'badge-yellow', CHARGE_SHEET_FILED: 'badge-purple',
    TRIAL_IN_PROGRESS: 'badge-indigo', JUDGMENT_RESERVED: 'badge-pink', DISPOSED: 'badge-green',
    APPEALED: 'badge-orange', CLOSED: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}

function getPriorityBadgeColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'badge-green', MEDIUM: 'badge-yellow', HIGH: 'badge-orange', CRITICAL: 'badge-red',
  };
  return colors[priority] || 'badge-gray';
}

function FormField({ label, isEditing, children }: { label: string; isEditing: boolean; children: React.ReactNode }) {
  if (!isEditing) return null;
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}