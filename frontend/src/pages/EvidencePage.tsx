// ============================================================================
// ADALAT360 - Evidence Page (Exhibit Register)
// Redesigned to match Exhibit Register layout with card grid + registration form
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
  QrCode,
  Package,
} from 'lucide-react';
import { casesApi, evidenceApi } from '../services/api';
import { Evidence, EvidenceType, EvidenceStatus } from '../types';
import { toast } from 'react-hot-toast';

// ---------- Registration form schema ----------
const registerSchema = z.object({
  exhibitName: z.string().min(1, 'Exhibit name is required'),
  caseId: z.string().min(1, 'Please select a case'),
  currentLocation: z.string().optional(),
});
type RegisterFormData = z.infer<typeof registerSchema>;

// ---------- Main component ----------
export function EvidencePage() {
  const [searchParams] = useSearchParams();

  // Data
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<{ id: string; case_number: string; title: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(searchParams.get('caseId') || '');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Registration form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // ---------- Load cases ----------
  useEffect(() => {
    casesApi
      .list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' })
      .then((r) => setCases(r.data.cases || []))
      .catch(() => toast.error('Could not load cases'));
  }, []);

  // ---------- Load evidence when filters change ----------
  useEffect(() => {
    loadEvidence();
  }, [page, selectedCaseId, filterType, filterStatus]);

  const loadEvidence = async () => {
    if (!selectedCaseId) {
      setEvidence([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit };
      if (filterType) params.evidenceType = filterType;
      if (filterStatus) params.status = filterStatus;
      const response = await evidenceApi.listByCase(selectedCaseId, params);
      setEvidence(response.data.evidence);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch {
      toast.error('Failed to load evidence');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- Register new exhibit ----------
  const onRegister = async (data: RegisterFormData) => {
    setIsRegistering(true);
    try {
      await evidenceApi.create({
        caseId: data.caseId,
        name: data.exhibitName,
        evidenceType: 'PHYSICAL',
        seized_at: new Date().toISOString(),
        seized_by: 'current-user',
        current_location: data.currentLocation || undefined,
      });
      toast.success('Exhibit registered & QR tag generated');
      reset();
      if (data.caseId === selectedCaseId) loadEvidence();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // ---------- Delete ----------
  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Delete this exhibit? This cannot be undone.')) return;
    try {
      await evidenceApi.delete(evidenceId);
      toast.success('Exhibit removed');
      loadEvidence();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  // ---------- Render ----------
  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Exhibit Register</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Register, track and manage physical & digital exhibits across cases
        </p>
      </div>

      {/* ---- Case selector + filters strip ---- */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => { setSelectedCaseId(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">Select case…</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} · {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Evidence Type</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">All Types</option>
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">All Statuses</option>
              {EVIDENCE_STATUSES.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSelectedCaseId(''); setFilterType(''); setFilterStatus(''); setPage(1); }}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* ---- Exhibit Cards Grid ---- */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : evidence.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {evidence.map((item) => (
              <ExhibitCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No exhibits found</p>
            <p className="text-sm text-gray-400 mt-1">
              {selectedCaseId
                ? 'No evidence items match your filters'
                : 'Select a case above to view its exhibits'}
            </p>
          </div>
        )}
      </div>

      {/* ---- Pagination ---- */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 px-2">
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

      {/* ---- Register New Exhibit Form ---- */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Register New Exhibit</h2>

        <form onSubmit={handleSubmit(onRegister)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Exhibit Name */}
          <div>
            <label className="label">Exhibit Name</label>
            <input
              {...register('exhibitName')}
              type="text"
              placeholder="e.g., Seized weapon"
              className={`input ${errors.exhibitName ? 'input-error' : ''}`}
            />
            {errors.exhibitName && (
              <p className="text-xs text-red-500 mt-1">{errors.exhibitName.message}</p>
            )}
          </div>

          {/* Case ID */}
          <div>
            <label className="label">Case ID</label>
            <select
              {...register('caseId')}
              className={`input ${errors.caseId ? 'input-error' : ''}`}
            >
              <option value="">Select case…</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} · {c.title}
                </option>
              ))}
            </select>
            {errors.caseId && (
              <p className="text-xs text-red-500 mt-1">{errors.caseId.message}</p>
            )}
          </div>

          {/* Current Location */}
          <div>
            <label className="label">Current Location</label>
            <input
              {...register('currentLocation')}
              type="text"
              placeholder="e.g., Evidence Locker A"
              className="input"
            />
          </div>

          {/* Submit button — full width on mobile, auto on md+ */}
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isRegistering}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white
                         bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700
                         shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
            >
              {isRegistering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Generate QR Tag & Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Exhibit Card Component
// ============================================================================

function ExhibitCard({ item }: { item: Evidence }) {
  return (
    <Link
      to={`/evidence/${item.id}`}
      className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* QR code area */}
      <div className="bg-slate-50 flex items-center justify-center py-6 px-4">
        <div className="w-20 h-20 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-inner relative">
          <QrCode className="w-9 h-9 text-gray-300 group-hover:text-gray-400 transition-colors" />
          {/* tiny hash overlay */}
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-gray-400 leading-none select-none truncate max-w-[70px]">
            {item.qr_code_hash?.slice(0, 10) || '—'}
          </span>
        </div>
      </div>

      {/* Info area */}
      <div className="p-4 text-center flex-1 flex flex-col items-center">
        {/* Evidence number */}
        <p className="font-bold text-gray-900 text-sm">{item.evidence_number}</p>

        {/* Name / description */}
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {item.name}
        </p>

        {/* Status badge */}
        <span className={`mt-3 inline-block ${getStatusStyle(item.status)}`}>
          {formatStatus(item.status)}
        </span>

        {/* Location + case ref */}
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          {item.current_location || item.current_custodian_name || 'Location pending'}
        </p>
        <p className="text-[11px] font-mono text-gray-400 mt-0.5">
          {item.evidence_number}
        </p>
      </div>
    </Link>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const EVIDENCE_TYPES: EvidenceType[] = [
  'DIGITAL', 'PHYSICAL', 'DOCUMENTARY', 'BIOLOGICAL', 'CHEMICAL',
  'FIREARM', 'VEHICLE', 'ELECTRONIC_DEVICE', 'FINANCIAL_RECORD', 'OTHER',
];

const EVIDENCE_STATUSES: EvidenceStatus[] = [
  'SEIZED', 'IN_CUSTODY', 'SENT_FOR_ANALYSIS', 'UNDER_ANALYSIS',
  'ANALYSIS_COMPLETE', 'PRESENTED_IN_COURT', 'RETURNED', 'DISPOSED', 'DESTROYED',
];

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Returns Tailwind classes for the status badge */
function getStatusStyle(status: EvidenceStatus): string {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold';
  const map: Record<string, string> = {
    SEIZED:              `${base} bg-blue-50 text-blue-700`,
    IN_CUSTODY:          `${base} bg-emerald-50 text-emerald-700`,
    SENT_FOR_ANALYSIS:   `${base} bg-amber-50 text-amber-700`,
    UNDER_ANALYSIS:      `${base} bg-amber-50 text-amber-700 font-bold`,
    ANALYSIS_COMPLETE:   `${base} bg-emerald-50 text-emerald-700`,
    PRESENTED_IN_COURT:  `${base} bg-purple-50 text-purple-700`,
    RETURNED:            `${base} bg-sky-50 text-sky-700`,
    DISPOSED:            `${base} bg-gray-100 text-gray-600`,
    DESTROYED:           `${base} bg-red-50 text-red-700`,
  };
  return map[status] || `${base} bg-gray-100 text-gray-600`;
}