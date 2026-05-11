// src/lib/api.ts — Strict mode. No demo-token bypass.
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor — handle 401 by attempting token refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = 'Bearer ' + token;
          return api(original);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = res.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(original);
      } catch (err) {
        processQueue(err, null);
        // Refresh failed — clear stored token.
        // DO NOT force-redirect here; let the dashboard layout's auth
        // guard handle navigation so we avoid race-condition logouts.
        localStorage.removeItem('accessToken');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
