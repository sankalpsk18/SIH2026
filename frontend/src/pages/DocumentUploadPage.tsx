import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { casesApi, documentsApi } from '../services/api';
import { Case, DocumentType } from '../types';
import { toast } from 'react-hot-toast';

const documentTypes: DocumentType[] = ['FIR', 'INVESTIGATION_RECORD', 'WITNESS_STATEMENT', 'CHARGE_SHEET', 'COURT_FILING', 'EVIDENCE_RECORD', 'FORENSIC_REPORT', 'LEGAL_NOTICE', 'JUDGMENT', 'ORDER', 'SUMMONS', 'WARRANT', 'BAIL_APPLICATION', 'AFFIDAVIT', 'EXHIBIT_LIST', 'SEIZURE_MEMO', 'PANCHNAMA', 'CASE_DIARY', 'OTHER'];

export function DocumentUploadPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ caseId: '', title: '', documentType: 'OTHER' as DocumentType, description: '', tags: '' });

  useEffect(() => {
    casesApi.list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' })
      .then(response => setCases(response.data.cases || []))
      .catch(() => toast.error('Could not load cases'));
  }, []);

  const updateField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !form.caseId || !form.title.trim()) {
      toast.error('Choose a case, file, and title before uploading');
      return;
    }
    setIsSaving(true);
    try {
      const response = await documentsApi.upload(file, {
        caseId: form.caseId,
        title: form.title,
        documentType: form.documentType,
        description: form.description || undefined,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      });
      toast.success('Document uploaded successfully');
      navigate(`/documents/${response.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/documents')} className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100" aria-label="Back to documents"><ArrowLeft className="w-5 h-5" /></button>
        <div><p className="text-sm font-medium text-emerald-700">Document intake</p><h1 className="text-2xl font-bold text-gray-900">Upload a document</h1><p className="text-gray-600 mt-1">Attach a source file to a case and begin its audit trail.</p></div>
      </div>

      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><FileUp className="w-5 h-5 text-emerald-700" /></div><div><h2 className="font-semibold text-gray-900">File and metadata</h2><p className="text-sm text-gray-500">Files are encrypted and hashed during intake.</p></div></div>
        <div className="p-6 space-y-6">
          <label className="block cursor-pointer"><span className="label">Source file *</span><div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/40'}`}><UploadCloud className="w-8 h-8 mx-auto mb-2 text-gray-400" /><p className="font-medium text-gray-900">{file ? file.name : 'Choose a file to upload'}</p><p className="text-sm text-gray-500 mt-1">PDF, DOCX, images, and other case records</p><input type="file" className="sr-only" onChange={event => setFile(event.target.files?.[0] || null)} /></div></label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="label">Case *</label><select value={form.caseId} onChange={event => updateField('caseId', event.target.value)} className="input"><option value="">Select a case</option>{cases.map(caseItem => <option key={caseItem.id} value={caseItem.id}>{caseItem.case_number} · {caseItem.title}</option>)}</select></div>
            <div><label className="label">Document type</label><select value={form.documentType} onChange={event => updateField('documentType', event.target.value)} className="input">{documentTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Title *</label><input required value={form.title} onChange={event => updateField('title', event.target.value)} className="input" placeholder="e.g. Signed witness statement - R. Mehta" /></div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea value={form.description} onChange={event => updateField('description', event.target.value)} className="input min-h-24 resize-y" placeholder="Add context for reviewers" /></div>
            <div className="md:col-span-2"><label className="label">Tags</label><input value={form.tags} onChange={event => updateField('tags', event.target.value)} className="input" placeholder="witness, statement, urgent" /><p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas.</p></div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"><button type="button" onClick={() => navigate('/documents')} className="btn-secondary">Cancel</button><button type="submit" disabled={isSaving} className="btn-primary">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}{isSaving ? 'Uploading...' : 'Upload document'}</button></div>
      </form>
    </div>
  );
}
