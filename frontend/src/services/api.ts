// ============================================================================
// ADALAT360 - API Service
// Axios instance with interceptors for auth
// ============================================================================

import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Get auth tokens from localStorage directly to avoid React context issues
const getAccessToken = (): string | null => {
  try {
    const auth = localStorage.getItem('adalat360-auth');
    if (auth) {
      const parsed = JSON.parse(auth);
      return parsed.state?.accessToken || null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
};

const getRefreshToken = (): string | null => {
  try {
    const auth = localStorage.getItem('adalat360-auth');
    if (auth) {
      const parsed = JSON.parse(auth);
      return parsed.state?.refreshToken || null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
};

const setTokens = (accessToken: string, refreshToken: string): void => {
  try {
    const auth = localStorage.getItem('adalat360-auth');
    if (auth) {
      const parsed = JSON.parse(auth);
      parsed.state = {
        ...parsed.state,
        accessToken,
        refreshToken,
        isAuthenticated: true,
      };
      localStorage.setItem('adalat360-auth', JSON.stringify(parsed));
    }
  } catch {
    // Ignore parsing errors
  }
};

const clearAuth = (): void => {
  localStorage.removeItem('adalat360-auth');
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add request ID for tracing
    config.headers['X-Request-ID'] = createRequestId();
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          setTokens(access_token, refresh_token);

          // Retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Auth
export const authApi = {
  login: (data: { email: string; password: string; totp_code?: string; backup_code?: string }) =>
    api.post('/auth/login', data),

  mfaVerify: (mfaToken: string, data: { code: string; type: 'totp' | 'backup' }) =>
    api.post('/auth/mfa/verify', data, { headers: { 'X-MFA-Token': mfaToken } }),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),

  logout: (accessToken?: string, refreshToken?: string) =>
    api.post('/auth/logout', {}, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }),

  getProfile: () => api.get('/auth/me'),

  updateProfile: (data: { full_name?: string; phone?: string; designation?: string }) =>
    api.patch('/auth/me', data),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/change-password', data),

  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: { token: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/reset-password', data),

  // MFA
  setupMfa: () => api.post('/auth/mfa/setup'),
  enableMfa: (code: string) => api.post('/auth/mfa/enable', { verification_code: code }),
  disableMfa: (password: string) => api.post('/auth/mfa/disable', { password }),
  regenerateBackupCodes: (password: string) => api.post('/auth/mfa/backup-codes', { password }),
  trustDevice: (deviceName: string) => api.post('/auth/device/trust', { device_name: deviceName }),

  // Sessions
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
  revokeAllSessions: () => api.delete('/auth/sessions'),

  // Admin
  createUser: (data: any) => api.post('/admin/users', data),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  updateUserRole: (userId: string, role: string) => api.patch(`/admin/users/${userId}/role`, { role }),
  resetUserPassword: (userId: string, newPassword: string) => api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword }),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
};

// Cases
export const casesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get('/cases', { params }),

  get: (caseId: string) => api.get(`/cases/${caseId}`),

  create: (data: {
    case_number: string;
    fir_number?: string;
    title: string;
    description?: string;
    priority?: string;
    police_station?: string;
    district?: string;
    state?: string;
    jurisdiction_court?: string;
    ipc_sections?: string[];
    bns_sections?: string[];
    special_acts?: string[];
    incident_date?: string;
    fir_registered_at?: string;
  }) => api.post('/cases', data),

  update: (caseId: string, data: any) => api.patch(`/cases/${caseId}`, data),

  delete: (caseId: string) => api.delete(`/cases/${caseId}`),

  getStats: (caseId: string) => api.get(`/cases/${caseId}/stats`),

  // Assignments
  getAssignments: (caseId: string) => api.get(`/cases/${caseId}/assignments`),
  assignUser: (caseId: string, data: { user_id: string; role_in_case: string; permission_level: string[] }) =>
    api.post(`/cases/${caseId}/assignments`, data),
  revokeAssignment: (caseId: string, userId: string, role: string) =>
    api.delete(`/cases/${caseId}/assignments/${userId}/${role}`),
};

// Documents
export const documentsApi = {
  listByCase: (caseId: string, params?: {
    page?: number;
    limit?: number;
    documentType?: string;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get(`/documents/case/${caseId}`, { params }),

  get: (documentId: string) => api.get(`/documents/${documentId}`),

  upload: (file: File, data: {
    caseId: string;
    title: string;
    description?: string;
    documentType: string;
    tags?: string[];
    ocrLanguage?: string;
  }) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
      }
    });
    return api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (documentId: string, data: any) => api.patch(`/documents/${documentId}`, data),

  createVersion: (documentId: string, file: File, changesSummary: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('changesSummary', changesSummary);
    return api.post(`/documents/${documentId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getVersions: (documentId: string) => api.get(`/documents/${documentId}/versions`),

  download: (documentId: string) => api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  }),

  export: (data: {
    documentIds: string[];
    format: 'pdf' | 'zip' | 'original';
    watermark?: boolean;
    watermarkText?: string;
    password?: string;
  }) => api.post('/documents/export', data),

  delete: (documentId: string) => api.delete(`/documents/${documentId}`),
};

// Evidence
export const evidenceApi = {
  listByCase: (caseId: string, params?: {
    page?: number;
    limit?: number;
    evidenceType?: string;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get(`/evidence/case/${caseId}`, { params }),

  get: (evidenceId: string) => api.get(`/evidence/${evidenceId}`),

  create: (data: {
    caseId: string;
    name: string;
    description?: string;
    evidenceType: string;
    category?: string;
    sub_category?: string;
    seized_at: string;
    seized_by: string;
    seized_location?: any;
    seized_from?: string;
    panchnama_reference?: string;
    seizure_memo_number?: string;
    current_location?: string;
    storage_condition?: string;
    container_seal_number?: string;
    weight_grams?: number;
    dimensions_cm?: any;
    photographs?: string[];
  }) => api.post('/evidence', data),

  update: (evidenceId: string, data: any) => api.patch(`/evidence/${evidenceId}`, data),

  delete: (evidenceId: string) => api.delete(`/evidence/${evidenceId}`),

  // Custody
  transfer: (evidenceId: string, data: {
    to_user_id: string;
    from_user_id?: string;
    from_location?: string;
    to_location?: string;
    action?: string;
    seal_number?: string;
    seal_intact?: boolean;
    condition_notes?: string;
    witness_user_id?: string;
  }) => api.post(`/evidence/${evidenceId}/transfer`, data),

  getCustodyChain: (evidenceId: string) => api.get(`/evidence/${evidenceId}/custody-chain`),

  // Lab
  sendToLab: (evidenceId: string, data: { forensic_lab_id: string; analysis_type?: string }) =>
    api.post(`/evidence/${evidenceId}/send-to-lab`, data),

  submitLabResult: (evidenceId: string, data: {
    analysis_completed_at: string;
    analysis_report_document_id?: string;
    analysis_results?: any;
  }) => api.post(`/evidence/${evidenceId}/lab-result`, data),

  // Court
  courtSubmission: (evidenceId: string, data: { court_exhibit_number?: string }) =>
    api.post(`/evidence/${evidenceId}/court-submission`, data),

  // Disposal
  dispose: (evidenceId: string, data: {
    disposal_method: string;
    disposed_by: string;
    disposal_witness?: string;
  }) => api.post(`/evidence/${evidenceId}/dispose`, data),

  // QR Code
  getQrCode: (evidenceId: string) => api.get(`/evidence/${evidenceId}/qr-code`),
};

// Search
export const searchApi = {
  search: (data: {
    query: string;
    caseId?: string;
    documentTypes?: string[];
    evidenceTypes?: string[];
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    authorIds?: string[];
    entities?: { persons?: string[]; organizations?: string[]; locations?: string[] };
    page: number;
    limit: number;
    semanticSearch?: boolean;
    highlight?: boolean;
  }) => api.post('/search', data),

  suggestions: (q: string, caseId?: string) =>
    api.get('/search/suggestions', { params: { q, caseId } }),

  reindexCase: (caseId: string) => api.post(`/search/reindex/${caseId}`),
};

// Blockchain
export const blockchainApi = {
  getEvents: (params?: {
    caseId?: string;
    documentId?: string;
    evidenceId?: string;
    actorUserId?: string;
    txType?: string;
    consensusStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get('/blockchain/events', { params }),

  getEvent: (txId: string) => api.get(`/blockchain/events/${txId}`),

  getBlock: (blockNumber: number) => api.get(`/blockchain/blocks/${blockNumber}`),

  getLatestBlock: () => api.get('/blockchain/blocks/latest'),

  verifyChain: (startBlock: number, endBlock?: number) =>
    api.post('/blockchain/verify-chain', { startBlock, endBlock }),

  verifyFullChain: () => api.post('/blockchain/verify-full-chain'),

  getOrganizations: () => api.get('/blockchain/organizations'),

  initLedger: () => api.post('/blockchain/init-ledger'),
};

// BSA Certificates
export const bsaApi = {
  generate: (data: {
    caseId: string;
    documentId: string;
    section?: string;
    certificateType?: string;
    validUntil?: string;
    customContent?: any;
  }) => api.post('/bsa/generate', data),

  verify: (certificateNumber: string) =>
    api.get('/bsa/verify', { params: { certificateNumber } }),

  get: (certificateId: string) => api.get(`/bsa/${certificateId}`),

  listByCase: (caseId: string) => api.get(`/bsa/case/${caseId}`),

  listByDocument: (documentId: string) => api.get(`/bsa/document/${documentId}`),

  revoke: (certificateId: string, reason: string) =>
    api.post(`/bsa/${certificateId}/revoke`, { reason }),

  downloadPdf: (certificateId: string) => api.get(`/bsa/${certificateId}/pdf`),
};

// Audit
export const auditApi = {
  query: (params?: {
    user_id?: string;
    event_type?: string;
    event_category?: string;
    resource_type?: string;
    resource_id?: string;
    action?: string;
    outcome?: string;
    severity?: string;
    start_date?: string;
    end_date?: string;
    correlation_id?: string;
    page?: number;
    limit?: number;
  }) => api.get('/audit', { params }),

  getEvent: (eventId: string) => api.get(`/audit/events/${eventId}`),

  getUserTrail: (userId: string, limit?: number) => api.get(`/audit/user/${userId}`, { params: { limit } }),

  getResourceTrail: (resourceType: string, resourceId: string, limit?: number) =>
    api.get(`/audit/resource/${resourceType}/${resourceId}`, { params: { limit } }),

  complianceReport: (data: {
    start_date: string;
    end_date: string;
    user_ids?: string[];
    event_categories?: string[];
    severities?: string[];
  }) => api.post('/audit/compliance-report', data),

  export: (params: {
    start_date: string;
    end_date: string;
    format?: 'json' | 'csv';
    user_id?: string;
    event_type?: string;
    resource_type?: string;
    outcome?: string;
  }) => api.get('/audit/export', { params, responseType: 'blob' }),

  getRtiTrail: (requestNumber: string) => api.get(`/audit/rti/${requestNumber}`),

  cleanup: (retentionDays?: number) => api.post('/audit/cleanup', { retentionDays }),
};

// Admin
export const adminApi = {
  getConfig: () => api.get('/admin/config'),
  getConfigByKey: (key: string) => api.get(`/admin/config/${key}`),
  setConfig: (data: { config_key: string; config_value: any; description?: string; is_sensitive?: boolean }) =>
    api.post('/admin/config', data),

  getBlockchainNodes: () => api.get('/admin/blockchain/nodes'),
  addBlockchainNode: (data: any) => api.post('/admin/blockchain/nodes', data),

  getStats: () => api.get('/admin/stats'),
};

// RTI
export const rtiApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    assigned_to?: string;
    search?: string;
  }) => api.get('/rti', { params }),

  get: (rtiId: string) => api.get(`/rti/${rtiId}`),

  getByNumber: (requestNumber: string) => api.get(`/rti/number/${requestNumber}`),

  create: (data: {
    applicant_name: string;
    applicant_address?: string;
    applicant_email?: string;
    applicant_phone?: string;
    subject: string;
    description?: string;
    information_sought: string;
    case_ids?: string[];
    document_ids?: string[];
    evidence_ids?: string[];
  }) => api.post('/rti', data),

  update: (rtiId: string, data: any) => api.patch(`/rti/${rtiId}`, data),

  respond: (rtiId: string, data: { response_text: string; response_documents?: string[] }) =>
    api.post(`/rti/${rtiId}/respond`, data),

  deny: (rtiId: string, data: { denied_reasons: string[]; exemption_sections?: string[] }) =>
    api.post(`/rti/${rtiId}/deny`, data),

  appeal: (rtiId: string, data: { appeal_level: 'FIRST' | 'SECOND'; appeal_details?: any }) =>
    api.post(`/rti/${rtiId}/appeal`, data),

  assign: (rtiId: string, assigned_to: string) => api.post(`/rti/${rtiId}/assign`, { assigned_to }),
};

// Timeline
export const timelineApi = {
  get: (caseId: string, params?: {
    startDate?: string;
    endDate?: string;
    eventTypes?: string[];
    actorIds?: string[];
    resourceIds?: string[];
    includeBlockchain?: boolean;
    page?: number;
    limit?: number;
  }) => api.get(`/timeline/case/${caseId}`, { params }),

  export: (caseId: string, params?: {
    format?: 'json' | 'csv';
    startDate?: string;
    endDate?: string;
  }) => api.get(`/timeline/case/${caseId}/export`, { params, responseType: 'blob' }),

  analytics: (caseId: string) => api.get(`/timeline/case/${caseId}/analytics`),
};

// Entity Graph
export const entityGraphApi = {
  getGraph: (caseId: string, params?: {
    entityTypes?: string[];
    minWeight?: number;
    maxDepth?: number;
    includeDocuments?: boolean;
    includeEvidence?: boolean;
  }) => api.get(`/entity-graph/case/${caseId}`, { params }),

  findPath: (caseId: string, source: string, target: string) =>
    api.get(`/entity-graph/case/${caseId}/path`, { params: { source, target } }),

  getCentralEntities: (caseId: string, topN?: number) =>
    api.get(`/entity-graph/case/${caseId}/central`, { params: { topN } }),

  getCommunities: (caseId: string) =>
    api.get(`/entity-graph/case/${caseId}/communities`),
};

// ============================================================================
// ERROR HANDLING HELPER
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: any;
  request_id: string;
  timestamp: string;
}

export function isApiError(error: any): error is AxiosError<ApiErrorResponse> {
  return axios.isAxiosError(error);
}

export function getErrorMessage(error: any): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    return error.response.data.message || error.message;
  }
  return error.message || 'An unknown error occurred';
}