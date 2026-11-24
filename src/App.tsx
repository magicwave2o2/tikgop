import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
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
import { TransactionModal } from './components/TransactionModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { FinanceProvider, useFinance } from './store/useFinanceStore';
import type { AppTab, Transaction, TransactionDraft } from './types/finance';
import { OverviewView } from './views/OverviewView';

// Lazy-load secondary views & heavy camera/voice modals for blazing fast initial FCP
const HistoryView = lazy(() =>
  import('./views/HistoryView').then((m) => ({ default: m.HistoryView })),
);
const AnalyticsView = lazy(() =>
  import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const ReceiptScannerModal = lazy(() =>
  import('./components/ReceiptScannerModal').then((m) => ({ default: m.ReceiptScannerModal })),
);
const VoiceInputModal = lazy(() =>
  import('./components/VoiceInputModal').then((m) => ({ default: m.VoiceInputModal })),
);

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'history', label: 'Lịch sử', icon: CalendarClock },
  { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
  { id: 'settings', label: 'Gia đình', icon: Settings2 },
];

const ViewFallback: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-12 w-56 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
    <div className="h-44 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="h-48 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
      <div className="h-48 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
    </div>
  </div>
);

const AppShell: React.FC = () => {
  const {
    state,
    activeMember,
    hasSelectedDeviceMember,
    resolvedTheme,
    updateSettings,
    toast,
    dismissToast,
    undoDelete,
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

  // Listen for new PWA version ready event
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

  const openQuickAdd = (dateKey?: string) => {
    setEditingTx(null);
    setDraftTx(null);
    setDefaultAddDate(dateKey);
    setModalOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setDraftTx(null);
    setDefaultAddDate(undefined);
    setModalOpen(true);
  };

  const openDraftInModal = (draft: TransactionDraft) => {
    setEditingTx(null);
    setDraftTx(draft);
    setDefaultAddDate(draft.date);
    setModalOpen(true);
  };

  const handleNavigateTab = (tab: AppTab, categoryFilter?: string) => {
    if (categoryFilter) setPendingCategoryFilter(categoryFilter);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleQuickTheme = () => {
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
  };

  // First-time visit on this device: ask which family member is using the device once
  if (!hasSelectedDeviceMember) {
    return <MemberOnboarding />;
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white dark:bg-[#0c111b]/95 dark:backdrop-blur-xl border-r border-slate-200/70 dark:border-white/[0.07] px-4 py-6 z-30">
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
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openQuickAdd()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-500 dark:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20 cursor-pointer"
          >
            <Plus size={19} strokeWidth={2.5} />
            <span>Ghi chi tiêu mới</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] rounded-md bg-white/20 font-semibold">
              N
            </kbd>
          </motion.button>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setReceiptOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-emerald-500/12 border border-transparent dark:border-emerald-400/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <ScanLine size={15} />
              <span>Quét bill</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setVoiceOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-violet-500/12 border border-transparent dark:border-violet-400/20 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-colors cursor-pointer"
            >
              <Mic size={15} />
              <span>Giọng nói</span>
            </motion.button>
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
                className={`relative w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-colors cursor-pointer ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="desktopNavIndicator"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-emerald-500/12 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-400/25 -z-10"
                  />
                )}
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
        {/* Mobile Top Sticky Header — Pure Minimalist */}
        <header className="lg:hidden sticky top-0 z-20 pt-safe bg-[#f5f7fb]/85 dark:bg-[#070a10]/82 backdrop-blur-xl dark:border-b dark:border-white/[0.05]">
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
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => void promptInstall()}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold shadow-sm shadow-emerald-500/25 cursor-pointer"
                  aria-label="Cài đặt PWA"
                >
                  <Download size={14} />
                  <span>Cài app</span>
                </motion.button>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={toggleQuickTheme}
                className="p-2 rounded-xl bg-white dark:bg-[#101520] border border-slate-200/70 dark:border-white/[0.09] text-slate-600 dark:text-amber-300 cursor-pointer"
                aria-label="Đổi giao diện sáng tối"
              >
                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </motion.button>
            </div>
          </div>
        </header>

        {/* Active View Stage */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 lg:pt-6 pb-28 lg:pb-12">
          {/* Non-intrusive PWA New Version Update Pill */}
          <AnimatePresence>
            {swUpdateHandler && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/25"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Suspense fallback={<ViewFallback />}>
                {activeTab === 'overview' && (
                  <OverviewView
                    onEditTransaction={openEditTx}
                    onNavigateTab={handleNavigateTab}
                    onQuickAdd={() => openQuickAdd()}
                    onOpenReceiptScan={() => setReceiptOpen(true)}
                    onOpenVoiceInput={() => setVoiceOpen(true)}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryView
                    initialCategoryFilter={pendingCategoryFilter}
                    onClearInitialCategory={() => setPendingCategoryFilter(null)}
                    onEditTransaction={openEditTx}
                    onQuickAddForDate={(dateKey) => openQuickAdd(dateKey)}
                  />
                )}
                {activeTab === 'analytics' && (
                  <AnalyticsView
                    onSelectCategoryInHistory={(catId) => handleNavigateTab('history', catId)}
                  />
                )}
                {activeTab === 'settings' && <SettingsView />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Creative Floating Frosted-Glass Bottom Dock */}
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
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors cursor-pointer ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <motion.div
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                </motion.div>
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}

          <div className="flex justify-center">
            <motion.button
              type="button"
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => openQuickAdd()}
              aria-label="Thêm giao dịch mới"
              className="-mt-6 w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 dark:shadow-[0_10px_28px_-4px_rgba(16,185,129,0.5)] ring-4 ring-[#f5f7fb] dark:ring-[#070a10] cursor-pointer"
            >
              <Plus size={26} strokeWidth={2.6} />
            </motion.button>
          </div>

          {NAV_ITEMS.slice(2, 4).map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors cursor-pointer ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <motion.div
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                </motion.div>
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Modals (Scanner & Voice lazy-loaded only when opened) */}
      <TransactionModal
        open={modalOpen}
        editingTx={editingTx}
        draft={draftTx}
        defaultDate={defaultAddDate}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
          setDraftTx(null);
        }}
        onOpenReceiptScan={() => setReceiptOpen(true)}
        onOpenVoiceInput={() => setVoiceOpen(true)}
      />

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

      {/* Floating Undo / Feedback Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-[#161f30] text-white dark:text-slate-100 dark:border dark:border-white/12 shadow-2xl text-xs font-bold max-w-[92vw]"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <FinanceProvider>
        <AppShell />
      </FinanceProvider>
    </MotionConfig>
  );
}

export default App;
