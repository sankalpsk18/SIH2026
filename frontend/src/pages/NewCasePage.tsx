import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FolderPlus, Loader2 } from 'lucide-react';
import { casesApi } from '../services/api';
import { CasePriority } from '../types';
import { toast } from 'react-hot-toast';

const priorities: CasePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function NewCasePage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    case_number: '',
    fir_number: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as CasePriority,
    police_station: '',
    district: '',
    state: '',
    jurisdiction_court: '',
    incident_date: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.case_number.trim() || !form.title.trim()) {
      toast.error('Case number and title are required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await casesApi.create({
        ...form,
        priority: form.priority,
        incident_date: form.incident_date || undefined,
      });
      toast.success('Case created successfully');
      navigate(`/cases/${response.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create case');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/cases')} className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100" aria-label="Back to cases">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-sm font-medium text-primary-600">Case workspace</p>
          <h1 className="text-2xl font-bold text-gray-900">Create a new case</h1>
          <p className="text-gray-600 mt-1">Register the core details now. Documents and evidence can be added after creation.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center"><FolderPlus className="w-5 h-5 text-primary-700" /></div>
          <div><h2 className="font-semibold text-gray-900">Case details</h2><p className="text-sm text-gray-500">Fields marked with * are required.</p></div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Case number *" value={form.case_number} onChange={value => updateField('case_number', value)} placeholder="ADL-2026-001" required />
            <Field label="FIR number" value={form.fir_number} onChange={value => updateField('fir_number', value)} placeholder="FIR/2026/001" />
            <div className="md:col-span-2"><Field label="Case title *" value={form.title} onChange={value => updateField('title', value)} placeholder="Brief, searchable description of the matter" required /></div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea value={form.description} onChange={event => updateField('description', event.target.value)} className="input min-h-28 resize-y" placeholder="Add a concise case summary and known context" /></div>
            <div><label className="label">Priority</label><select value={form.priority} onChange={event => updateField('priority', event.target.value)} className="input">{priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></div>
            <div><label className="label">Incident date</label><input type="date" value={form.incident_date} onChange={event => updateField('incident_date', event.target.value)} className="input" /></div>
          </div>

          <div className="pt-5 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Jurisdiction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Police station" value={form.police_station} onChange={value => updateField('police_station', value)} placeholder="Station name" />
              <Field label="District" value={form.district} onChange={value => updateField('district', value)} placeholder="District" />
              <Field label="State" value={form.state} onChange={value => updateField('state', value)} placeholder="State" />
              <Field label="Jurisdiction court" value={form.jurisdiction_court} onChange={value => updateField('jurisdiction_court', value)} placeholder="Court name" />
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={() => navigate('/cases')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSaving} className="btn-primary"><>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {isSaving ? 'Creating...' : 'Create case'}</></button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <div><label className="label">{label}</label><input required={required} value={value} onChange={event => onChange(event.target.value)} className="input" placeholder={placeholder} /></div>;
}
