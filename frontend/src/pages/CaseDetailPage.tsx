import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, GitBranch, History, Loader2, ShieldCheck, Users } from 'lucide-react';
import { casesApi } from '../services/api';
import { Case, CaseStats } from '../types';
import { toast } from 'react-hot-toast';

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    Promise.all([casesApi.get(caseId), casesApi.getStats(caseId)])
      .then(([caseResponse, statsResponse]) => {
        setCaseItem(caseResponse.data);
        setStats(statsResponse.data);
      })
      .catch(() => {
        toast.error('Failed to load case details');
        navigate('/cases');
      })
      .finally(() => setIsLoading(false));
  }, [caseId, navigate]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 animate-spin text-primary-600" /></div>;
  if (!caseItem) return null;

  const links = [
    { label: 'Documents', value: stats?.documentCount ?? 0, icon: FileText, href: `/cases/${caseItem.id}/documents`, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Evidence', value: stats?.evidenceCount ?? 0, icon: ShieldCheck, href: `/cases/${caseItem.id}/evidence`, color: 'text-violet-700 bg-violet-50' },
    { label: 'Timeline', value: stats?.custodyEventsCount ?? 0, icon: History, href: `/cases/${caseItem.id}/timeline`, color: 'text-amber-700 bg-amber-50' },
    { label: 'Assignments', value: stats?.assignmentsCount ?? 0, icon: Users, href: `/cases/${caseItem.id}/entity-graph`, color: 'text-sky-700 bg-sky-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4"><button onClick={() => navigate('/cases')} className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100" aria-label="Back to cases"><ArrowLeft className="w-5 h-5" /></button><div><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-sm text-primary-600">{caseItem.case_number}</p><span className={`badge ${getStatusBadgeColor(caseItem.status)}`}>{formatStatus(caseItem.status)}</span><span className={`badge ${getPriorityBadgeColor(caseItem.priority)}`}>{caseItem.priority}</span></div><h1 className="text-2xl font-bold text-gray-900 mt-2">{caseItem.title}</h1><p className="text-gray-600 mt-1">Created {new Date(caseItem.created_at).toLocaleDateString()}</p></div></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{links.map(link => <Link key={link.label} to={link.href} className="card-hover p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${link.color}`}><link.icon className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-gray-900">{link.value}</p><p className="text-sm text-gray-500">{link.label}</p></div></Link>)}</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2"><h2 className="text-lg font-semibold text-gray-900 mb-5">Case overview</h2><div className="grid grid-cols-2 md:grid-cols-3 gap-5"><InfoItem label="FIR number" value={caseItem.fir_number || 'Not recorded'} /><InfoItem label="Police station" value={caseItem.police_station || 'Not recorded'} /><InfoItem label="District" value={caseItem.district || 'Not recorded'} /><InfoItem label="State" value={caseItem.state || 'Not recorded'} /><InfoItem label="Jurisdiction court" value={caseItem.jurisdiction_court || 'Not recorded'} /><InfoItem label="Incident date" value={caseItem.incident_date ? new Date(caseItem.incident_date).toLocaleDateString() : 'Not recorded'} /></div>{caseItem.description && <div className="mt-6 pt-5 border-t border-gray-200"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Description</p><p className="text-gray-700 leading-7">{caseItem.description}</p></div>}</div>
        <div className="card p-6"><h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace</h2><div className="space-y-2"><Link className="sidebar-link" to={`/cases/${caseItem.id}/documents`}><FileText className="w-4 h-4" /> Review documents</Link><Link className="sidebar-link" to={`/cases/${caseItem.id}/evidence`}><ShieldCheck className="w-4 h-4" /> Track evidence</Link><Link className="sidebar-link" to={`/cases/${caseItem.id}/timeline`}><History className="w-4 h-4" /> Open timeline</Link><Link className="sidebar-link" to={`/cases/${caseItem.id}/entity-graph`}><GitBranch className="w-4 h-4" /> Explore entities</Link></div></div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) { return <div><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 font-medium text-gray-900">{value}</p></div>; }
function formatStatus(status: string) { return status.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' '); }
function getStatusBadgeColor(status: string) { const colors: Record<string, string> = { OPEN: 'badge-blue', UNDER_INVESTIGATION: 'badge-yellow', CHARGE_SHEET_FILED: 'badge-purple', TRIAL_IN_PROGRESS: 'badge-indigo', JUDGMENT_RESERVED: 'badge-pink', DISPOSED: 'badge-green', APPEALED: 'badge-orange', CLOSED: 'badge-gray' }; return colors[status] || 'badge-gray'; }
function getPriorityBadgeColor(priority: string) { const colors: Record<string, string> = { LOW: 'badge-green', MEDIUM: 'badge-yellow', HIGH: 'badge-orange', CRITICAL: 'badge-red' }; return colors[priority] || 'badge-gray'; }
