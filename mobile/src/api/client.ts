import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
client.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging
client.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error(`[API Response Error] ${error.response?.status} ${error.config?.url}`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    sendOtp: (phone: string) => client.post('/auth/send-otp', { phone }),
    verifyOtp: (phone: string, token: string) => client.post('/auth/verify-otp', { phone, token }),
  },
  policies: {
    getPlans: () => client.get('/policies/plans'),
  },
};

export default client;
