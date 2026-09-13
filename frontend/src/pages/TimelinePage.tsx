// ============================================================================
// ADALAT360 - Timeline Page
// Case timeline visualization
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Calendar,
  Clock,
  User,
  Shield,
  FileText,
  ShieldCheck,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import { timelineApi } from '../../services/api';
import { TimelineEvent, TimelineResponse, CustodyAction } from '../../types';
import { toast } from 'react-hot-toast';

export function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    eventTypes: [] as CustodyAction[],
    actorIds: [] as string[],
    includeBlockchain: true,
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (caseId) {
      loadTimeline();
    }
  }, [caseId, filters]);

  const loadTimeline = async () => {
    setIsLoading(true);
    try {
      const params = {
        caseId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        eventTypes: filters.eventTypes.length > 0 ? filters.eventTypes : undefined,
        actorIds: filters.actorIds.length > 0 ? filters.actorIds : undefined,
        includeBlockchain: filters.includeBlockchain,
        page: filters.page,
        limit: filters.limit,
      };
      const response = await timelineApi.get(caseId!, params);
      setTimeline(response.data);
    } catch (error: any) {
      toast.error('Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await timelineApi.export(caseId!, { format, startDate: filters.startDate, endDate: filters.endDate });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline-${caseId}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Timeline exported');
    } catch (error: any) {
      toast.error('Failed to export timeline');
    }
  };

  if (!caseId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">No case selected</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Timeline</h1>
          <p className="text-gray-600 mt-1">Chronological view of all custody events</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleExport('json')} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </button>
          <button onClick={() => handleExport('csv')} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <Link to={`/cases/${caseId}/analytics`} className="btn-primary">
            <BarChart2 className="w-4 h-4 mr-2" />
            Analytics
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Filters</h3>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}>
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Event Types</label>
              <select multiple value={filters.eventTypes} onChange={(e) => handleFilterChange('eventTypes', Array.from(e.target.selectedOptions).map(o => o.value))} className="input">
                {Object.values(CustodyAction).map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Include Blockchain</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={filters.includeBlockchain} onChange={(e) => handleFilterChange('includeBlockchain', e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <span className="text-sm text-gray-600">Show blockchain details</span>
              </label>
            </div>
          </form>
        )}
      </div>

      {/* Timeline */}
      <div className="card">
        {isLoading && !timeline ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : timeline ? (
          <>
            {/* Summary Stats */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatItem label="Total Events" value={timeline.total} />
                <StatItem label="Date Range" value={`${timeline.dateRange.start ? new Date(timeline.dateRange.start).toLocaleDateString() : '—'} - ${timeline.dateRange.end ? new Date(timeline.dateRange.end).toLocaleDateString() : '—'}`} />
                <StatItem label="Event Types" value={Object.keys(timeline.statistics.byEventType).length} />
                <StatItem label="Actors" value={Object.keys(timeline.statistics.byActor).length} />
              </div>
            </div>

            {/* Timeline Events */}
            <div className="divide-y divide-gray-200">
              {timeline.events.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No events found for the selected filters</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="space-y-4">
                    {timeline.events.map((event, index) => (
                      <TimelineEventCard key={`${event.id}-${index}`} event={event} index={index} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {timeline.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Page {filters.page} of {timeline.totalPages} — {timeline.total} total events
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))} disabled={filters.page === 1} className="btn-secondary btn-sm">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 text-sm text-gray-600">Page {filters.page} of {timeline.totalPages}</span>
                        <button onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))} disabled={filters.page === timeline.totalPages} className="btn-secondary btn-sm">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            ) : null
          </>
        ) : null}
      </div>
    </div>
  );
}

function TimelineEventCard({ event, index }: { event: TimelineEvent; index: number }) {
  const isEven = index % 2 === 0;

  const getActionIcon = (action: CustodyAction) => {
    const icons: Record<CustodyAction, React.ReactNode> = {
      UPLOAD: <FileText className="w-4 h-4" />,
      ACCESS: <Eye className="w-4 h-4" />,
      TRANSFER: <ArrowRightLeft className="w-4 h-4" />,
      REDACTION: <Shield className="w-4 h-4" />,
      EXPORT: <Download className="w-4 h-4" />,
      VERSION_CREATE: <FileText className="w-4 h-4" />,
      METADATA_UPDATE: <Settings className="w-4 h-4" />,
      VERIFICATION: <CheckCircle2 className="w-4 h-4" />,
      SIGNATURE_APPLY: <PenTool className="w-4 h-4" />,
      SEIZURE: <ShieldCheck className="w-4 h-4" />,
      HANDOVER: <ArrowRightLeft className="w-4 h-4" />,
      RECEIVE: <ArrowRightLeft className="w-4 h-4" />,
      ANALYSIS_START: <FlaskConical className="w-4 h-4" />,
      ANALYSIS_COMPLETE: <CheckCircle2 className="w-4 h-4" />,
      COURT_SUBMISSION: <Gavel className="w-4 h-4" />,
      COURT_RETURN: <Gavel className="w-4 h-4" />,
      DISPOSAL: <Trash2 className="w-4 h-4" />,
    };
    return icons[action] || <Shield className="w-4 h-4" />;
  };

  const getActionColor = (action: CustodyAction) => {
    const colors: Record<CustodyAction, string> = {
      UPLOAD: 'bg-blue-100 text-blue-600',
      ACCESS: 'bg-gray-100 text-gray-600',
      TRANSFER: 'bg-purple-100 text-purple-600',
      REDACTION: 'bg-orange-100 text-orange-600',
      EXPORT: 'bg-green-100 text-green-600',
      VERSION_CREATE: 'bg-blue-100 text-blue-600',
      METADATA_UPDATE: 'bg-gray-100 text-gray-600',
      VERIFICATION: 'bg-green-100 text-green-600',
      SIGNATURE_APPLY: 'bg-indigo-100 text-indigo-600',
      SEIZURE: 'bg-red-100 text-red-600',
      HANDOVER: 'bg-purple-100 text-purple-600',
      RECEIVE: 'bg-purple-100 text-purple-600',
      ANALYSIS_START: 'bg-yellow-100 text-yellow-600',
      ANALYSIS_COMPLETE: 'bg-green-100 text-green-600',
      COURT_SUBMISSION: 'bg-indigo-100 text-indigo-600',
      COURT_RETURN: 'bg-indigo-100 text-indigo-600',
      DISPOSAL: 'bg-red-100 text-red-600',
    };
    return colors[action] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="relative pl-8 border-l-2 border-gray-200 pb-8 last:pb-0">
      <div className="absolute left-0 top-0 w-3 h-3 rounded-full border-2 border-gray-200 bg-white">
        <div className={`w-1.5 h-1.5 rounded-full ${getActionColor(event.eventType).replace('bg-', 'bg-').replace('text-', '')} mx-auto my-0.5`} />
      </div>
      <div className="ml-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getActionColor(event.eventType)}`}>
              {getActionIcon(event.eventType)}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{formatAction(event.eventType)}</h4>
              <p className="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {event.actor.name} ({event.actor.role})
            </span>
            {event.blockchain.txId && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {event.blockchain.txId.slice(0, 12)}...
              </span>
            )}
          </div>
        </div>

        <p className="mt-2 text-gray-600">{event.description}</p>

        {event.resources.documents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {event.resources.documents.map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="badge badge-blue flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {doc.title} (v{doc.version})
              </Link>
            ))}
          </div>
        )}

        {event.resources.evidence.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {event.resources.evidence.map((evi) => (
              <Link key={evi.id} to={`/evidence/${evi.id}`} className="badge badge-purple flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {evi.name}
              </Link>
            ))}
          </div>
        )}

        {event.blockchain.txId && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Hash className="w-4 h-4" />
              <span>Blockchain TX: <code className="font-mono">{event.blockchain.txId}</code></span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <Block className="w-4 h-4" />
              <span>Block: <code className="font-mono">{event.blockchain.blockNumber}</code></span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <Shield className="w-4 h-4" />
              <span>Consensus: {event.blockchain.consensusStatus}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function formatAction(action: string): string {
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}