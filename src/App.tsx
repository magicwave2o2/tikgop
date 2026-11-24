import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Download,
  Home,
  Mic,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Settings2,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import { DynamicIcon } from './components/IconRenderer';
import { MemberOnboarding } from './components/MemberOnboarding';
import { usePWAInstall } from './hooks/usePWAInstall';
import { FinanceProvider, useFinance, useToast } from './store/useFinanceStore';
import type { AppTab, Transaction, TransactionDraft } from './types/finance';
import { OverviewView } from './views/OverviewView';

// Lazy-load secondary views & modals; preloaded quietly after first paint so iOS tab/modal taps are instant
const loadHistoryView = () =>
  import('./views/HistoryView').then((m) => ({ default: m.HistoryView }));
const loadAnalyticsView = () =>
  import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView }));
const loadSettingsView = () =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }));
const loadTransactionModal = () =>
  import('./components/TransactionModal').then((m) => ({ default: m.TransactionModal }));
const loadReceiptModal = () =>
  import('./components/ReceiptScannerModal').then((m) => ({ default: m.ReceiptScannerModal }));
const loadVoiceModal = () =>
  import('./components/VoiceInputModal').then((m) => ({ default: m.VoiceInputModal }));

const HistoryView = lazy(loadHistoryView);
const AnalyticsView = lazy(loadAnalyticsView);
const SettingsView = lazy(loadSettingsView);
const TransactionModal = lazy(loadTransactionModal);
const ReceiptScannerModal = lazy(loadReceiptModal);
const VoiceInputModal = lazy(loadVoiceModal);

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'history', label: 'Lịch sử', icon: CalendarClock },
  { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
  { id: 'settings', label: 'Gia đình', icon: Settings2 },
];

const ViewFallback: React.FC = () => (
  <div className="space-y-4">
    <div className="h-10 w-44 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]" />
    <div className="h-44 rounded-3xl bg-slate-200/60 dark:bg-white/[0.05]" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="h-44 rounded-3xl bg-slate-200/60 dark:bg-white/[0.05]" />
      <div className="h-44 rounded-3xl bg-slate-200/60 dark:bg-white/[0.05]" />
    </div>
  </div>
);

/** Isolated leaf component so toast show/hide NEVER re-renders AppShell or active views */
const ToastBanner: React.FC = () => {
  const { toast, dismissToast, undoDelete } = useToast();
  if (!toast) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-[#161f30] text-white dark:text-slate-100 dark:border dark:border-white/12 shadow-2xl text-xs font-bold max-w-[92vw] animate-ios-toast">
      <span>{toast.message}</span>
      {toast.deletedTx && (
        <button
          type="button"
          onClick={undoDelete}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Hoàn tác</span>
        </button>
      )}
      <button
        type="button"
        onClick={dismissToast}
        className="opacity-60 hover:opacity-100 cursor-pointer"
        aria-label="Đóng thông báo"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const AppShell: React.FC = () => {
  const {
    state,
    activeMember,
    hasSelectedDeviceMember,
    resolvedTheme,
    updateSettings,
  } = useFinance();
  const { canInstall, isOnline, promptInstall } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'history' || t === 'analytics' || t === 'settings') return t;
    return 'overview';
  });

  const [modalOpen, setModalOpen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action') === 'add';
  });
  const [receiptOpen, setReceiptOpen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action') === 'scan';
  });
  const [voiceOpen, setVoiceOpen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action') === 'voice';
  });

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [draftTx, setDraftTx] = useState<TransactionDraft | null>(null);
  const [defaultAddDate, setDefaultAddDate] = useState<string | undefined>(undefined);
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState<string | null>(null);
  const [swUpdateHandler, setSwUpdateHandler] = useState<(() => void) | null>(null);

  // Quietly warm up secondary chunks after first paint so iOS tab & modal switches have 0ms chunk stutter
  useEffect(() => {
    if (!hasSelectedDeviceMember) return;
    const timer = window.setTimeout(() => {
      void loadTransactionModal();
      void loadHistoryView();
      void loadAnalyticsView();
      void loadSettingsView();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [hasSelectedDeviceMember]);

  useEffect(() => {
    const onSwUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ applyUpdate?: () => void }>).detail;
      if (detail?.applyUpdate) {
        setSwUpdateHandler(() => detail.applyUpdate!);
      }
    };
    window.addEventListener('tikgop:sw-update', onSwUpdate);
    return () => window.removeEventListener('tikgop:sw-update', onSwUpdate);
  }, []);

  // Desktop keyboard shortcut: press 'n' outside inputs to quick-add
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'n' && !modalOpen && !receiptOpen && !voiceOpen) {
        e.preventDefault();
        setEditingTx(null);
        setDraftTx(null);
        setDefaultAddDate(undefined);
        setModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, receiptOpen, voiceOpen]);

  const openQuickAdd = useCallback((dateKey?: string) => {
    setEditingTx(null);
    setDraftTx(null);
    setDefaultAddDate(dateKey);
    setModalOpen(true);
  }, []);

  const openEditTx = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setDraftTx(null);
    setDefaultAddDate(undefined);
    setModalOpen(true);
  }, []);

  const openDraftInModal = useCallback((draft: TransactionDraft) => {
    setEditingTx(null);
    setDraftTx(draft);
    setDefaultAddDate(draft.date);
    setModalOpen(true);
  }, []);

  const handleNavigateTab = useCallback((tab: AppTab, categoryFilter?: string) => {
    if (categoryFilter) setPendingCategoryFilter(categoryFilter);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleOpenReceipt = useCallback(() => setReceiptOpen(true), []);
  const handleOpenVoice = useCallback(() => setVoiceOpen(true), []);
  const handleClearPendingCategory = useCallback(() => setPendingCategoryFilter(null), []);
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingTx(null);
    setDraftTx(null);
  }, []);

  const toggleQuickTheme = useCallback(() => {
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
  }, [resolvedTheme, updateSettings]);

  if (!hasSelectedDeviceMember) {
    return <MemberOnboarding />;
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white dark:bg-[#0c111b]/95 border-r border-slate-200/70 dark:border-white/[0.07] px-4 py-6 z-30">
        <div className="flex items-center gap-3 px-2 mb-6">
          <img
            src="/logo.png"
            alt="TíchGóp"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 dark:border-white/15 dark:ring-1 dark:ring-white/10 object-cover shadow-md shadow-emerald-500/15 dark:shadow-emerald-500/20"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              TíchGóp
            </h1>
            <p className="text-[11px] font-medium text-slate-400 truncate mt-1">
              {state.settings.familyName}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-500 dark:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20 active:scale-[0.97] transition-transform duration-100 cursor-pointer"
          >
            <Plus size={19} strokeWidth={2.5} />
            <span>Ghi chi tiêu mới</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] rounded-md bg-white/20 font-semibold">
              N
            </kbd>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenReceipt}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-emerald-500/12 border border-transparent dark:border-emerald-400/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
            >
              <ScanLine size={15} />
              <span>Quét bill</span>
            </button>

            <button
              type="button"
              onClick={handleOpenVoice}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-violet-500/12 border border-transparent dark:border-violet-400/20 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
            >
              <Mic size={15} />
              <span>Giọng nói</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500/12 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-400/25 text-emerald-700 dark:text-emerald-300'
                    : 'border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] space-y-2">
          <button
            type="button"
            onClick={() => handleNavigateTab('settings')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: activeMember.color }}
            >
              <DynamicIcon name={activeMember.icon} size={15} />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                {activeMember.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{activeMember.role}</div>
            </div>
          </button>

          {canInstall && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold cursor-pointer"
            >
              <Download size={14} />
              <span>Cài PWA lên máy</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleQuickTheme}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <span>Chế độ {resolvedTheme === 'dark' ? 'tối' : 'sáng'}</span>
            {resolvedTheme === 'dark' ? (
              <Moon size={15} className="text-emerald-400" />
            ) : (
              <Sun size={15} className="text-amber-500" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 lg:pl-64 flex flex-col min-h-dvh">
        {/* Mobile Top Sticky Header — Lightweight 10px glass promoted on GPU */}
        <header className="lg:hidden sticky top-0 z-20 pt-safe bg-[#f5f7fb]/92 dark:bg-[#070a10]/90 ios-header-glass dark:border-b dark:border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.png"
                alt="TíchGóp"
                className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 dark:border-white/15 object-cover shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    TíchGóp
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: activeMember.color }}
                  >
                    {activeMember.name}
                  </span>
                  {!isOnline && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                      <WifiOff size={10} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {canInstall && (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold shadow-sm shadow-emerald-500/25 active:scale-95 transition-transform duration-100 cursor-pointer"
                  aria-label="Cài đặt PWA"
                >
                  <Download size={14} />
                  <span>Cài app</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleQuickTheme}
                className="p-2 rounded-xl bg-white dark:bg-[#101520] border border-slate-200/70 dark:border-white/[0.09] text-slate-600 dark:text-amber-300 active:scale-90 transition-transform duration-100 cursor-pointer"
                aria-label="Đổi giao diện sáng tối"
              >
                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </header>

        {/* Active View Stage — Instant native-feel iOS tab switch (zero 400ms AnimatePresence wait) */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 lg:pt-6 pb-28 lg:pb-12">
          {swUpdateHandler && (
            <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 animate-ios-fade">
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={14} />
                <span>Đã có phiên bản TíchGóp mới!</span>
              </span>
              <button
                type="button"
                onClick={swUpdateHandler}
                className="px-3 py-1 rounded-xl bg-white text-emerald-700 font-extrabold cursor-pointer"
              >
                Cập nhật ngay
              </button>
            </div>
          )}

          <Suspense fallback={<ViewFallback />}>
            {activeTab === 'overview' && (
              <OverviewView
                onEditTransaction={openEditTx}
                onNavigateTab={handleNavigateTab}
                onQuickAdd={openQuickAdd}
                onOpenReceiptScan={handleOpenReceipt}
                onOpenVoiceInput={handleOpenVoice}
              />
            )}
            {activeTab === 'history' && (
              <HistoryView
                initialCategoryFilter={pendingCategoryFilter}
                onClearInitialCategory={handleClearPendingCategory}
                onEditTransaction={openEditTx}
                onQuickAddForDate={openQuickAdd}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsView
                onSelectCategoryInHistory={(catId) => handleNavigateTab('history', catId)}
              />
            )}
            {activeTab === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Creative Floating Frosted-Glass Bottom Dock — GPU promoted */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none px-3 pb-safe">
        <nav className="pointer-events-auto max-w-md mx-auto floating-dock rounded-[1.75rem] px-1.5 h-[62px] grid grid-cols-5 items-center">
          {NAV_ITEMS.slice(0, 2).map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl active:scale-90 transition-transform duration-100 focus:outline-none cursor-pointer ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`}
                />
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openQuickAdd()}
              aria-label="Thêm giao dịch mới"
              className="-mt-6 w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 dark:shadow-[0_10px_28px_-4px_rgba(16,185,129,0.5)] ring-4 ring-[#f5f7fb] dark:ring-[#070a10] active:scale-90 transition-transform duration-100 cursor-pointer"
            >
              <Plus size={26} strokeWidth={2.6} />
            </button>
          </div>

          {NAV_ITEMS.slice(2, 4).map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl active:scale-90 transition-transform duration-100 focus:outline-none cursor-pointer ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`}
                />
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Modals mounted ONLY when open (0 background CPU & 0 eager bundle bloat on cold start!) */}
      {modalOpen && (
        <Suspense fallback={null}>
          <TransactionModal
            open={modalOpen}
            editingTx={editingTx}
            draft={draftTx}
            defaultDate={defaultAddDate}
            onClose={handleCloseModal}
            onOpenReceiptScan={handleOpenReceipt}
            onOpenVoiceInput={handleOpenVoice}
          />
        </Suspense>
      )}

      {receiptOpen && (
        <Suspense fallback={null}>
          <ReceiptScannerModal
            open={receiptOpen}
            onClose={() => setReceiptOpen(false)}
            onEditDraft={openDraftInModal}
          />
        </Suspense>
      )}

      {voiceOpen && (
        <Suspense fallback={null}>
          <VoiceInputModal
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            onEditDraft={openDraftInModal}
          />
        </Suspense>
      )}

      <ToastBanner />
    </div>
  );
};

export function App() {
  return (
    <FinanceProvider>
      <AppShell />
    </FinanceProvider>
  );
}

export default App;
