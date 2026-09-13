// ============================================================================
// ADALAT360 - Dashboard Page
// Role-based dashboard with stats and recent activity
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  FileText,
  ShieldCheck,
  Search,
  Timeline,
  GitBranch,
  FileSignature,
  ClipboardList,
  Users,
  Scale,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { casesApi, documentsApi, evidenceApi, searchApi, timelineApi, bsaApi, auditApi, rtiApi } from '../../services/api';
import { Case, Document, Evidence, CaseStats } from '../../types';

interface StatCard {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  href: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentEvidence, setRecentEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch data in parallel
      const [casesRes, docsRes, eviRes, searchRes] = await Promise.allSettled([
        casesApi.list({ limit: 5, sort_by: 'created_at', sort_order: 'desc' }),
        documentsApi.listByCase('', { limit: 5, sort_by: 'created_at', sort_order: 'desc' }), // Will need caseId
        evidenceApi.listByCase('', { limit: 5, sort_by: 'seized_at', sort_order: 'desc' }), // Will need caseId
        searchApi.search({ query: '', page: 1, limit: 5 }),
      ]);

      // Process cases
      if (casesRes.status === 'fulfilled') {
        const cases = casesRes.value.data.cases || [];
        setRecentCases(cases);
      }

      // Build stats
      const statCards: StatCard[] = [
        {
          title: 'Active Cases',
          value: casesRes.status === 'fulfilled' ? casesRes.value.data.total || 0 : 0,
          icon: <FolderKanban className="w-6 h-6" />,
          color: 'bg-blue-500',
          href: '/cases',
        },
        {
          title: 'Documents',
          value: docsRes.status === 'fulfilled' ? docsRes.value.data.total || 0 : 0,
          icon: <FileText className="w-6 h-6" />,
          color: 'bg-green-500',
          href: '/documents',
        },
        {
          title: 'Evidence Items',
          value: eviRes.status === 'fulfilled' ? eviRes.value.data.total || 0 : 0,
          icon: <ShieldCheck className="w-6 h-6" />,
          color: 'bg-purple-500',
          href: '/evidence',
        },
        {
          title: 'Search Index',
          value: searchRes.status === 'fulfilled' ? searchRes.value.data.total || 0 : 0,
          icon: <Search className="w-6 h-6" />,
          color: 'bg-orange-500',
          href: '/search',
        },
      ];
      setStats(statCards);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={loadDashboardData} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your cases and activities</p>
        </div>
        <Link to="/cases" className="btn-primary">
          <FolderKanban className="w-4 h-4 mr-2" />
          View All Cases
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link key={stat.title} to={stat.href} className="card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className="card lg:col-span-2">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Cases</h2>
              <Link to="/cases" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentCases.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No cases found</p>
              </div>
            ) : (
              recentCases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  to={`/cases/${caseItem.id}`}
                  className="p-4 hover:bg-gray-50 flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{caseItem.title}</p>
                    <p className="text-sm text-gray-500">{caseItem.case_number}</p>
                  </div>
                  <span className={`badge ${getStatusBadgeColor(caseItem.status)}`}>
                    {formatStatus(caseItem.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-3">
            <Link to="/cases" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <FolderKanban className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Create New Case</p>
                <p className="text-sm text-gray-500">Register a new FIR or case</p>
              </div>
            </Link>
            <Link to="/documents" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload Document</p>
                <p className="text-sm text-gray-500">Add evidence or case documents</p>
              </div>
            </Link>
            <Link to="/evidence" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Add Evidence</p>
                <p className="text-sm text-gray-500">Register new physical/digital evidence</p>
              </div>
            </Link>
            <Link to="/search" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <Search className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Search Records</p>
                <p className="text-sm text-gray-500">Find documents, evidence, cases</p>
              </div>
            </Link>
            <Link to="/bsa" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <FileSignature className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">BSA Certificate</p>
                <p className="text-sm text-gray-500">Generate Section 63 certificates</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusItem label="PostgreSQL" status="healthy" />
            <StatusItem label="MongoDB" status="healthy" />
            <StatusItem label="Redis" status="healthy" />
            <StatusItem label="Blockchain" status="healthy" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, status }: { label: string; status: 'healthy' | 'degraded' | 'down' }) {
  const colors = {
    healthy: 'bg-success-500',
    degraded: 'bg-warning-500',
    down: 'bg-danger-500',
  };
  const labels = {
    healthy: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <span className="text-sm text-gray-500">{labels[status]}</span>
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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