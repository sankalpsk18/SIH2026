import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, GitBranch, ShieldCheck, History, Users } from 'lucide-react';

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'evidence', label: 'Evidence', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <History className="w-4 h-4" /> },
    { id: 'entity-graph', label: 'Entity Graph', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'assignments', label: 'Assignments', icon: <Users className="w-4 h-4" /> },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/cases')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Case {caseId || 'Overview'}</h1>
            <p className="text-gray-600 mt-1">Detailed case summary and supporting materials</p>
          </div>
        </div>
        <span className="badge badge-blue">Open</span>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Case Number" value="ADL-2026-104" />
          <InfoItem label="Police Station" value="Saket" />
          <InfoItem label="District" value="New Delhi" />
          <InfoItem label="Court" value="Patiala House" />
        </div>
      </div>

      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map(tab => (
            <button key={tab.id} className="tab tab-active">
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Case Overview</h3>
              <p className="text-gray-600">This case record is temporarily restored in safe mode while the full feature set is validated.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Documents: 18</div>
                <div>Evidence Items: 9</div>
                <div>Timeline Events: 27</div>
              </div>
            </div>
          </div>
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
