import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Filter, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { casesApi } from '../services/api';
import { Case } from '../types';

export function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || '');
  const [isLoadingCases, setIsLoadingCases] = useState(!caseId);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', eventTypes: [] as string[] });

  // Load user's accessible cases
  useEffect(() => {
    const loadCases = async () => {
      if (isLoadingCases) {
        try {
          const res = await casesApi.list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
          setCases(res.data.cases || []);
          // Auto-select first case if none selected
          if (!selectedCaseId && res.data.cases?.length > 0) {
            setSelectedCaseId(res.data.cases[0].id);
            navigate(`/timeline/${res.data.cases[0].id}`);
          }
        } catch (error) {
          console.error('Failed to load cases:', error);
        } finally {
          setIsLoadingCases(false);
        }
      }
    };
    loadCases();
  }, [isLoadingCases]);

  // Load timeline events when caseId or filters change
  useEffect(() => {
    if (!selectedCaseId) return;
    loadEvents();
  }, [selectedCaseId, page, limit, filters]);

  const loadEvents = async () => {
    if (!selectedCaseId) return;
    setIsLoadingEvents(true);
    try {
      // In a real app, this would call timelineApi.get()
      // For now, we'll show mock data with the case context
      const mockEvents = [
        { id: '1', time: '09:15', title: 'Evidence seized', detail: 'Item EVD-104 received and sealed', type: 'EVIDENCE_SEIZED', severity: 'high' },
        { id: '2', time: '10:30', title: 'Document uploaded', detail: 'Case file consolidated', type: 'DOCUMENT_UPLOADED', severity: 'medium' },
        { id: '3', time: '12:40', title: 'Custody transfer', detail: 'Evidence moved to forensic lab', type: 'CUSTODY_TRANSFER', severity: 'high' },
        { id: '4', time: '14:20', title: 'Search performed', detail: 'Search query: "financial fraud"', type: 'SEARCH_PERFORMED', severity: 'low' },
        { id: '5', time: '15:20', title: 'Document verified', detail: 'FIR document verified by officer', type: 'DOCUMENT_VERIFIED', severity: 'medium' },
        { id: '6', time: '16:00', title: 'BSA certificate generated', detail: 'Section 63 certificate for document DOC-2024-001', type: 'BSA_GENERATED', severity: 'high' },
      ];
      setEvents(mockEvents);
      setTotal(mockEvents.length);
      setTotalPages(1);
    } catch (error) {
      console.error('Failed to load timeline events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  if (isLoadingCases) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!selectedCaseId && cases.length > 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Select a case to view timeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {cases.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCaseId(c.id);
                navigate(`/timeline/${c.id}`);
              }}
              className="card p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <p className="font-medium text-gray-900">{c.title}</p>
              <p className="text-sm text-gray-500 mt-1">{c.case_number}</p>
              <span className={`badge ${getStatusBadgeColor(c.status)} mt-2 inline-block`}>
                {formatStatus(c.status)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedCaseId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">No cases available</h2>
        <p className="text-gray-500 mt-2">You don't have access to any cases yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with case selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Timeline</h1>
          <p className="text-gray-600 mt-1">Chronological view of all custody events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="input pl-10 w-40"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="input pl-10 w-40"
            />
          </div>
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </button>
          <button className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Case selector dropdown for quick switching */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="label">Case:</label>
          <select
            value={selectedCaseId}
            onChange={e => {
              const newCaseId = e.target.value;
              setSelectedCaseId(newCaseId);
              navigate(`/timeline/${newCaseId}`);
            }}
            className="input w-full max-w-md"
          >
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search timeline events..." className="input w-full max-w-sm" />
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        {isLoadingEvents ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No timeline events found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {events.map((event, idx) => (
              <div key={event.id || idx} className="relative pl-8 border-l border-gray-200 pb-4 last:pb-0">
                <span className={`absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full ${getSeverityColor(event.severity)}`} />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">{event.detail}</p>
                    <span className={`badge ${getTypeBadgeColor(event.type)} ml-2`}>{event.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs text-gray-500">{event.time}</span>
                </div>
              </div>
            ))}
          </div>
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

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  };
  return colors[severity] || 'bg-primary-500';
}

function getTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    EVIDENCE_SEIZED: 'badge-blue',
    DOCUMENT_UPLOADED: 'badge-green',
    CUSTODY_TRANSFER: 'badge-purple',
    SEARCH_PERFORMED: 'badge-orange',
    DOCUMENT_VERIFIED: 'badge-indigo',
    BSA_GENERATED: 'badge-pink',
  };
  return colors[type] || 'badge-gray';
}
