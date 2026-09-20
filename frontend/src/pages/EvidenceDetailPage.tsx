import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, Download, Eye, QrCode, ShieldCheck, History, Loader2, AlertCircle, FileText, MapPin, User, Clock, Tag, Hash, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { evidenceApi } from '../services/api';
import { Evidence, EvidenceStatus, EvidenceType } from '../types';
import { toast } from 'react-hot-toast';

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EvidenceDetailPage() {
  const { evidenceId } = useParams<{ evidenceId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'custody' | 'qr' | 'photos'>('details');
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [custodyChain, setCustodyChain] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabs: Array<{ id: 'details' | 'custody' | 'qr' | 'photos'; label: string; icon: React.ReactNode }> = [
    { id: 'details', label: 'Details', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'custody', label: 'Custody Chain', icon: <History className="w-4 h-4" /> },
    { id: 'qr', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { id: 'photos', label: 'Photos', icon: <Camera className="w-4 h-4" /> },
  ];

  useEffect(() => {
    if (evidenceId) {
      loadEvidence();
    }
  }, [evidenceId]);

  const loadEvidence = async () => {
    if (!evidenceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [evidenceRes, custodyRes] = await Promise.all([
        evidenceApi.get(evidenceId),
        evidenceApi.getCustodyChain(evidenceId).catch(() => ({ data: { custodyChain: [] } })),
      ]);

      setEvidence(evidenceRes.data);
      setCustodyChain(custodyRes.data.custodyChain || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load evidence');
      toast.error('Failed to load evidence details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evidence')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evidence Not Found</h1>
            <p className="text-gray-600 mt-1">The evidence record could not be loaded.</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error || 'Evidence not found'}</p>
          <button onClick={() => navigate('/evidence')} className="btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Evidence List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evidence')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{evidence.name}</h1>
              <span className={`badge ${getStatusBadgeColor(evidence.status)}`}>
                {formatStatus(evidence.status)}
              </span>
              <span className="badge badge-blue">{evidence.evidence_type.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-gray-600 mt-1">{evidence.evidence_number} · {evidence.case_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-secondary" disabled={!evidence.qr_code_image_path}>
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </button>
          <Link to={`/evidence/${evidence.id}/qr-code`} className="btn-secondary">
            <QrCode className="w-4 h-4 mr-2" />
            View QR
          </Link>
          <Link to={`/evidence/${evidence.id}/custody-chain`} className="btn-secondary">
            <History className="w-4 h-4 mr-2" />
            Custody Chain
          </Link>
          <Link to={`/evidence/${evidence.id}/transfer`} className="btn-primary">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Transfer
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}>
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Hash className="w-5 h-5 text-gray-400" />
                    Basic Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Evidence Number</span>
                      <span className="font-mono text-gray-900">{evidence.evidence_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Category</span>
                      <span className="text-gray-900">{evidence.evidence_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={`badge ${getStatusBadgeColor(evidence.status)}`}>{formatStatus(evidence.status)}</span>
                    </div>
                    {evidence.category && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sub Category</span>
                        <span className="text-gray-900">{evidence.category}</span>
                      </div>
                    )}
                    {evidence.sub_category && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="text-gray-900">{evidence.sub_category}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">QR Code Hash</span>
                      <span className="font-mono text-gray-900 text-xs">{evidence.qr_code_hash}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    Seizure Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Seized At</span>
                      <span className="text-gray-900">{formatDateTime(evidence.seized_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Seized By</span>
                      <span className="text-gray-900">{evidence.seized_by_name || evidence.seized_by}</span>
                    </div>
                    {evidence.current_location && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Current Location</span>
                        <span className="text-gray-900">{evidence.current_location}</span>
                      </div>
                    )}
                    {evidence.current_custodian_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Current Custodian</span>
                        <span className="text-gray-900">{evidence.current_custodian_name}</span>
                      </div>
                    )}
                    {evidence.forensic_lab_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Forensic Lab</span>
                        <span className="text-gray-900">{evidence.forensic_lab_id}</span>
                      </div>
                    )}
                    {evidence.sent_for_analysis_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sent for Analysis</span>
                        <span className="text-gray-900">{formatDateTime(evidence.sent_for_analysis_at)}</span>
                      </div>
                    )}
                    {evidence.analysis_completed_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Analysis Completed</span>
                        <span className="text-gray-900">{formatDateTime(evidence.analysis_completed_at)}</span>
                      </div>
                    )}
                    {evidence.court_exhibit_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Court Exhibit #</span>
                        <span className="text-gray-900">{evidence.court_exhibit_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    Description & Metadata
                  </h3>
                  <div className="space-y-3 text-sm">
                    {evidence.description ? (
                      <div>
                        <p className="text-gray-500 mb-1">Description</p>
                        <p className="text-gray-900">{evidence.description}</p>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">No description provided</p>
                    )}
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-gray-500 text-xs mb-1">System Information</p>
                      <div className="space-y-1 text-xs text-gray-600 font-mono">
                        <div>ID: {evidence.id}</div>
                        <div>Case ID: {evidence.case_id}</div>
                        <div>Created: {formatDateTime(evidence.created_at)}</div>
                        <div>Updated: {formatDateTime(evidence.updated_at)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {evidence.photographs && evidence.photographs.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Photographs</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {evidence.photographs.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={photo} alt={`Evidence photo ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'custody' && (
            <div className="space-y-3">
              {custodyChain.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No custody chain events recorded</p>
                </div>
              ) : (
                custodyChain.map((event, index) => (
                  <div key={event.id || index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{event.action?.replace(/_/g, ' ') || 'Unknown Action'}</p>
                          <span className="text-xs text-gray-400">{formatDateTime(event.occurred_at)}</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 mt-1">
                          {event.from_user_id && (
                            <p><span className="font-medium">From:</span> {event.from_user_id}</p>
                          )}
                          {event.to_user_id && (
                            <p><span className="font-medium">To:</span> {event.to_user_id}</p>
                          )}
                          {event.from_location && (
                            <p><span className="font-medium">From Location:</span> {event.from_location}</p>
                          )}
                          {event.to_location && (
                            <p><span className="font-medium">To Location:</span> {event.to_location}</p>
                          )}
                          {event.seal_number && (
                            <p><span className="font-medium">Seal #:</span> {event.seal_number} {event.seal_intact !== undefined ? `(Seal ${event.seal_intact ? 'Intact' : 'Broken'})` : ''}</p>
                          )}
                          {event.condition_notes && (
                            <p><span className="font-medium">Condition:</span> {event.condition_notes}</p>
                          )}
                          {event.recorded_by_name && (
                            <p><span className="font-medium">Recorded by:</span> {event.recorded_by_name}</p>
                          )}
                          {event.blockchain_tx_id && (
                            <p className="flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              <span className="font-medium">Blockchain TX:</span>
                              <span className="font-mono text-xs">{event.blockchain_tx_id}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="text-center py-8">
              {evidence.qr_code_image_path ? (
                <div className="inline-block">
                  <img src={evidence.qr_code_image_path} alt={`QR Code for ${evidence.evidence_number}`} className="w-64 h-64" />
                  <p className="mt-4 text-sm text-gray-500">QR Code Hash: {evidence.qr_code_hash}</p>
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-64 h-64 bg-gray-100 rounded-lg">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <div className="mt-6 text-sm text-gray-600">
                <p>Evidence: {evidence.evidence_number}</p>
                <p>Case: {evidence.case_id}</p>
                <p>Hash: {evidence.qr_code_hash}</p>
              </div>
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              {evidence.photographs && evidence.photographs.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {evidence.photographs.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={photo} alt={`Evidence photo ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="btn-secondary text-white">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No photographs uploaded for this evidence.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}