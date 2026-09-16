import React, { useState } from 'react';
import { CheckCircle2, FileCheck, Plus, Search, Shield } from 'lucide-react';

export function BsaCertificatePage() {
  const [activeTab, setActiveTab] = useState<'list' | 'generate' | 'verify'>('list');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BSA Certificate</h1>
          <p className="text-gray-600 mt-1">Generate and verify certificates under Section 63</p>
        </div>
        <button className="btn-primary"><Plus className="w-4 h-4 mr-2" />Generate</button>
      </div>

      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {['list', 'generate', 'verify'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as 'list' | 'generate' | 'verify')} className={`tab ${activeTab === tab ? 'tab-active' : ''}`}>
              {tab === 'list' ? <FileCheck className="w-4 h-4" /> : tab === 'generate' ? <Plus className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              <span className="ml-2">{tab === 'list' ? 'Certificates' : tab === 'generate' ? 'Generate' : 'Verify'}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'list' && <div className="space-y-4"><div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><p className="font-medium text-gray-900">BSA-63-2026-001</p><p className="text-sm text-gray-500">Issue: 15 Jan 2026</p></div><span className="badge badge-green">Valid</span></div><div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><p className="font-medium text-gray-900">BSA-63-2026-002</p><p className="text-sm text-gray-500">Issue: 12 Jan 2026</p></div><span className="badge badge-yellow">Pending Review</span></div></div>}
          {activeTab === 'generate' && <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Case ID</label><input className="input" placeholder="Select a case" /></div><div><label className="label">Document ID</label><input className="input" placeholder="Select a document" /></div></div><button className="btn-primary"><CheckCircle2 className="w-4 h-4 mr-2" />Create Certificate</button></div>}
          {activeTab === 'verify' && <div className="space-y-4"><div><label className="label">Verification input</label><input className="input" placeholder="Paste certificate hash or ID" /></div><button className="btn-primary"><Search className="w-4 h-4 mr-2" />Verify</button></div>}
        </div>
      </div>
    </div>
  );
}
