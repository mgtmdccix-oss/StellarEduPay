import axios from 'axios';

const TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT_MS || '15000', 10);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'Missing NEXT_PUBLIC_API_URL. Define it in frontend/.env.local for local development or set it in the deployment environment.'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
});

export const getStudents = (page = 1, limit = 50) => api.get('/students', { params: { page, limit } });
export const getPaymentInstructions = (studentId) => api.get(`/payments/instructions/${studentId}`);
export const getStudentPayments = (studentId) => api.get(`/payments/${studentId}`);
export const verifyPayment = (txHash) => api.post('/payments/verify', { txHash });
export const syncPayments = () => api.post('/payments/sync');
export const getSyncStatus = () => api.get('/payments/sync/status');
export const getFeeStructures = () => api.get('/fees');
export const createFeeStructure = (data) => api.post('/fees', data);
export const getFeeByClass = (className) => api.get(`/fees/${className}`);

// Reports
export const getReport = (params = {}) => api.get('/reports', { params });
export const getReportCsvUrl = (params = {}) => {
  const query = new URLSearchParams({ ...params, format: 'csv' }).toString();
  return `${API_BASE_URL}/reports?${query}`;
};

// Currency conversion
export const getConversionRates = () => api.get('/payments/rates');

// Disputes
export const flagDispute    = (data) => api.post('/disputes', data);
export const getDisputes    = (params = {}) => api.get('/disputes', { params });
export const getDisputeById = (id) => api.get(`/disputes/${id}`);
export const resolveDispute = (id, data) => api.patch(`/disputes/${id}/resolve`, data);
