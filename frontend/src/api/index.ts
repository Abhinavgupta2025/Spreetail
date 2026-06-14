import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthorized access
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect if unauthorized
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== Auth API ====================
export const authApi = {
  register: async (data: { name: string; email: string; password?: string; avatarUrl?: string }) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  login: async (data: { email: string; password?: string }) => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// ==================== Groups API ====================
export const groupsApi = {
  list: async () => {
    const res = await api.get('/groups');
    return res.data;
  },
  create: async (data: { name: string; description?: string; avatarUrl?: string }) => {
    const res = await api.post('/groups', data);
    return res.data;
  },
  get: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}`);
    return res.data;
  },
  update: async (groupId: string, data: { name?: string; description?: string; avatarUrl?: string }) => {
    const res = await api.patch(`/groups/${groupId}`, data);
    return res.data;
  },
  delete: async (groupId: string) => {
    const res = await api.delete(`/groups/${groupId}`);
    return res.data;
  },
  addMember: async (groupId: string, email: string) => {
    const res = await api.post(`/groups/${groupId}/members`, { email });
    return res.data;
  },
  removeMember: async (groupId: string, userId: string) => {
    const res = await api.delete(`/groups/${groupId}/members/${userId}`);
    return res.data;
  },
};

// ==================== Expenses API ====================
export const expensesApi = {
  list: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/expenses`);
    return res.data;
  },
  create: async (groupId: string, data: {
    title: string;
    totalAmount: number;
    paidBy: string;
    splitType: 'equal' | 'unequal' | 'percentage' | 'share';
    date: string;
    category?: string;
    participants: string[];
    rawValues?: Record<string, number>;
  }) => {
    const res = await api.post(`/groups/${groupId}/expenses`, data);
    return res.data;
  },
  get: async (expenseId: string) => {
    const res = await api.get(`/expenses/${expenseId}`);
    return res.data;
  },
  update: async (expenseId: string, data: {
    title: string;
    totalAmount: number;
    paidBy: string;
    splitType: 'equal' | 'unequal' | 'percentage' | 'share';
    date: string;
    category?: string;
    participants: string[];
    rawValues?: Record<string, number>;
  }) => {
    const res = await api.patch(`/expenses/${expenseId}`, data);
    return res.data;
  },
  delete: async (expenseId: string) => {
    const res = await api.delete(`/expenses/${expenseId}`);
    return res.data;
  },
};

// ==================== Balances API ====================
export const balancesApi = {
  getGroup: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/balances`);
    return res.data;
  },
  getUser: async () => {
    const res = await api.get('/users/me/balances');
    return res.data;
  },
};

// ==================== Settlements API ====================
export const settlementsApi = {
  record: async (groupId: string, data: { paidTo: string; amount: number; note?: string }) => {
    const res = await api.post(`/groups/${groupId}/settlements`, data);
    return res.data;
  },
  list: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/settlements`);
    return res.data;
  },
  createOrder: async (groupId: string, amount: number) => {
    const res = await api.post(`/groups/${groupId}/settlements/razorpay-order`, { amount });
    return res.data;
  },
  verifyPayment: async (
    groupId: string,
    data: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      paidTo: string;
      amount: number;
      note?: string;
    }
  ) => {
    const res = await api.post(`/groups/${groupId}/settlements/razorpay-verify`, data);
    return res.data;
  },
};


// ==================== Messages (Chat) API ====================
export const messagesApi = {
  list: async (expenseId: string) => {
    const res = await api.get(`/expenses/${expenseId}/messages`);
    return res.data;
  },
  post: async (expenseId: string, content: string) => {
    const res = await api.post(`/expenses/${expenseId}/messages`, { content });
    return res.data;
  },
};

// ==================== Import API ====================
export const importApi = {
  getPreview: async (groupId: string, csvText: string) => {
    const res = await api.post(`/groups/${groupId}/import-csv/preview`, { csvText });
    return res.data;
  },
  commit: async (groupId: string, rows: any[]) => {
    const res = await api.post(`/groups/${groupId}/import-csv/commit`, { rows });
    return res.data;
  },
};
