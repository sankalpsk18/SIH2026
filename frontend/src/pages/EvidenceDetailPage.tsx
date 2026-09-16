import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Download, Eye, QrCode, ShieldCheck, History } from 'lucide-react';

export function EvidenceDetailPage() {
  const { evidenceId } = useParams<{ evidenceId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'custody' | 'qr' | 'photos'>('details');

  const tabs: Array<{ id: 'details' | 'custody' | 'qr' | 'photos'; label: string; icon: React.ReactNode }> = [
    { id: 'details', label: 'Details', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'custody', label: 'Custody Chain', icon: <History className="w-4 h-4" /> },
    { id: 'qr', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { id: 'photos', label: 'Photos', icon: <Camera className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evidence')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Evidence {evidenceId || 'OV-104'}</h1>
              <span className="badge badge-blue">Digital</span>
            </div>
            <p className="text-gray-600 mt-1">Evidence record and custody summary</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary"><Download className="w-4 h-4 mr-2" />Download</button>
          <button className="btn-secondary"><Eye className="w-4 h-4 mr-2" />View</button>
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
          {activeTab === 'details' && <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-gray-50 rounded-lg p-4"><h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3><div className="space-y-2 text-sm text-gray-600"><div>Evidence Number: EVD-104</div><div>Category: Digital</div><div>Status: In Custody</div></div></div><div className="bg-gray-50 rounded-lg p-4"><h3 className="font-semibold text-gray-900 mb-3">Seizure Details</h3><div className="space-y-2 text-sm text-gray-600"><div>Seized At: 15 Jan 2026</div><div>Seized By: SI Verma</div><div>Location: Saket</div></div></div></div>}
          {activeTab === 'custody' && <div className="space-y-3"><div className="p-4 bg-gray-50 rounded-lg"><p className="font-medium text-gray-900">Evidence Seized</p><p className="text-sm text-gray-500">Seized by SI Verma on 15 Jan 2026</p></div><div className="p-4 bg-gray-50 rounded-lg"><p className="font-medium text-gray-900">Transferred to Forensic Lab</p><p className="text-sm text-gray-500">Transferred on 16 Jan 2026</p></div></div>}
          {activeTab === 'qr' && <div className="text-center"><div className="inline-flex items-center justify-center w-64 h-64 bg-gray-100 rounded-lg"><QrCode className="w-16 h-16 text-gray-400" /></div></div>}
          {activeTab === 'photos' && <div className="text-gray-500">No photographs uploaded for this evidence.</div>}
        </div>
      </div>
    </div>
  );
}
