import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileCheck, Loader2, Scale, ShieldCheck } from 'lucide-react';
import { bsaApi } from '../services/api';
import { BSA63Certificate } from '../types';

type VerificationResult = {
  valid: boolean;
  certificate?: BSA63Certificate;
  verificationDetails?: {
    hashVerified: boolean;
    chainVerified: boolean;
    signatureVerified: boolean;
    notExpired: boolean;
    notRevoked: boolean;
    details: string[];
  };
};

export function CertificateVerificationPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const certificateNumber = searchParams.get('certificateNumber') || decodeURIComponent(location.pathname.replace(/^\/verify\/?/, ''));
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!certificateNumber) {
      setError('No certificate number was provided.');
      return;
    }
    bsaApi.verify(certificateNumber)
      .then(response => setResult(response.data))
      .catch(() => setError('This certificate could not be verified. Check the certificate number and try again.'));
  }, [certificateNumber]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center"><Scale className="w-5 h-5 text-white" /></div><div><p className="font-bold text-gray-900">ADALAT360</p><p className="text-xs text-gray-500">Public certificate verification</p></div></div>
        {error && <div className="card p-8 text-center"><AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" /><h1 className="text-xl font-bold text-gray-900">Verification unavailable</h1><p className="text-gray-600 mt-2">{error}</p><Link to="/bsa" className="btn-primary mt-6">Open certificate center</Link></div>}
        {!error && !result && <div className="card p-12 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto" /><p className="text-gray-600 mt-4">Verifying certificate...</p></div>}
        {result && <div className="card overflow-hidden"><div className={`p-6 ${result.valid ? 'bg-emerald-700' : 'bg-red-700'} text-white`}><div className="flex items-center gap-3">{result.valid ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}<div><p className="text-sm uppercase tracking-wider text-white/80">Bharatiya Sakshya Adhiniyam</p><h1 className="text-2xl font-bold">{result.valid ? 'Certificate verified' : 'Certificate not verified'}</h1></div></div></div><div className="p-6 sm:p-8 space-y-6"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5"><div><p className="text-xs uppercase tracking-wider text-gray-500">Certificate number</p><p className="font-mono text-lg font-bold text-gray-900 mt-1">{result.certificate?.certificateNumber || certificateNumber}</p><p className="text-gray-600 mt-3">Section {result.certificate?.section || '63'} electronic record certificate</p></div>{result.certificate?.qrCodeImageUrl && <img src={result.certificate.qrCodeImageUrl} alt="Certificate QR code" className="w-28 h-28 border rounded-lg p-1" />}</div>{result.certificate && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><PublicItem label="Case reference" value={result.certificate.caseId} /><PublicItem label="Document reference" value={result.certificate.documentId} /><PublicItem label="Issued" value={new Date(result.certificate.issuedAt).toLocaleString()} /><PublicItem label="Valid until" value={result.certificate.validUntil ? new Date(result.certificate.validUntil).toLocaleDateString() : 'No expiry'} /><PublicItem label="Record type" value={result.certificate.certificateType.replace(/_/g, ' ')} /><PublicItem label="Status" value={result.certificate.status} /></div>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['Document hash', result.verificationDetails?.hashVerified], ['Custody chain', result.verificationDetails?.chainVerified], ['Digital signature', result.verificationDetails?.signatureVerified], ['Not revoked', result.verificationDetails?.notRevoked]].map(([label, passed]) => <div key={String(label)} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50"><ShieldCheck className={`w-4 h-4 ${passed ? 'text-emerald-600' : 'text-red-500'}`} /><span className="text-sm text-gray-700">{label}</span><span className={`ml-auto text-xs font-semibold ${passed ? 'text-emerald-700' : 'text-red-600'}`}>{passed ? 'Passed' : 'Failed'}</span></div>)}</div><div className="border-t border-gray-200 pt-5"><p className="text-xs uppercase tracking-wider text-gray-500">Document SHA-256</p><p className="font-mono text-xs break-all text-gray-700 mt-2">{result.certificate?.fileHash || 'Unavailable'}</p></div><div className="flex items-center gap-2 text-sm text-gray-500"><FileCheck className="w-4 h-4" /> Verified by ADALAT360 public verification service</div></div></div>}
      </div>
    </div>
  );
}

function PublicItem({ label, value }: { label: string; value: string }) { return <div className="p-3 rounded-lg border border-gray-200"><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 mt-1 break-all">{value}</p></div>; }
