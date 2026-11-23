import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_SETTINGS,
  generateSampleTransactions,
} from '../data/defaults';
import {
  clearAllReceiptImages,
  deleteReceiptImage,
  saveReceiptImage,
} from '../utils/receiptStorage';
import type {
  Category,
  FamilyMember,
  FamilySettings,
  FinanceState,
  Transaction,
} from '../types/finance';

const STORAGE_KEY = 'tikgop_family_finance_v2';
const LEGACY_STORAGE_KEY = 'tikgop_family_finance_v1';
const DEVICE_MEMBER_KEY = 'tikgop_device_member_id';

interface UndoToastState {
  message: string;
  deletedTx?: Transaction;
}

interface FinanceContextValue {
  state: FinanceState;
  activeMember: FamilyMember;
  hasSelectedDeviceMember: boolean;
  resolvedTheme: 'light' | 'dark';
  toast: UndoToastState | null;
  dismissToast: () => void;
  undoDelete: () => void;
  setActiveMember: (memberId: string, silent?: boolean) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  addTransactionsBatch: (txs: Array<Omit<Transaction, 'id' | 'createdAt'>>) => Transaction[];
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

function migrateCategoriesAndTransactions(
  parsed: Partial<FinanceState>,
  members: FamilyMember[],
  mergedSettings: FamilySettings,
): FinanceState {
  const storedCats =
    Array.isArray(parsed.categories) && parsed.categories.length > 0
      ? parsed.categories
      : DEFAULT_CATEGORIES;

  // Migrate v2 -> v3: replace default 'housing' -> 'invest_expense' and 'pets' -> 'business_expense'
  const investDefault = DEFAULT_CATEGORIES.find((c) => c.id === 'invest_expense')!;
  const businessDefault = DEFAULT_CATEGORIES.find((c) => c.id === 'business_expense')!;

  const migratedCats: Category[] = [];
  for (const cat of storedCats) {
    if (cat.id === 'housing' && !cat.isCustom) {
      if (!storedCats.some((c) => c.id === 'invest_expense')) {
        migratedCats.push(investDefault);
      }
      continue;
    }
    if (cat.id === 'pets' && !cat.isCustom) {
      if (!storedCats.some((c) => c.id === 'business_expense')) {
        migratedCats.push(businessDefault);
      }
      continue;
    }
    migratedCats.push(cat);
  }
  if (!migratedCats.some((c) => c.id === 'invest_expense')) {
    migratedCats.splice(3, 0, investDefault);
  }
  if (!migratedCats.some((c) => c.id === 'business_expense')) {
    const otherIdx = migratedCats.findIndex((c) => c.id === 'other_expense');
    migratedCats.splice(otherIdx >= 0 ? otherIdx : migratedCats.length, 0, businessDefault);
  }

  // Migrate v3 -> v4: clear pre-loaded sample/test history once so family starts completely clean
  const isPreV4 = (parsed.version || 0) < 4;
  const migratedTxs = isPreV4
    ? []
    : (parsed.transactions || []).map((tx) => {
        if (tx.categoryId === 'housing') return { ...tx, categoryId: 'invest_expense' };
        if (tx.categoryId === 'pets') return { ...tx, categoryId: 'business_expense' };
        return tx;
      });

  return {
    version: 4,
    transactions: migratedTxs,
    categories: migratedCats,
    members,
    settings: mergedSettings,
    hasSampleData: isPreV4 ? false : Boolean(parsed.hasSampleData),
  };
}

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
        return migrateCategoriesAndTransactions(parsed, members, mergedSettings);
      }
    }
    // Clean up legacy v1 sample key if present
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Fallback to clean initial state if storage is corrupted or blocked
  }

  return {
    version: 4,
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    members: DEFAULT_MEMBERS,
    settings: DEFAULT_SETTINGS,
    hasSampleData: false,
  };
}

function getSavedDeviceMemberId(): string | null {
  try {
    return localStorage.getItem(DEVICE_MEMBER_KEY);
  } catch {
    return null;
  }
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<FinanceState>(() => {
    const base = loadInitialState();
    const deviceMemberId = getSavedDeviceMemberId();
    if (deviceMemberId && base.members.some((m) => m.id === deviceMemberId)) {
      return {
        ...base,
        settings: { ...base.settings, activeMemberId: deviceMemberId },
      };
    }
    return base;
  });
  const [hasSelectedDeviceMember, setHasSelectedDeviceMember] = useState<boolean>(() => {
    const deviceId = getSavedDeviceMemberId();
    return Boolean(deviceId);
  });
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

  // Auto-dismiss toast after 4.5s (and clean up orphaned receipt image if delete wasn't undone)
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      if (toast.deletedTx?.receiptImage) {
        void deleteReceiptImage(toast.deletedTx.receiptImage);
      }
      setToast(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Sync changes automatically when TíchGóp is open across multiple browser tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setState(loadInitialState());
      } else if (e.key === DEVICE_MEMBER_KEY && e.newValue) {
        setHasSelectedDeviceMember(true);
        setState((prev) =>
          prev.members.some((m) => m.id === e.newValue)
            ? { ...prev, settings: { ...prev.settings, activeMemberId: e.newValue! } }
            : prev,
        );
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dismissToast = useCallback(() => {
    setToast((current) => {
      if (current?.deletedTx?.receiptImage) {
        void deleteReceiptImage(current.deletedTx.receiptImage);
      }
      return null;
    });
  }, []);

  // One-time mount migration for any legacy inline base64 receipt images into IndexedDB
  useEffect(() => {
    const legacyWithBase64 = state.transactions.filter(
      (tx) => tx.receiptImage && tx.receiptImage.startsWith('data:image/'),
    );
    if (legacyWithBase64.length === 0) return;

    let cancelled = false;
    void (async () => {
      const updates = new Map<string, string>();
      for (const tx of legacyWithBase64) {
        if (!tx.receiptImage) continue;
        const ref = await saveReceiptImage(tx.receiptImage);
        if (ref !== tx.receiptImage) updates.set(tx.id, ref);
      }
      if (!cancelled && updates.size > 0) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.map((tx) =>
            updates.has(tx.id) ? { ...tx, receiptImage: updates.get(tx.id) } : tx,
          ),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const addTransactionsBatch = useCallback(
    (inputs: Array<Omit<Transaction, 'id' | 'createdAt'>>) => {
      const baseTs = Date.now();
      const createdList: Transaction[] = inputs.map((input, idx) => ({
        ...input,
        id: `tx_${baseTs}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: baseTs + (inputs.length - idx),
      }));
      setState((prev) => ({
        ...prev,
        transactions: [...createdList, ...prev.transactions],
      }));
      setToast({
        message:
          createdList.length === 1
            ? createdList[0].type === 'expense'
              ? 'Đã ghi nhận khoản chi mới'
              : 'Đã ghi nhận khoản thu mới'
            : `Đã ghi nhận nhanh ${createdList.length} giao dịch mới`,
      });
      return createdList;
    },
    [],
  );

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

  const setActiveMember = useCallback((memberId: string, silent = false) => {
    try {
      localStorage.setItem(DEVICE_MEMBER_KEY, memberId);
    } catch {
      // Ignore storage quota errors
    }
    setHasSelectedDeviceMember(true);
    setState((prev) => {
      const target = prev.members.find((m) => m.id === memberId);
      if (!target) return prev;
      if (!silent) {
        setToast({ message: `Đã ghi nhớ thiết bị cho ${target.name}` });
      }
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
    const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [
      'Ngày',
      'Giờ',
      'Loại',
      'Danh mục',
      'Số tiền (VND)',
      'Thành viên',
      'Thanh toán',
      'Ghi chú',
    ].map(csvCell);
    const rows = [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((tx) => [
        csvCell(tx.date),
        csvCell(tx.time),
        csvCell(tx.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'),
        csvCell(catMap.get(tx.categoryId) || tx.categoryId),
        tx.type === 'expense' ? -tx.amount : tx.amount,
        csvCell(memMap.get(tx.memberId) || tx.memberId),
        csvCell(payMap[tx.paymentMethod] || tx.paymentMethod),
        csvCell(tx.note || ''),
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
    void clearAllReceiptImages();
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
      hasSelectedDeviceMember,
      resolvedTheme,
      toast,
      dismissToast,
      undoDelete,
      setActiveMember,
      addTransaction,
      addTransactionsBatch,
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
      hasSelectedDeviceMember,
      resolvedTheme,
      toast,
      dismissToast,
      undoDelete,
      setActiveMember,
      addTransaction,
      addTransactionsBatch,
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
