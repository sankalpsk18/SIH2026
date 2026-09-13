// ============================================================================
// ADALAT360 - Evidence Detail Page
// Detailed view of a single evidence item with custody chain
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Download,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  Clock,
  ShieldCheck,
  Timeline,
  GitBranch,
  QrCode,
  ArrowRightLeft,
  FlaskConical,
  Gavel,
  Truck,
  Archive,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Scale,
  Camera,
  Hash,
  User,
  Building,
} from 'lucide-react';
import { evidenceApi } from '../../services/api';
import { Evidence, EvidenceType, EvidenceStatus, CustodyChainEvent } from '../../types';
import { toast } from 'react-hot-toast';

export function EvidenceDetailPage() {
  const { evidenceId } = useParams<{ evidenceId: string }>();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [custodyChain, setCustodyChain] = useState<CustodyChainEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'custody' | 'qr' | 'photos'>('details');

  useEffect(() => {
    if (evidenceId) {
      loadEvidence();
    }
  }, [evidenceId]);

  const loadEvidence = async () => {
    setIsLoading(true);
    try {
      const [eviRes, chainRes] = await Promise.all([
        evidenceApi.get(evidenceId!),
        evidenceApi.getCustodyChain(evidenceId!),
      ]);
      setEvidence(eviRes.data);
      setCustodyChain(chainRes.data);
    } catch (error: any) {
      toast.error('Failed to load evidence');
      navigate('/evidence');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
      return;
    }
    toast.error('Delete not implemented');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Evidence not found</h3>
        <button onClick={() => navigate('/evidence')} className="btn-primary">Back to Evidence</button>
      </div>
    );
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'custody', label: 'Custody Chain', icon: <Timeline className="w-4 h-4" /> },
    { id: 'qr', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { id: 'photos', label: 'Photos', icon: <Camera className="w-4 h-4" /> },
  ];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Evidence not found</h3>
        <button onClick={() => navigate('/evidence')} className="btn-primary">Back to Evidence</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evidence')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{evidence.name}</h1>
              <span className="badge badge-blue">{evidence.evidence_type.replace(/_/g, ' ')}</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(evidence.status)}
                <span className={`badge ${getStatusBadgeColor(evidence.status)}`}>
                  {formatStatus(evidence.status)}
                </span>
              </div>
            </div>
            <p className="text-gray-600 mt-1">{evidence.evidence_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Link to={`/evidence/${evidenceId}/transfer`} className="btn-secondary">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Transfer
          </Link>
          <Link to={`/evidence/${evidenceId}/qr-code`} className="btn-secondary">
            <QrCode className="w-4 h-4 mr-2" />
            QR Code
          </Link>
        </div>
      </div>

      {/* Evidence Info Bar */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <InfoItem label="Evidence Number" value={evidence.evidence_number} />
          <InfoItem label="Category" value={evidence.category || '—'} />
          <InfoItem label="Sub Category" value={evidence.sub_category || '—'} />
          <InfoItem label="Seized At" value={new Date(evidence.seized_at).toLocaleString()} />
          <InfoItem label="Seized By" value={evidence.seized_by_name || evidence.seized_by.slice(0, 8) + '...'} />
          <InfoItem label="Current Custodian" value={evidence.current_custodian_name || evidence.current_custodian_id?.slice(0, 8) + '...' || '—'} />
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
          {activeTab === 'details' && <DetailsTab evidence={evidence} />}
          {activeTab === 'custody' && <CustodyTab custodyChain={custodyChain} />}
          {activeTab === 'qr' && <QrTab evidence={evidence} />}
          {activeTab === 'photos' && <PhotosTab evidence={evidence} />}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ evidence }: { evidence: Evidence }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Basic Information</h3>
          <dl className="space-y-4">
            <DetailItem label="Name" value={evidence.name} />
            <DetailItem label="Description" value={evidence.description || '—'} />
            <DetailItem label="Evidence Number" value={evidence.evidence_number} />
            <DetailItem label="Evidence Type" value={evidence.evidence_type.replace(/_/g, ' ')} />
            <DetailItem label="Status" value={formatStatus(evidence.status)} />
            <DetailItem label="Category" value={evidence.category || '—'} />
            <DetailItem label="Sub Category" value={evidence.sub_category || '—'} />
            <DetailItem label="QR Code Hash" value={evidence.qr_code_hash.slice(0, 16) + '...'} />
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Seizure Details</h3>
          <dl className="space-y-4">
            <DetailItem label="Seized At" value={new Date(evidence.seized_at).toLocaleString()} />
            <DetailItem label="Seized By" value={evidence.seized_by_name || evidence.seized_by.slice(0, 8) + '...'} />
            <DetailItem label="Seized From" value={evidence.seized_from || '—'} />
            <DetailItem label="Location" value={evidence.seized_location?.address || '—'} />
            <DetailItem label="Panchnama Ref" value={evidence.panchnama_reference || '—'} />
            <DetailItem label="Seizure Memo" value={evidence.seizure_memo_number || '—'} />
            <DetailItem label="Container Seal" value={evidence.container_seal_number || '—'} />
            <DetailItem label="Condition" value={evidence.storage_condition || '—'} />
          </dl>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Physical Properties</h3>
        <dl className="space-y-4">
          <DetailItem label="Weight" value={evidence.weight_grams ? `${evidence.weight_grams} g` : '—'} />
          <DetailItem label="Dimensions" value={evidence.dimensions_cm ? JSON.stringify(evidence.dimensions_cm) : '—'} />
          <DetailItem label="Current Location" value={evidence.current_location || '—'} />
          <DetailItem label="Current Custodian" value={evidence.current_custodian_name || '—'} />
        </dl>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Forensic Lab Details</h3>
        <dl className="space-y-4">
          <DetailItem label="Forensic Lab" value={evidence.forensic_lab_id ? 'Assigned' : 'Not Assigned'} />
          <DetailItem label="Sent for Analysis" value={evidence.sent_for_analysis_at ? new Date(evidence.sent_for_analysis_at).toLocaleString() : '—'} />
          <DetailItem label="Analysis Completed" value={evidence.analysis_completed_at ? new Date(evidence.analysis_completed_at).toLocaleString() : '—'} />
          <DetailItem label="Analysis Report" value={evidence.analysis_report_document_id ? 'Available' : '—'} />
          <DetailItem label="Court Exhibit Number" value={evidence.court_exhibit_number || '—'} />
          <DetailItem label="Presented in Court" value={evidence.presented_in_court_at ? new Date(evidence.presented_in_court_at).toLocaleString() : '—'} />
        </dl>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Disposal Information</h3>
        <dl className="space-y-4">
          <DetailItem label="Disposal Method" value={evidence.disposal_method || '—'} />
          <DetailItem label="Disposed At" value={evidence.disposed_at ? new Date(evidence.disposed_at).toLocaleString() : '—'} />
          <DetailItem label="Disposed By" value={evidence.disposed_by || '—'} />
          <DetailItem label="Disposal Witness" value={evidence.disposal_witness || '—'} />
          <DetailItem label="Returned To" value={evidence.returned_to || '—'} />
          <DetailItem label="Returned At" value={evidence.returned_at ? new Date(evidence.returned_at).toLocaleString() : '—'} />
        </dl>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Photographs</h3>
        <div className="flex flex-wrap gap-2">
          {evidence.photographs?.length ? (
            evidence.photographs.map((photo, i) => (
              <img key={i} src={photo} alt={`Evidence photo ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
            ))
          ) : (
            <span className="text-gray-500 text-sm">No photographs</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CustodyTab({ custodyChain }: { custodyChain: CustodyChainEvent[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Custody Chain ({custodyChain.length})</h3>
      </div>
      <div className="space-y-3">
        {custodyChain.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No custody events recorded yet.</p>
          </div>
        ) : (
          custodyChain.map((event, index) => (
            <div key={`${event.id}-${index}`} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <getActionIcon(event.action) className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{formatAction(event.action)}</span>
                      <span className="badge badge-blue">{event.action}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {event.recorded_by_name || event.recorded_by.slice(0, 8) + '...'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.occurred_at).toLocaleString()}
                      </span>
                      {event.blockchain_tx_id && (
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {event.blockchain_tx_id.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:ml-auto">
                  {event.seal_number && (
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Scale className="w-3 h-3" />
                      Seal: {event.seal_number}
                    </span>
                  )}
                  {event.condition_notes && (
                    <span className="text-sm text-gray-500">{event.condition_notes}</span>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

function QrTab({ evidence }: { evidence: Evidence }) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">QR Code for Evidence</h3>
        <p className="text-gray-600 mt-1">Scan to verify evidence on ADALAT360</p>
      </div>
      <div className="bg-white rounded-lg p-8 border border-gray-200 inline-block">
        {evidence.qr_code_image_path ? (
          <img src={evidence.qr_code_image_path} alt="QR Code" className="w-64 h-64 mx-auto" />
        ) : (
          <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <QrCode className="w-16 h-16 text-gray-400" />
            <p className="text-gray-500 mt-2">QR code not available</p>
          </div>
        )}
      </div>
      <div className="bg-gray-50 rounded-lg p-4 text-left">
        <h4 className="font-medium text-gray-900 mb-2">QR Code Data</h4>
        <pre className="text-xs text-gray-600 overflow-x-auto">
          {JSON.stringify({
            v: 1,
            type: 'EVIDENCE',
            id: evidence.id,
            num: evidence.evidence_number,
            case: evidence.case_id?.slice(0, 8),
          }, null, 2)}
        </pre>
      </div>
      <div className="flex justify-center gap-4">
        <button className="btn-primary">
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </button>
        <button className="btn-secondary">
          <Eye className="w-4 h-4 mr-2" />
          View on Verification Page
        </button>
      </div>
    </div>
  );
}

function PhotosTab({ evidence }: { evidence: Evidence }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Evidence Photographs</h3>
      {evidence.photographs?.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {evidence.photographs.map((photo, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <img src={photo} alt={`Evidence photo ${i + 1}`} className="w-full h-48 object-cover" />
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900">Photo {i + 1}</p>
                <p className="text-xs text-gray-500">Click to view full size</p>
              </div>
            </div>
          ))
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No photographs uploaded for this evidence.</p>
        </div>
      )}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
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

function getActionIcon(action: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    SEIZURE: <ShieldCheck className="w-4 h-4" />,
    HANDOVER: <ArrowRightLeft className="w-4 h-4" />,
    RECEIVE: <ArrowRightLeft className="w-4 h-4" />,
    TRANSFER: <ArrowRightLeft className="w-4 h-4" />,
    ANALYSIS_START: <FlaskConical className="w-4 h-4" />,
    ANALYSIS_COMPLETE: <CheckCircle2 className="w-4 h-4" />,
    COURT_SUBMISSION: <Gavel className="w-4 h-4" />,
    COURT_RETURN: <Gavel className="w-4 h-4" />,
    DISPOSAL: <Archive className="w-4 h-4" />,
  };
  return icons[action] || <ShieldCheck className="w-4 h-4" />;
}

function formatAction(action: string): string {
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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