import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_SETTINGS,
  generateSampleTransactions,
} from '../data/defaults';
import type {
  Category,
  FamilyMember,
  FamilySettings,
  FinanceState,
  Transaction,
} from '../types/finance';

const STORAGE_KEY = 'tikgop_family_finance_v2';
const LEGACY_STORAGE_KEY = 'tikgop_family_finance_v1';

interface UndoToastState {
  message: string;
  deletedTx?: Transaction;
}

interface FinanceContextValue {
  state: FinanceState;
  activeMember: FamilyMember;
  resolvedTheme: 'light' | 'dark';
  toast: UndoToastState | null;
  dismissToast: () => void;
  undoDelete: () => void;
  setActiveMember: (memberId: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (cat: Omit<Category, 'id' | 'isCustom'>) => void;
  updateCategoryBudget: (id: string, budget: number | undefined) => void;
  deleteCategory: (id: string) => void;
  addMember: (member: Omit<FamilyMember, 'id'>) => void;
  deleteMember: (id: string) => void;
  updateSettings: (updates: Partial<FamilySettings>) => void;
  exportJSON: () => string;
  exportCSV: () => string;
  importJSON: (raw: string) => { ok: boolean; error?: string };
  loadSampleData: () => void;
  clearAllTransactions: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function loadInitialState(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FinanceState>;
      if (parsed && Array.isArray(parsed.transactions)) {
        const members =
          Array.isArray(parsed.members) && parsed.members.length > 0
            ? parsed.members
            : DEFAULT_MEMBERS;
        const mergedSettings: FamilySettings = {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
        };
        if (!members.some((m) => m.id === mergedSettings.activeMemberId)) {
          mergedSettings.activeMemberId = members[0].id;
        }
        return {
          version: 2,
          transactions: parsed.transactions,
          categories:
            Array.isArray(parsed.categories) && parsed.categories.length > 0
              ? parsed.categories
              : DEFAULT_CATEGORIES,
          members,
          settings: mergedSettings,
          hasSampleData: Boolean(parsed.hasSampleData),
        };
      }
    }
    // Clean up legacy v1 sample key if present
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Fallback to clean initial state if storage is corrupted or blocked
  }

  return {
    version: 2,
    transactions: generateSampleTransactions(),
    categories: DEFAULT_CATEGORIES,
    members: DEFAULT_MEMBERS,
    settings: DEFAULT_SETTINGS,
    hasSampleData: true,
  };
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<FinanceState>(loadInitialState);
  const [toast, setToast] = useState<UndoToastState | null>(null);
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  // Persist to localStorage immediately on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors gracefully
    }
  }, [state]);

  // Listen to OS theme preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    state.settings.theme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : state.settings.theme;

  // Apply theme class to document root & update PWA theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolvedTheme === 'dark' ? '#0b0e14' : '#10b981');
    }
  }, [resolvedTheme]);

  // Auto-dismiss toast after 4.5s
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dismissToast = useCallback(() => setToast(null), []);

  const addTransaction = useCallback((input: Omit<Transaction, 'id' | 'createdAt'>) => {
    const created: Transaction = {
      ...input,
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      transactions: [created, ...prev.transactions],
    }));
    setToast({
      message: input.type === 'expense' ? 'Đã ghi nhận khoản chi mới' : 'Đã ghi nhận khoản thu mới',
    });
    return created;
  }, []);

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx,
        ),
      }));
      setToast({ message: 'Đã cập nhật giao dịch' });
    },
    [],
  );

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.transactions.find((t) => t.id === id);
      if (target) {
        setToast({ message: 'Đã xóa giao dịch', deletedTx: target });
      }
      return {
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      };
    });
  }, []);

  const undoDelete = useCallback(() => {
    setToast((current) => {
      if (current?.deletedTx) {
        const restored = current.deletedTx;
        setState((prev) => ({
          ...prev,
          transactions: [restored, ...prev.transactions],
        }));
      }
      return null;
    });
  }, []);

  const addCategory = useCallback((cat: Omit<Category, 'id' | 'isCustom'>) => {
    const newCat: Category = {
      ...cat,
      id: `cat_${Date.now()}`,
      isCustom: true,
    };
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    setToast({ message: `Đã thêm danh mục "${cat.name}"` });
  }, []);

  const updateCategoryBudget = useCallback((id: string, budget: number | undefined) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, budget } : c)),
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
    setToast({ message: 'Đã xóa danh mục tùy chỉnh' });
  }, []);

  const addMember = useCallback((member: Omit<FamilyMember, 'id'>) => {
    const created: FamilyMember = {
      ...member,
      id: `mem_${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      members: [...prev.members, created],
    }));
    setToast({ message: `Đã thêm thành viên "${member.name}"` });
  }, []);

  const activeMember = useMemo(() => {
    return (
      state.members.find((m) => m.id === state.settings.activeMemberId) ||
      state.members[0] ||
      DEFAULT_MEMBERS[0]
    );
  }, [state.members, state.settings.activeMemberId]);

  const setActiveMember = useCallback((memberId: string) => {
    setState((prev) => {
      const target = prev.members.find((m) => m.id === memberId);
      if (!target) return prev;
      setToast({ message: `Đang xem với tư cách ${target.name} • Xem toàn bộ chi tiêu gia đình` });
      return {
        ...prev,
        settings: { ...prev.settings, activeMemberId: memberId },
      };
    });
  }, []);

  const deleteMember = useCallback((id: string) => {
    setState((prev) => {
      if (prev.members.length <= 1) return prev;
      const remaining = prev.members.filter((m) => m.id !== id);
      const fallbackId = remaining[0].id;
      const nextActive =
        prev.settings.activeMemberId === id ? fallbackId : prev.settings.activeMemberId;
      return {
        ...prev,
        members: remaining,
        settings: { ...prev.settings, activeMemberId: nextActive },
        transactions: prev.transactions.map((tx) =>
          tx.memberId === id ? { ...tx, memberId: fallbackId } : tx,
        ),
      };
    });
    setToast({ message: 'Đã xóa thành viên' });
  }, []);

  const updateSettings = useCallback((updates: Partial<FamilySettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  const exportJSON = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const exportCSV = useCallback(() => {
    const catMap = new Map(state.categories.map((c) => [c.id, c.name]));
    const memMap = new Map(state.members.map((m) => [m.id, m.name]));
    const payMap: Record<string, string> = {
      bank: 'Chuyển khoản',
      cash: 'Tiền mặt',
      ewallet: 'Ví điện tử',
      card: 'Thẻ tín dụng',
    };
    const header = ['Ngày', 'Giờ', 'Loại', 'Danh mục', 'Số tiền (VND)', 'Thành viên', 'Thanh toán', 'Ghi chú'];
    const rows = [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((tx) => [
        tx.date,
        tx.time,
        tx.type === 'expense' ? 'Chi tiêu' : 'Thu nhập',
        catMap.get(tx.categoryId) || tx.categoryId,
        tx.type === 'expense' ? -tx.amount : tx.amount,
        memMap.get(tx.memberId) || tx.memberId,
        payMap[tx.paymentMethod] || tx.paymentMethod,
        `"${(tx.note || '').replace(/"/g, '""')}"`,
      ]);
    return '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }, [state]);

  const importJSON = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<FinanceState>;
      if (!parsed || !Array.isArray(parsed.transactions)) {
        return { ok: false, error: 'Tệp sao lưu không đúng định dạng TíchGóp.' };
      }
      setState({
        version: 1,
        transactions: parsed.transactions,
        categories:
          Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_CATEGORIES,
        members:
          Array.isArray(parsed.members) && parsed.members.length > 0
            ? parsed.members
            : DEFAULT_MEMBERS,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        hasSampleData: false,
      });
      setToast({ message: `Đã khôi phục ${parsed.transactions.length} giao dịch` });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể đọc tệp JSON. Vui lòng kiểm tra lại.' };
    }
  }, []);

  const loadSampleData = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transactions: generateSampleTransactions(),
      hasSampleData: true,
    }));
    setToast({ message: 'Đã nạp bộ dữ liệu mẫu chi tiêu gia đình' });
  }, []);

  const clearAllTransactions = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transactions: [],
      hasSampleData: false,
    }));
    setToast({ message: 'Đã xóa toàn bộ giao dịch — sẵn sàng ghi chép mới!' });
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      activeMember,
      resolvedTheme,
      toast,
      dismissToast,
      undoDelete,
      setActiveMember,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategoryBudget,
      deleteCategory,
      addMember,
      deleteMember,
      updateSettings,
      exportJSON,
      exportCSV,
      importJSON,
      loadSampleData,
      clearAllTransactions,
    }),
    [
      state,
      activeMember,
      resolvedTheme,
      toast,
      dismissToast,
      undoDelete,
      setActiveMember,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategoryBudget,
      deleteCategory,
      addMember,
      deleteMember,
      updateSettings,
      exportJSON,
      exportCSV,
      importJSON,
      loadSampleData,
      clearAllTransactions,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
