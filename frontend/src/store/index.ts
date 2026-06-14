import { create } from 'zustand';
import type { User, Group, Expense, Message, SimplifiedBalance, UserBalanceSummary } from '../types';
import { authApi, groupsApi, expensesApi, balancesApi, settlementsApi, messagesApi } from '../api';

interface StoreState {
  // Auth state
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loadingAuth: boolean;
  errorAuth: string | null;

  // Groups state
  groups: Group[];
  currentGroup: Group | null;
  loadingGroups: boolean;
  errorGroups: string | null;

  // Expenses state
  expenses: Expense[];
  currentExpense: Expense | null;
  loadingExpenses: boolean;
  errorExpenses: string | null;

  // Messages state
  messages: Message[];

  // Balances & Settlements state
  userBalanceSummary: UserBalanceSummary | null;
  groupBalances: SimplifiedBalance[];
  loadingBalances: boolean;
  errorBalances: string | null;

  // Auth Actions
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // Groups Actions
  fetchGroups: () => Promise<void>;
  fetchGroupDetails: (groupId: string) => Promise<void>;
  createGroup: (name: string, description?: string, avatarUrl?: string) => Promise<Group>;
  addMember: (groupId: string, email: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Expenses Actions
  fetchExpenses: (groupId: string) => Promise<void>;
  fetchExpenseDetails: (expenseId: string) => Promise<void>;
  createExpense: (groupId: string, data: {
    title: string;
    totalAmount: number;
    paidBy: string;
    splitType: 'equal' | 'unequal' | 'percentage' | 'share';
    date: string;
    category?: string;
    participants: string[];
    rawValues?: Record<string, number>;
  }) => Promise<void>;
  updateExpense: (expenseId: string, data: {
    title: string;
    totalAmount: number;
    paidBy: string;
    splitType: 'equal' | 'unequal' | 'percentage' | 'share';
    date: string;
    category?: string;
    participants: string[];
    rawValues?: Record<string, number>;
  }) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  // Messages Actions
  fetchMessages: (expenseId: string) => Promise<void>;
  addLocalMessage: (message: Message) => void;

  // Balances & Settlements Actions
  fetchBalances: (groupId: string) => Promise<void>;
  fetchUserBalanceSummary: () => Promise<void>;
  recordSettlement: (groupId: string, data: { paidTo: string; amount: number; note?: string }) => Promise<void>;
  createRazorpayOrder: (groupId: string, amount: number) => Promise<any>;
  verifyRazorpayPayment: (
    groupId: string,
    data: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      paidTo: string;
      amount: number;
      note?: string;
    }
  ) => Promise<void>;

  // Layout Actions
  isSidebarOpen: boolean;
  toggleSidebar: (open?: boolean) => void;
}


export const useStore = create<StoreState>((set, get) => ({
  // Initial states
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loadingAuth: false,
  errorAuth: null,

  groups: [],
  currentGroup: null,
  loadingGroups: false,
  errorGroups: null,

  expenses: [],
  currentExpense: null,
  loadingExpenses: false,
  errorExpenses: null,

  messages: [],

  userBalanceSummary: null,
  groupBalances: [],
  loadingBalances: false,
  errorBalances: null,

  isSidebarOpen: false,
  toggleSidebar: (open) => set((state) => ({
    isSidebarOpen: open !== undefined ? open : !state.isSidebarOpen
  })),

  // Auth Actions implementation
  login: async (email, password) => {
    set({ loadingAuth: true, errorAuth: null });
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem('token', data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        loadingAuth: false,
      });
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorAuth: err.response?.data?.error || 'Login failed',
        loadingAuth: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ loadingAuth: true, errorAuth: null });
    try {
      const data = await authApi.register({ name, email, password });
      localStorage.setItem('token', data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        loadingAuth: false,
      });
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorAuth: err.response?.data?.error || 'Registration failed',
        loadingAuth: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      groups: [],
      currentGroup: null,
      expenses: [],
      currentExpense: null,
      messages: [],
      userBalanceSummary: null,
      groupBalances: [],
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    set({ loadingAuth: true, errorAuth: null });
    try {
      const user = await authApi.getMe();
      set({
        user,
        isAuthenticated: true,
        loadingAuth: false,
      });
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      localStorage.removeItem('token');
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        loadingAuth: false,
      });
    }
  },

  // Groups Actions implementation
  fetchGroups: async () => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      const groups = await groupsApi.list();
      set({ groups, loadingGroups: false });
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to fetch groups',
        loadingGroups: false,
      });
    }
  },

  fetchGroupDetails: async (groupId) => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      const currentGroup = await groupsApi.get(groupId);
      set({ currentGroup, loadingGroups: false });
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to fetch group details',
        loadingGroups: false,
      });
    }
  },

  createGroup: async (name, description, avatarUrl) => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      const newGroup = await groupsApi.create({ name, description, avatarUrl });
      set((state) => ({
        groups: [newGroup, ...state.groups],
        loadingGroups: false,
      }));
      return newGroup;
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to create group',
        loadingGroups: false,
      });
      throw err;
    }
  },

  addMember: async (groupId, email) => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      await groupsApi.addMember(groupId, email);
      await get().fetchGroupDetails(groupId);
      await get().fetchBalances(groupId);
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to add member',
        loadingGroups: false,
      });
      throw err;
    }
  },

  removeMember: async (groupId, userId) => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      await groupsApi.removeMember(groupId, userId);
      await get().fetchGroupDetails(groupId);
      await get().fetchBalances(groupId);
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to remove member',
        loadingGroups: false,
      });
      throw err;
    }
  },

  deleteGroup: async (groupId) => {
    set({ loadingGroups: true, errorGroups: null });
    try {
      await groupsApi.delete(groupId);
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        currentGroup: null,
        loadingGroups: false,
      }));
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorGroups: err.response?.data?.error || 'Failed to delete group',
        loadingGroups: false,
      });
      throw err;
    }
  },

  // Expenses Actions implementation
  fetchExpenses: async (groupId) => {
    set({ loadingExpenses: true, errorExpenses: null });
    try {
      const expenses = await expensesApi.list(groupId);
      set({ expenses, loadingExpenses: false });
    } catch (err: any) {
      set({
        errorExpenses: err.response?.data?.error || 'Failed to fetch expenses',
        loadingExpenses: false,
      });
    }
  },

  fetchExpenseDetails: async (expenseId) => {
    set({ loadingExpenses: true, errorExpenses: null });
    try {
      const currentExpense = await expensesApi.get(expenseId);
      set({ currentExpense, loadingExpenses: false });
    } catch (err: any) {
      set({
        errorExpenses: err.response?.data?.error || 'Failed to fetch expense details',
        loadingExpenses: false,
      });
    }
  },

  createExpense: async (groupId, data) => {
    set({ loadingExpenses: true, errorExpenses: null });
    try {
      await expensesApi.create(groupId, data);
      await get().fetchExpenses(groupId);
      await get().fetchBalances(groupId);
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorExpenses: err.response?.data?.error || 'Failed to create expense',
        loadingExpenses: false,
      });
      throw err;
    }
  },

  updateExpense: async (expenseId, data) => {
    set({ loadingExpenses: true, errorExpenses: null });
    try {
      const updated = await expensesApi.update(expenseId, data);
      set((state) => ({
        currentExpense: state.currentExpense?.id === expenseId ? updated : state.currentExpense,
        loadingExpenses: false,
      }));
      if (get().currentGroup?.id) {
        await get().fetchExpenses(get().currentGroup!.id);
        await get().fetchBalances(get().currentGroup!.id);
      }
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorExpenses: err.response?.data?.error || 'Failed to update expense',
        loadingExpenses: false,
      });
      throw err;
    }
  },

  deleteExpense: async (expenseId) => {
    set({ loadingExpenses: true, errorExpenses: null });
    try {
      await expensesApi.delete(expenseId);
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== expenseId),
        currentExpense: null,
        loadingExpenses: false,
      }));
      if (get().currentGroup?.id) {
        await get().fetchBalances(get().currentGroup!.id);
      }
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorExpenses: err.response?.data?.error || 'Failed to delete expense',
        loadingExpenses: false,
      });
      throw err;
    }
  },

  // Messages Actions implementation
  fetchMessages: async (expenseId) => {
    try {
      const messages = await messagesApi.list(expenseId);
      set({ messages });
    } catch (err: any) {
      console.error('Failed to fetch messages', err);
    }
  },

  addLocalMessage: (message) => {
    set((state) => {
      // Check if message already exists
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  // Balances & Settlements Actions implementation
  fetchBalances: async (groupId) => {
    set({ loadingBalances: true, errorBalances: null });
    try {
      const groupBalances = await balancesApi.getGroup(groupId);
      set({ groupBalances, loadingBalances: false });
    } catch (err: any) {
      set({
        errorBalances: err.response?.data?.error || 'Failed to fetch balances',
        loadingBalances: false,
      });
    }
  },

  fetchUserBalanceSummary: async () => {
    try {
      const userBalanceSummary = await balancesApi.getUser();
      set({ userBalanceSummary });
    } catch (err: any) {
      console.error('Failed to fetch user balance summary', err);
    }
  },

  recordSettlement: async (groupId, data) => {
    set({ loadingBalances: true, errorBalances: null });
    try {
      await settlementsApi.record(groupId, data);
      await get().fetchBalances(groupId);
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorBalances: err.response?.data?.error || 'Failed to record settlement',
        loadingBalances: false,
      });
      throw err;
    }
  },

  createRazorpayOrder: async (groupId, amount) => {
    set({ loadingBalances: true, errorBalances: null });
    try {
      const orderData = await settlementsApi.createOrder(groupId, amount);
      set({ loadingBalances: false });
      return orderData;
    } catch (err: any) {
      set({
        errorBalances: err.response?.data?.error || 'Failed to create payment order',
        loadingBalances: false,
      });
      throw err;
    }
  },

  verifyRazorpayPayment: async (groupId, data) => {
    set({ loadingBalances: true, errorBalances: null });
    try {
      await settlementsApi.verifyPayment(groupId, data);
      await get().fetchBalances(groupId);
      get().fetchUserBalanceSummary();
    } catch (err: any) {
      set({
        errorBalances: err.response?.data?.error || 'Payment signature verification failed',
        loadingBalances: false,
      });
      throw err;
    }
  },
}));
