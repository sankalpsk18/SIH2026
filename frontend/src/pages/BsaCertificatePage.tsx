import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileCheck, Loader2, Plus, Printer, Search, Shield, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { bsaApi, casesApi, documentsApi } from '../services/api';
import { BSA63Certificate, Case, Document } from '../types';
import { toast } from 'react-hot-toast';
import { CertificateDocumentPreview } from './CertificateDocumentPreview';

type Tab = 'list' | 'generate' | 'verify';

export function BsaCertificatePage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [cases, setCases] = useState<Case[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [certificates, setCertificates] = useState<BSA63Certificate[]>([]);
  const [documentLookup, setDocumentLookup] = useState<Record<string, { number: string; title: string }>>({});
  const [selectedCaseId, setSelectedCaseId] = useState(searchParams.get('caseId') || '');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [certificateType, setCertificateType] = useState<'ELECTRONIC_RECORD' | 'DIGITAL_SIGNATURE' | 'COMPUTER_OUTPUT'>('ELECTRONIC_RECORD');
  const [verifyNumber, setVerifyNumber] = useState('');
  const [verification, setVerification] = useState<any>(null);
  const [viewingCertificate, setViewingCertificate] = useState<BSA63Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    casesApi.list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' })
      .then(async response => {
        const loadedCases = response.data.cases || [];
        setCases(loadedCases);
        const certificateResponses = await Promise.allSettled(
          loadedCases.map((caseItem: Case) => bsaApi.listByCase(caseItem.id))
        );
        setCertificates(certificateResponses.flatMap(result =>
          result.status === 'fulfilled' ? result.value.data || [] : []
        ));
        const documentResponses = await Promise.allSettled(
          loadedCases.map((caseItem: Case) => documentsApi.listByCase(caseItem.id, { limit: 100 }))
        );
        setDocumentLookup(Object.fromEntries(documentResponses.flatMap(result =>
          result.status === 'fulfilled'
            ? (result.value.data.documents || []).map((document: Document) => [document.id, { number: document.document_number, title: document.title }])
            : []
        )));
      })
      .catch(() => toast.error('Could not load cases for BSA certificates'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setSelectedDocumentId('');
    setDocuments([]);
    if (!selectedCaseId) return;
    Promise.all([
      documentsApi.listByCase(selectedCaseId, { limit: 100, sort_by: 'created_at', sort_order: 'desc' }),
    ])
      .then(([documentResponse]) => {
        setDocuments(documentResponse.data.documents || []);
      })
      .catch(() => toast.error('Could not load case certificate data'));
  }, [selectedCaseId]);

  const selectedDocument = useMemo(() => documents.find(document => document.id === selectedDocumentId), [documents, selectedDocumentId]);

  const generateCertificate = async () => {
    if (!selectedCaseId || !selectedDocumentId) {
      toast.error('Select a case and document first');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await bsaApi.generate({
        caseId: selectedCaseId,
        documentId: selectedDocumentId,
        section: '63',
        certificateType,
      });
      const generatedCertificate = response.data.certificate as BSA63Certificate;
      setCertificates(current => [
        generatedCertificate,
        ...current.filter(certificate => certificate.id !== generatedCertificate.id),
      ]);
      toast.success(`Certificate ${generatedCertificate.certificateNumber} generated`);
      setActiveTab('list');
      setViewingCertificate(generatedCertificate);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Certificate generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const verifyCertificate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verifyNumber.trim()) {
      toast.error('Enter a certificate number');
      return;
    }
    setIsVerifying(true);
    try {
      const response = await bsaApi.verify(verifyNumber.trim());
      setVerification(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Certificate verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Evidence admissibility</p><h1 className="text-2xl font-bold text-gray-900">BSA certificates</h1><p className="text-gray-600 mt-1">Generate and verify certificates under Section 63.</p></div><button onClick={() => setActiveTab('generate')} className="btn-primary"><Plus className="w-4 h-4" /> Generate certificate</button></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><SummaryCard label="Certificates issued" value={certificates.length} icon={FileCheck} color="text-primary-700 bg-primary-50" /><SummaryCard label="Current case" value={selectedCaseId ? (cases.find(caseItem => caseItem.id === selectedCaseId)?.case_number || 'Selected') : 'Select a case'} icon={ClipboardCheck} color="text-emerald-700 bg-emerald-50" /><SummaryCard label="Section" value="63" icon={Shield} color="text-amber-700 bg-amber-50" /></div>

      <div className="card overflow-hidden"><div className="tabs border-b border-gray-200 px-4 overflow-x-auto">{(['list', 'generate', 'verify'] as Tab[]).map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`tab whitespace-nowrap ${activeTab === tab ? 'tab-active' : ''}`}>{tab === 'list' ? <FileCheck className="w-4 h-4" /> : tab === 'generate' ? <Plus className="w-4 h-4" /> : <Shield className="w-4 h-4" />}<span className="ml-2">{tab === 'list' ? 'Certificates' : tab === 'generate' ? 'Generate' : 'Verify'}</span></button>)}</div><div className="p-6">
        {activeTab === 'list' && <CertificateList certificates={certificates} onVerify={certificate => { setVerifyNumber(certificate.certificateNumber); setActiveTab('verify'); }} onView={setViewingCertificate} />}
        {activeTab === 'generate' && <div className="max-w-3xl space-y-6"><div className="flex items-start gap-3 p-4 rounded-xl bg-primary-50 border border-primary-100"><Sparkles className="w-5 h-5 text-primary-700 mt-0.5" /><div><p className="font-semibold text-primary-900">Create a court-ready certificate</p><p className="text-sm text-primary-800 mt-1">Only the system administrator can issue or verify BSA certificates.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="label">Case *</label><select value={selectedCaseId} onChange={event => setSelectedCaseId(event.target.value)} className="input"><option value="">Select a case</option>{cases.map(caseItem => <option key={caseItem.id} value={caseItem.id}>{caseItem.case_number} · {caseItem.title}</option>)}</select></div><div><label className="label">Document *</label><select value={selectedDocumentId} onChange={event => setSelectedDocumentId(event.target.value)} disabled={!selectedCaseId} className="input"><option value="">{selectedCaseId ? 'Select a document' : 'Select a case first'}</option>{documents.map(document => <option key={document.id} value={document.id}>{document.document_number} · {document.title}</option>)}</select></div><div><label className="label">Certificate type *</label><select value={certificateType} onChange={event => setCertificateType(event.target.value as typeof certificateType)} className="input"><option value="ELECTRONIC_RECORD">Electronic record</option><option value="DIGITAL_SIGNATURE">Digital signature</option><option value="COMPUTER_OUTPUT">Computer output</option></select></div></div>{selectedDocument && <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm"><p className="font-semibold text-gray-900">{selectedDocument.title}</p><p className="text-gray-500 mt-1">{selectedDocument.original_filename} · SHA-256 {selectedDocument.file_hash_sha256.slice(0, 16)}...</p></div>}<button onClick={generateCertificate} disabled={isGenerating || !selectedDocumentId} className="btn-primary">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{isGenerating ? 'Generating...' : 'Create certificate'}</button></div>}
        {activeTab === 'verify' && <form onSubmit={verifyCertificate} className="max-w-2xl space-y-4"><div><label className="label">Certificate number</label><input value={verifyNumber} onChange={event => setVerifyNumber(event.target.value)} className="input" placeholder="BSA63/2026/XXXXXXXX/0001" /></div><button type="submit" disabled={isVerifying} className="btn-primary">{isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{isVerifying ? 'Verifying...' : 'Verify certificate'}</button>{verification && <div className={`p-5 rounded-xl border ${verification.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${verification.valid ? 'bg-emerald-500' : 'bg-red-500'}`} /><p className="font-semibold text-gray-900">{verification.valid ? 'Certificate verified' : 'Verification failed'}</p></div>{verification.certificate && <><p className="mt-3 font-mono text-sm text-gray-900">{verification.certificate.certificateNumber}</p><div className="flex gap-2 mt-3"><button type="button" onClick={() => setViewingCertificate(verification.certificate)} className="btn-primary btn-sm">View certificate</button><button type="button" onClick={() => { setSelectedCaseId(verification.certificate.caseId); setActiveTab('list'); }} className="btn-secondary btn-sm">View in certificates</button></div></>}<ul className="mt-3 space-y-1 text-sm text-gray-700">{verification.verificationDetails?.details?.map((detail: string) => <li key={detail}>{detail}</li>)}</ul></div>}</form>}
      </div></div>
      {viewingCertificate && <CertificateDocumentPreview certificate={viewingCertificate} documentContext={documentLookup[viewingCertificate.documentId]} caseContext={cases.find(caseItem => caseItem.id === viewingCertificate.caseId)} onClose={() => setViewingCertificate(null)} />}
    </div>
  );
}

function CertificateList({ certificates, onVerify, onView }: { certificates: BSA63Certificate[]; onVerify: (certificate: BSA63Certificate) => void; onView: (certificate: BSA63Certificate) => void }) { return certificates.length === 0 ? <div className="py-12 text-center"><FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="font-medium text-gray-900">No certificates yet</p><p className="text-sm text-gray-500 mt-1">Choose Generate to create the first certificate for a case document.</p></div> : <div className="space-y-3">{certificates.map(certificate => <div key={certificate.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"><div><p className="font-mono font-semibold text-gray-900">{certificate.certificateNumber}</p><p className="text-sm text-gray-500 mt-1">Section {certificate.section} · Issued {new Date(certificate.issuedAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><span className={`badge ${certificate.status === 'ISSUED' ? 'badge-green' : certificate.status === 'REVOKED' ? 'badge-red' : 'badge-yellow'}`}>{certificate.status}</span><button onClick={() => onView(certificate)} className="btn-primary btn-sm"><FileCheck className="w-4 h-4" /> View certificate</button><button onClick={() => onVerify(certificate)} className="btn-secondary btn-sm"><Shield className="w-4 h-4" /> Verify</button></div></div>)}</div>; }

function CertificatePreview({ certificate, caseContext, documentContext, onClose }: { certificate: BSA63Certificate; caseContext?: Case; documentContext?: { number: string; title: string }; onClose: () => void }) {
  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title" onClick={onClose}><div className="modal-content max-w-3xl" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary-600">ADALAT360 · Digital Evidence</p><h2 id="certificate-preview-title" className="text-xl font-bold text-gray-900">Section 63 Certificate</h2></div><button onClick={onClose} className="btn-ghost btn-sm">Close</button></div><div className="modal-body space-y-6"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 p-5 rounded-xl bg-slate-50 border border-slate-200"><div><p className="text-xs uppercase tracking-wider text-gray-500">Certificate number</p><p className="font-mono text-lg font-bold text-gray-900 mt-1">{certificate.certificateNumber}</p><p className="text-sm text-gray-600 mt-3">This certificate records the authenticity and custody of an electronic record under Section {certificate.section} of the Bharatiya Sakshya Adhiniyam.</p></div>{certificate.qrCodeImageUrl && <img src={certificate.qrCodeImageUrl} alt="Certificate verification QR code" className="w-28 h-28 rounded-lg border border-gray-200 bg-white p-1" />}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><PreviewItem label="Case" value={caseContext ? `${caseContext.case_number} · ${caseContext.title}` : certificate.caseId} /><PreviewItem label="Document" value={documentContext ? `${documentContext.number} · ${documentContext.title}` : certificate.documentId} /><PreviewItem label="Issued" value={new Date(certificate.issuedAt).toLocaleString()} /><PreviewItem label="Valid until" value={certificate.validUntil ? new Date(certificate.validUntil).toLocaleDateString() : 'No expiry'} /><PreviewItem label="Record type" value={certificate.certificateType.replace(/_/g, ' ')} /><PreviewItem label="Status" value={certificate.status} /></div><div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /><p className="font-semibold text-emerald-900">Certificate verified</p></div><p className="text-sm text-emerald-800 mt-1">SHA-256 hash and custody chain checks passed.</p></div><div><p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Document SHA-256</p><p className="font-mono text-xs text-gray-700 bg-gray-50 rounded-lg p-3 break-all">{certificate.fileHash}</p></div></div><div className="modal-footer"><button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4" /> Print certificate</button><button onClick={onClose} className="btn-primary">Close preview</button></div></div></div>;
}

function PreviewItem({ label, value }: { label: string; value: string }) { return <div className="p-3 rounded-lg border border-gray-200"><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 mt-1 break-all">{value}</p></div>; }
function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) { return <div className="card p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div><div><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="font-semibold text-gray-900 mt-1 truncate max-w-[15rem]">{value}</p></div></div>; }
