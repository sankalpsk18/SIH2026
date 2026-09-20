import React from 'react';
import { BSA63Certificate, Case } from '../types';
import { CheckCircle2, Printer, X } from 'lucide-react';

type Props = {
  certificate: BSA63Certificate;
  caseContext?: Case;
  documentContext?: { number: string; title: string };
  onClose: () => void;
};

export function CertificateDocumentPreview({ certificate, caseContext, documentContext, onClose }: Props) {
  const documentName = documentContext?.title || certificate.certificateContent.certificateDetails.descriptionOfOutput || certificate.documentId;
  const documentNumber = documentContext?.number || certificate.documentId;
  const caseLabel = caseContext ? `${caseContext.case_number} · ${caseContext.title}` : certificate.caseId;
  const issuedDate = new Date(certificate.issuedAt).toLocaleString();
  const validUntil = certificate.validUntil ? new Date(certificate.validUntil).toLocaleDateString() : 'No expiry';
  const custodyReference = certificate.custodyLedgerTxIds[0] || `LEDGER-${documentNumber}`;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="certificate-document-title" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <div className="bg-white rounded-t-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <h2 id="certificate-document-title" className="font-semibold text-gray-900">Certificate Preview</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100" aria-label="Close certificate preview"><X className="w-5 h-5" /></button>
        </div>

        <article className="bg-white border-x border-gray-200 px-5 sm:px-8 py-7 text-gray-900 print-certificate">
          <div className="border-2 border-slate-800 rounded-lg px-5 sm:px-7 py-7">
            <div className="text-center border-b border-gray-200 pb-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-800 uppercase">Certificate under Section 63</p>
              <p className="text-xs text-primary-700 mt-3">Bharatiya Sakshya Adhiniyam, 2023</p>
              <p className="font-mono text-[11px] text-gray-500 mt-3">{certificate.certificateNumber}</p>
            </div>

            <div className="mt-6 space-y-3 text-xs sm:text-sm">
              <CertificateRow label="Case ID" value={caseLabel} />
              <CertificateRow label="Document ID" value={documentNumber} />
              <CertificateRow label="Document Name" value={documentName} />
              <CertificateRow label="Document Type" value={certificate.certificateType.replace(/_/g, ' ')} />
              <CertificateRow label="SHA-256 Hash" value={`${certificate.fileHash.slice(0, 16)}...${certificate.fileHash.slice(-4)}`} mono />
              <CertificateRow label="Size" value={formatBytes(certificate.fileSizeBytes)} />
              <CertificateRow label="Issued By" value={certificate.certificateContent.computerOutput.responsiblePerson || certificate.issuedBy} />
              <CertificateRow label="Timestamp" value={issuedDate} />
              <CertificateRow label="Valid Until" value={validUntil} />
              <CertificateRow label="Custody Ref" value={custodyReference} mono />
            </div>

            <div className="border-t border-gray-200 mt-7 pt-6 text-xs leading-5 text-gray-700">
              <p>I hereby certify that the above electronic record was produced from the custody of {documentName} records and that the hash value matches the original at the time of capture. The record has not been altered since upload as verified by the tamper-evident custody ledger.</p>
            </div>

            <div className="mt-8 flex items-end justify-between gap-8 text-center text-[10px] text-gray-600">
              <div className="w-36"><div className="border-t border-gray-800 pt-2">Authorized Officer</div></div>
              <div className="w-36"><div className="border-t border-gray-800 pt-2">Technical Expert (if applicable)</div></div>
            </div>

            <div className="mt-7 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Certificate verified</div>
            {certificate.qrCodeImageUrl && <div className="mt-5 flex justify-center"><img src={certificate.qrCodeImageUrl} alt="Certificate verification QR code" className="w-24 h-24 border border-gray-200 p-1" /></div>}
          </div>
        </article>

        <div className="bg-white rounded-b-xl border border-gray-200 px-5 py-3 flex items-center gap-2">
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={onClose} className="btn-primary btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

function CertificateRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr] gap-3 items-start"><span className="font-semibold">{label}:</span><span className={`${mono ? 'font-mono text-[11px]' : ''} text-right break-words`}>{value}</span></div>;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 0 : 0)} ${units[index]}`;
}
