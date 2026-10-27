import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Safe production default: mock mode is strictly disabled unless explicitly enabled via VITE_USE_MOCK_API='true'
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

// Production Axios client for FastAPI backend integration
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 120000,
});

apiClient.interceptors.request.use(
  (config) => {
    // Inject auth token when backend provides JWT token
    const token = localStorage.getItem('niyantran_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('niyantran_token');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    const customError = {
      message: error.response?.data?.detail || error.message || 'API request failed',
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);

// Simulated delay helper for Mock API
export const simulateDelay = (ms = 300) =>
  new Promise((resolve) => setTimeout(resolve, ms));
