// ============================================================================
// ADALAT360 - BSA Section 63 Certificate Page
// Generate and verify court-admissible certificates
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Loader2,
  FileCheck,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Eye,
  Copy,
  Clipboard,
  QrCode,
  Hash,
  Clock,
  Scale,
  FileSignature,
  Trash2,
  Edit,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { bsaApi, casesApi, documentsApi } from '../../services/api';
import { BSA63Certificate, BSA63CertificateContent, Document, Case } from '../../types';
import { toast } from 'react-hot-toast';

const generateSchema = z.object({
  caseId: z.string().uuid('Please select a case'),
  documentId: z.string().uuid('Please select a document'),
  section: z.string().default('63'),
  certificateType: z.enum(['ELECTRONIC_RECORD', 'DIGITAL_SIGNATURE', 'COMPUTER_OUTPUT']).default('ELECTRONIC_RECORD'),
  validUntil: z.string().optional(),
  customContent: z.object({
    computerOutput: z.object({
      description: z.string().optional(),
      producedBy: z.string().optional(),
      productionDate: z.string().optional(),
      productionProcess: z.string().optional(),
      responsiblePerson: z.string().optional(),
      responsiblePersonRole: z.string().optional(),
    }).optional(),
    conditions: z.object({
      regularUse: z.boolean().optional(),
      properOperation: z.boolean().optional(),
      accurateReproduction: z.boolean().optional(),
      informationSupplied: z.boolean().optional(),
    }).optional(),
    certificateDetails: z.object({
      identifier: z.string().optional(),
      descriptionOfOutput: z.string().optional(),
      particularsOfDevice: z.string().optional(),
      particularsOfProcedure: z.string().optional(),
      signatureOfPerson: z.string().optional(),
      designationOfPerson: z.string().optional(),
    }).optional(),
  }).optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;

export function BsaCertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [searchParams] = useSearchParams();
  const [certificates, setCertificates] = useState<BSA63Certificate[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'generate' | 'verify'>('list');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifyInput, setVerifyInput] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      section: '63',
      certificateType: 'ELECTRONIC_RECORD',
    },
  });

  const selectedCaseId = watch('caseId');

  useEffect(() => {
    loadCases();
    loadCertificates();
    if (certificateId) {
      loadCertificate(certificateId);
    }
  }, [certificateId]);

  const loadCases = async () => {
    try {
      const response = await casesApi.list({ limit: 100 });
      setCases(response.data.cases);
    } catch (error) {
      toast.error('Failed to load cases');
    }
  };

  const loadDocuments = async (caseId: string) => {
    try {
      const response = await documentsApi.listByCase(caseId, { limit: 100, is_latest_version: true });
      setDocuments(response.data.documents);
    } catch (error) {
      toast.error('Failed to load documents');
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      loadDocuments(selectedCaseId);
    } else {
      setDocuments([]);
    }
  }, [selectedCaseId]);

  const loadCertificates = async () => {
    setIsLoading(true);
    try {
      const response = await bsaApi.list(); // Need to implement list all
      setCertificates(response.data.certificates || []);
    } catch (error) {
      // Ignore - might not have list all endpoint
    } finally {
      setIsLoading(false);
    }
  };

  const loadCertificate = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await bsaApi.get(id);
      setVerificationResult(response.data);
      setActiveTab('verify');
    } catch (error: any) {
      toast.error('Failed to load certificate');
    } finally {
      setIsLoading(false);
    }
  };

  const onGenerate = async (data: GenerateFormData) => {
    setIsGenerating(true);
    try {
      const response = await bsaApi.generate(data);
      toast.success('BSA Certificate generated successfully');
      setShowGenerate(false);
      reset();
      loadCertificates();
      // Navigate to view certificate
      if (response.data.certificate) {
        // In production, navigate to certificate detail
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate certificate');
    } finally {
      setIsGenerating(false);
    }
  };

  const onVerify = async () => {
    if (!verifyInput.trim()) return;
    setIsLoading(true);
    try {
      const response = await bsaApi.verify(verifyInput);
      setVerificationResult(response.data);
      setActiveTab('verify');
    } catch (error: any) {
      toast.error('Verification failed');
      setVerificationResult({ valid: false, verificationDetails: { details: [error.response?.data?.message || 'Invalid certificate'] } });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt('Enter reason for revocation:');
    if (!reason) return;
    try {
      await bsaApi.revoke(id, reason);
      toast.success('Certificate revoked');
      loadCertificates();
    } catch (error: any) {
      toast.error('Failed to revoke certificate');
    }
  };

  if (certificateId) {
    return (
      <CertificateDetailView certificateId={certificateId} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BSA Section 63 Certificates</h1>
          <p className="text-gray-600 mt-1">Generate and verify court-admissible electronic record certificates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveTab('generate'); setShowGenerate(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Certificate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          <button
            onClick={() => { setActiveTab('list'); setShowGenerate(false); }}
            className={`tab ${activeTab === 'list' ? 'tab-active' : ''}`}
          >
            <FileSignature className="w-4 h-4" />
            <span className="ml-2">Certificates</span>
          </button>
          <button
            onClick={() => { setActiveTab('generate'); setShowGenerate(true); }}
            className={`tab ${activeTab === 'generate' ? 'tab-active' : ''}`}
          >
            <Plus className="w-4 h-4" />
            <span className="ml-2">Generate</span>
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`tab ${activeTab === 'verify' ? 'tab-active' : ''}`}
          >
            <Shield className="w-4 h-4" />
            <span className="ml-2">Verify</span>
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'list' && <CertificateList certificates={certificates} isLoading={isLoading} onRevoke={handleRevoke} />}
          {activeTab === 'generate' && <GenerateForm cases={cases} documents={documents} onSubmit={onGenerate} isGenerating={isGenerating} errors={errors} register={register} handleSubmit={handleSubmit} />}
          {activeTab === 'verify' && <VerifyForm onVerify={onVerify} verifyInput={verifyInput} setVerifyInput={setVerifyInput} result={verificationResult} isLoading={isLoading} />}
        </div>
      </div>
    </div>
  );
}

function CertificateList({ certificates, isLoading, onRevoke }: { certificates: BSA63Certificate[]; isLoading: boolean; onRevoke: (id: string) => void }) {
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 animate-spin text-primary-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Certificates ({certificates.length})</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Search certificates..." className="input w-64" />
        </div>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-12">
          <FileSignature className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
          <p className="text-gray-500 mb-4">Generate your first BSA Section 63 certificate</p>
          <button onClick={() => { setActiveTab('generate'); setShowGenerate(true); }} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Generate Certificate
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Certificate Number</th>
                <th>Case</th>
                <th>Document</th>
                <th>Issued By</th>
                <th>Issued At</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th className="w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id} className="hover:bg-gray-50">
                  <td className="font-mono font-medium text-gray-900">{cert.certificate_number}</td>
                  <td>{cert.caseId.slice(0, 8)}...</td>
                  <td>{cert.documentId.slice(0, 8)}...</td>
                  <td className="text-gray-600">{cert.issuedBy.slice(0, 8)}...</td>
                  <td className="text-gray-500">{new Date(cert.issued_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeColor(cert.status)}`}>
                      {cert.status}
                    </span>
                  </td>
                  <td className="text-gray-500">{cert.valid_until ? new Date(cert.valid_until).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(cert.certificate_number)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                        title="Copy Number"
                      >
                        <Clipboard className="w-4 h-4" />
                      </button>
                      <Link to={`/bsa/${cert.id}`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="View">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link to={`/bsa/${cert.id}/pdf`} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </Link>
                      {cert.status === 'ISSUED' && (
                        <button
                          onClick={() => onRevoke(cert.id)}
                          className="p-2 text-danger-500 hover:text-danger-700 hover:bg-danger-50 rounded-lg"
                          title="Revoke"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GenerateForm({ cases, documents, onSubmit, isGenerating, errors, register, handleSubmit }: any) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h3 className="font-medium text-primary-800 mb-2">Generate BSA Section 63 Certificate</h3>
        <p className="text-primary-700 text-sm">Only Prosecutors and Courts can issue certificates under BSA Section 63 for electronic records to be admissible as evidence.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Case <span className="text-danger-500">*</span></label>
          <select {...register('caseId')} className="input" disabled={cases.length === 0}>
            <option value="">Select a case</option>
            {cases.map((c: any) => (
              <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
            ))}
          </select>
          {errors.caseId && <p className="mt-1 text-sm text-danger-600">{errors.caseId.message}</p>}
        </div>

        <div>
          <label className="label">Document <span className="text-danger-500">*</span></label>
          <select {...register('documentId')} className="input" disabled={documents.length === 0}>
            <option value="">Select a document</option>
            {documents.map((d: any) => (
              <option key={d.id} value={d.id}>{d.document_number} - {d.title}</option>
            ))}
          </select>
          {errors.documentId && <p className="mt-1 text-sm text-danger-600">{errors.documentId.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Section</label>
          <input {...register('section')} className="input" defaultValue="63" readOnly />
        </div>
        <div>
          <label className="label">Certificate Type</label>
          <select {...register('certificateType')} className="input">
            <option value="ELECTRONIC_RECORD">Electronic Record</option>
            <option value="DIGITAL_SIGNATURE">Digital Signature</option>
            <option value="COMPUTER_OUTPUT">Computer Output</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Validity Until (Optional)</label>
        <input {...register('validUntil')} type="date" className="input" />
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <label className="label">Custom Content (Optional)</label>
        <p className="text-sm text-gray-600 mt-1">Advanced: Customize certificate content per BSA Section 63 requirements</p>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs">Description of Output</label>
              <input {...register('customContent.certificateDetails.descriptionOfOutput')} type="text" className="input text-xs" placeholder="Brief description" />
            </div>
            <div>
              <label className="label text-xs">Particulars of Device</label>
              <input {...register('customContent.certificateDetails.particularsOfDevice')} type="text" className="input text-xs" placeholder="Device details" />
            </div>
            <div>
              <label className="label text-xs">Particulars of Procedure</label>
              <input {...register('customContent.certificateDetails.particularsOfProcedure')} type="text" className="input text-xs" placeholder="Procedure details" />
            </div>
            <div>
              <label className="label text-xs">Signature of Person</label>
              <input {...register('customContent.certificateDetails.signatureOfPerson')} type="text" className="input text-xs" placeholder="Name of certifying person" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={() => { setActiveTab('list'); }} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isGenerating} className="btn-primary">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
          Generate Certificate
        </button>
      </div>
    </form>
  );
}

function VerifyForm({ onVerify, verifyInput, setVerifyInput, result, isLoading }: any) {
  return (
    <div className="max-w-2xl">
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-primary-800 mb-2">Verify BSA Certificate</h3>
        <p className="text-primary-700 text-sm">Enter a certificate number to verify its authenticity and validity under BSA Section 63.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onVerify(); }} className="space-y-4">
        <div>
          <label className="label">Certificate Number</label>
          <div className="relative">
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="BSA63/2024/CASEID/0001"
              className="input pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        <button type="submit" onClick={onVerify} disabled={isLoading || !verifyInput.trim()} className="btn-primary w-full">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
          Verify Certificate
        </button>
      </form>

      {result && (
        <div className={`mt-6 p-6 rounded-lg ${result.valid ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-danger-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.valid ? 'bg-success-100' : 'bg-danger-100'}`}>
              {result.valid ? <CheckCircle2 className="w-5 h-5 text-success-600" /> : <AlertCircle className="w-5 h-5 text-danger-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{result.valid ? 'Certificate Valid' : 'Certificate Invalid'}</h3>
              <p className="text-gray-600">{result.valid ? 'This certificate is valid and verified' : 'This certificate failed verification'}</p>
            </div>
          </div>

          {result.certificate && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Certificate Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <CertificateDetail label="Certificate Number" value={result.certificate.certificate_number} />
                <CertificateDetail label="Case ID" value={result.certificate.case_id} />
                <CertificateDetail label="Document ID" value={result.certificate.document_id} />
                <CertificateDetail label="Issued By" value={result.certificate.issued_by} />
                <CertificateDetail label="Issued At" value={new Date(result.certificate.issued_at).toLocaleString()} />
                <CertificateDetail label="Valid Until" value={result.certificate.valid_until ? new Date(result.certificate.valid_until).toLocaleDateString() : 'No expiry'} />
                <CertificateDetail label="Status" value={result.certificate.status} />
                <CertificateDetail label="Hash Algorithm" value={result.certificate.hash_algorithm} />
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Verification Details</h4>
            <div className="space-y-2 text-sm">
              {result.verificationDetails && Object.entries(result.verificationDetails).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center ${typeof value === 'boolean' && value ? 'bg-success-100' : 'bg-danger-100'}`}>
                    {typeof value === 'boolean' && value ? <CheckCircle2 className="w-4 h-4 text-success-600" /> : <AlertCircle className="w-4 h-4 text-danger-600" />}
                  </span>
                  <span className="capitalize text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                  <span className={typeof value === 'boolean' && value ? 'text-success-600' : 'text-danger-600'}>
                    {typeof value === 'boolean' ? (value ? 'Passed' : 'Failed') : String(value)}
                  </span>
                </div>
              ))}
              {result.verificationDetails?.details && result.verificationDetails.details.length > 0 && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <p className="font-medium text-gray-900 mb-1">Issues Found:</p>
                  <ul className="list-disc list-inside text-sm text-danger-600 space-y-1">
                    {result.verificationDetails.details.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CertificateDetailView({ certificateId }: { certificateId: string }) {
  // Placeholder for certificate detail view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => window.history.back()} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Certificate Detail</h1>
      </div>
      <p className="text-gray-500">Certificate detail view - implement based on verification result</p>
    </div>
  );
}

function CertificateDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'badge-gray', ISSUED: 'badge-green', VERIFIED: 'badge-blue',
    REVOKED: 'badge-red', EXPIRED: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}