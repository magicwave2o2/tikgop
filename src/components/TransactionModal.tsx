import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Mic,
  Receipt,
  ScanLine,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { PAYMENT_METHODS } from '../data/defaults';
import { useFinance } from '../store/useFinanceStore';
import type {
  PaymentMethod,
  Transaction,
  TransactionDraft,
  TransactionType,
} from '../types/finance';
import { detectCategoryFromText } from '../utils/categoryClassifier';
import {
  addDays,
  formatCompactVND,
  formatRawAmount,
  getToday,
  pad2,
  parseRawAmount,
  toDateKey,
} from '../utils/format';
import { CategoryIconBadge, DynamicIcon, PaymentMethodIcon } from './IconRenderer';

interface TransactionModalProps {
  open: boolean;
  editingTx: Transaction | null;
  draft?: TransactionDraft | null;
  defaultDate?: string;
  onClose: () => void;
  onOpenReceiptScan?: () => void;
  onOpenVoiceInput?: () => void;
}

const LAST_PAYMENT_KEY = 'tikgop_last_payment_method';

const QUICK_AMOUNTS = [
  { label: '+20k', value: 20_000 },
  { label: '+50k', value: 50_000 },
  { label: '+100k', value: 100_000 },
  { label: '+200k', value: 200_000 },
  { label: '+500k', value: 500_000 },
  { label: '+1tr', value: 1_000_000 },
];

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function getLastPaymentMethod(): PaymentMethod {
  try {
    const saved = localStorage.getItem(LAST_PAYMENT_KEY) as PaymentMethod | null;
    if (saved === 'bank' || saved === 'cash' || saved === 'ewallet' || saved === 'card') {
      return saved;
    }
  } catch {
    // ignore storage error
  }
  return 'bank';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  open,
  editingTx,
  draft,
  defaultDate,
  onClose,
  onOpenReceiptScan,
  onOpenVoiceInput,
}) => {
  const { state, activeMember, addTransaction, updateTransaction, deleteTransaction } =
    useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [manualCategoryPicked, setManualCategoryPicked] = useState(false);
  const [autoMatchedHint, setAutoMatchedHint] = useState(false);
  const [memberId, setMemberId] = useState(activeMember.id);
  const [date, setDate] = useState(toDateKey(getToday()));
  const [time, setTime] = useState(getCurrentTimeStr());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(getLastPaymentMethod);
  const [note, setNote] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<'manual' | 'receipt' | 'voice'>('manual');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [error, setError] = useState('');

  const amountRef = useRef<HTMLInputElement>(null);

  const filteredCategories = state.categories.filter((c) => c.type === type);
  const selectedCategory =
    filteredCategories.find((c) => c.id === categoryId) || filteredCategories[0];
  const selectedMember = state.members.find((m) => m.id === memberId) || activeMember;

  useEffect(() => {
    if (!open) return;
    setError('');
    setZoomReceipt(false);
    setAutoMatchedHint(false);

    if (editingTx) {
      setType(editingTx.type);
      setAmountInput(formatRawAmount(String(editingTx.amount)));
      setCategoryId(editingTx.categoryId);
      setManualCategoryPicked(true);
      setMemberId(editingTx.memberId);
      setDate(editingTx.date);
      setTime(editingTx.time);
      setPaymentMethod(editingTx.paymentMethod);
      setNote(editingTx.note);
      setReceiptImage(editingTx.receiptImage);
      setSource(editingTx.source || 'manual');
      setShowMoreOptions(true);
    } else if (draft) {
      setType(draft.type || 'expense');
      setAmountInput(draft.amount ? formatRawAmount(String(draft.amount)) : '');
      setCategoryId(draft.categoryId || 'food');
      setManualCategoryPicked(Boolean(draft.categoryId));
      setMemberId(draft.memberId || activeMember.id);
      setDate(draft.date || defaultDate || toDateKey(getToday()));
      setTime(draft.time || getCurrentTimeStr());
      setPaymentMethod(draft.paymentMethod || getLastPaymentMethod());
      setNote(draft.note || '');
      setReceiptImage(draft.receiptImage);
      setSource(draft.source || 'manual');
      setShowMoreOptions(false);
    } else {
      setType('expense');
      setAmountInput('');
      setCategoryId('food');
      setManualCategoryPicked(false);
      setMemberId(activeMember.id);
      setDate(defaultDate || toDateKey(getToday()));
      setTime(getCurrentTimeStr());
      setPaymentMethod(getLastPaymentMethod());
      setNote('');
      setReceiptImage(undefined);
      setSource('manual');
      setShowMoreOptions(Boolean(defaultDate && defaultDate !== toDateKey(getToday())));
      // Focus amount input smoothly for zero-tap typing
      window.setTimeout(() => {
        amountRef.current?.focus();
      }, 120);
    }
  }, [open, editingTx, draft, defaultDate, activeMember.id]);

  // Keep category valid when switching Chi tiêu / Thu nhập
  useEffect(() => {
    const valid = state.categories.some((c) => c.id === categoryId && c.type === type);
    if (!valid) {
      const first = state.categories.find((c) => c.type === type);
      if (first) setCategoryId(first.id);
    }
  }, [type, categoryId, state.categories]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomReceipt) setZoomReceipt(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, zoomReceipt, onClose]);

  const handleNoteChange = (nextNote: string) => {
    setNote(nextNote);
    // Auto-detect matching category while typing quick note if user hasn't manually locked another category
    if (!manualCategoryPicked && nextNote.trim().length >= 2) {
      const detected = detectCategoryFromText(nextNote, type, state.categories);
      const fallback = type === 'income' ? 'other_income' : 'other_expense';
      if (detected !== fallback && detected !== categoryId) {
        setCategoryId(detected);
        setAutoMatchedHint(true);
      }
    }
  };

  const handleQuickAddAmount = (delta: number) => {
    const current = parseRawAmount(amountInput);
    setAmountInput(formatRawAmount(String(current + delta)));
    setError('');
  };

  const handleMultiplyThousand = () => {
    const current = parseRawAmount(amountInput);
    if (current > 0 && current < 1_000_000) {
      setAmountInput(formatRawAmount(String(current * 1000)));
      setError('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const numericAmount = parseRawAmount(amountInput);
    if (numericAmount <= 0) {
      setError('Vui lòng nhập số tiền lớn hơn 0');
      amountRef.current?.focus();
      return;
    }

    try {
      localStorage.setItem(LAST_PAYMENT_KEY, paymentMethod);
    } catch {
      // ignore storage error
    }

    const payload = {
      type,
      amount: numericAmount,
      categoryId: selectedCategory?.id || categoryId,
      memberId,
      date,
      time: time || getCurrentTimeStr(),
      paymentMethod,
      note: note.trim(),
      receiptImage,
      source,
    };

    if (editingTx) {
      updateTransaction(editingTx.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };

  const todayKey = toDateKey(getToday());
  const yesterdayKey = toDateKey(addDays(getToday(), -1));
  const numericPreview = parseRawAmount(amountInput);
  const dateBadgeLabel =
    date === todayKey
      ? 'Hôm nay'
      : date === yesterdayKey
        ? 'Hôm qua'
        : `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.85 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="relative z-10 w-full sm:max-w-lg max-h-[94dvh] flex flex-col bg-white dark:bg-[#141923] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden"
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Compact Top Header: Type Switcher + Quét bill / Nói / Close */}
            <div className="flex items-center justify-between px-3.5 sm:px-5 pt-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80 gap-1.5">
              {/* Inline Chi tiêu / Thu nhập segmented pill */}
              <div className="grid grid-cols-2 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 shrink-0">
                {(
                  [
                    { id: 'expense', label: 'Chi tiêu', icon: ArrowUpRight },
                    { id: 'income', label: 'Thu nhập', icon: ArrowDownLeft },
                  ] as const
                ).map((item) => {
                  const active = type === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`relative flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs font-extrabold whitespace-nowrap transition-colors z-10 cursor-pointer ${
                        active
                          ? item.id === 'expense'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="txTypePill"
                          transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                          className="absolute inset-0 rounded-[10px] bg-white dark:bg-slate-900 shadow-xs -z-10"
                        />
                      )}
                      <Icon size={13} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!editingTx && onOpenReceiptScan && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      onClose();
                      onOpenReceiptScan();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold whitespace-nowrap hover:bg-emerald-500/20 cursor-pointer"
                  >
                    <ScanLine size={13} />
                    <span>Bill</span>
                  </motion.button>
                )}

                {!editingTx && onOpenVoiceInput && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      onClose();
                      onOpenVoiceInput();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300 text-[11px] font-bold whitespace-nowrap hover:bg-violet-500/20 cursor-pointer"
                  >
                    <Mic size={13} />
                    <span>Nói</span>
                  </motion.button>
                )}

                {editingTx && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      deleteTransaction(editingTx.id);
                      onClose();
                    }}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                    aria-label="Xóa giao dịch"
                  >
                    <Trash2 size={17} />
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Đóng"
                >
                  <X size={19} />
                </motion.button>
              </div>
            </div>

            {/* Scrollable Form Stage */}
            <form
              id="quick-tx-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3.5"
            >
              {/* UNIFIED TOP HERO CARD: Số tiền + Ghi chú nhanh (Zero scrolling!) */}
              <div className="rounded-3xl p-3.5 bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3">
                {/* 1. Số tiền */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Số tiền (VNĐ)
                    </span>
                    {amountInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmountInput('');
                          amountRef.current?.focus();
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Xóa số
                      </button>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="next"
                      placeholder="0"
                      value={amountInput}
                      onChange={(e) => {
                        setAmountInput(formatRawAmount(e.target.value));
                        setError('');
                      }}
                      className={`w-full bg-transparent text-3xl sm:text-[34px] font-extrabold tabular-nums leading-tight focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 ${
                        type === 'expense'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    />
                    <span className="text-xl font-extrabold text-slate-400 shrink-0">₫</span>
                  </div>

                  {error && <p className="text-xs font-semibold text-rose-500 mt-1">{error}</p>}

                  {/* Quick Amount Suggestion Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
                    <button
                      type="button"
                      onClick={handleMultiplyThousand}
                      className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                    >
                      .000
                    </button>
                    {QUICK_AMOUNTS.map((q) => (
                      <motion.button
                        key={q.value}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => handleQuickAddAmount(q.value)}
                        className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {q.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* 2. Ghi chú nhanh (Immediately below Số tiền!) */}
                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="relative flex items-center">
                    <FileText
                      size={15}
                      className="absolute left-3 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      enterKeyHint="done"
                      placeholder={`Ghi chú nhanh... (vd: ${selectedCategory?.quickNotes?.[0] || 'Ăn sáng, đổ xăng...'})`}
                      value={note}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-2xl text-sm font-medium bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                    {note && (
                      <button
                        type="button"
                        onClick={() => setNote('')}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Xóa ghi chú"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Single-row quick-note suggestion chips */}
                  {selectedCategory?.quickNotes && selectedCategory.quickNotes.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
                      {selectedCategory.quickNotes.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setNote(tag)}
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                            note === tag
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attached Receipt Thumbnail Preview (if from OCR scan) */}
              {receiptImage && (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
                  <button
                    type="button"
                    onClick={() => setZoomReceipt(true)}
                    className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                  >
                    <img
                      src={receiptImage}
                      alt="Ảnh hóa đơn đính kèm"
                      className="w-10 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                    />
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Receipt size={13} />
                        <span>Hóa đơn đính kèm</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Chạm để xem ảnh bill</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(undefined)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Compact 4-Column Icon Category Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Phân loại
                    </span>
                    {autoMatchedHint && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        <Sparkles size={10} />
                        Tự chọn
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {selectedCategory?.name}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {filteredCategories.map((cat) => {
                    const active = selectedCategory?.id === cat.id;
                    return (
                      <motion.button
                        key={cat.id}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          setCategoryId(cat.id);
                          setManualCategoryPicked(true);
                          setAutoMatchedHint(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-2xl border transition-all cursor-pointer ${
                          active
                            ? 'bg-slate-900/5 dark:bg-white/10 border-emerald-500/70 ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        <CategoryIconBadge
                          icon={cat.icon}
                          color={cat.color}
                          size="sm"
                          active={active}
                        />
                        <span
                          className={`text-[10.5px] font-bold text-center leading-tight line-clamp-1 ${
                            active
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {cat.shortName}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Quick Metadata Strip (1-tap Date / Payment / Member summary + Expandable detail) */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 p-2.5 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {/* Active Member Chip */}
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions((v) => !v)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-xs whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: selectedMember.color }}
                    >
                      <DynamicIcon name={selectedMember.icon} size={12} />
                      <span>{selectedMember.name}</span>
                    </button>

                    {/* Quick Today / Yesterday / Date chip */}
                    <button
                      type="button"
                      onClick={() =>
                        setDate((d) => (d === todayKey ? yesterdayKey : todayKey))
                      }
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
                      title="Chạm để đổi nhanh Hôm nay / Hôm qua"
                    >
                      <Calendar size={12} className="text-emerald-500" />
                      <span>{dateBadgeLabel}</span>
                    </button>

                    {/* Quick Payment Cycle Chip */}
                    <button
                      type="button"
                      onClick={() => {
                        const order: PaymentMethod[] = ['bank', 'cash', 'ewallet', 'card'];
                        const next = order[(order.indexOf(paymentMethod) + 1) % order.length];
                        setPaymentMethod(next);
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
                      title="Chạm để đổi nguồn tiền"
                    >
                      <PaymentMethodIcon method={paymentMethod} size={12} className="text-sky-500" />
                      <span>
                        {PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.shortLabel}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMoreOptions((v) => !v)}
                    className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    <span>Thêm</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {/* Expandable Full Member / Payment / Exact Date-Time Picker */}
                <AnimatePresence initial={false}>
                  {showMoreOptions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
                        {/* 4 Members */}
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                            Thành viên
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {state.members.map((m) => {
                              const active = memberId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setMemberId(m.id)}
                                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                    active
                                      ? 'text-white border-transparent shadow-xs'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                                  }`}
                                  style={active ? { backgroundColor: m.color } : undefined}
                                >
                                  <DynamicIcon
                                    name={m.icon}
                                    size={13}
                                    style={!active ? { color: m.color } : undefined}
                                  />
                                  <span className="truncate">{m.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Payment Methods */}
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                            Nguồn tiền
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {PAYMENT_METHODS.map((pm) => {
                              const active = paymentMethod === pm.id;
                              return (
                                <button
                                  key={pm.id}
                                  type="button"
                                  onClick={() => setPaymentMethod(pm.id)}
                                  className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                    active
                                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/50'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                                  }`}
                                >
                                  <PaymentMethodIcon method={pm.id} size={13} />
                                  <span>{pm.shortLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Exact Date & Time */}
                        <div className="grid grid-cols-5 gap-2">
                          <div className="col-span-3 relative flex items-center">
                            <Calendar
                              size={14}
                              className="absolute left-3 text-slate-400 pointer-events-none"
                            />
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-2 relative flex items-center">
                            <Clock
                              size={14}
                              className="absolute left-3 text-slate-400 pointer-events-none"
                            />
                            <input
                              type="time"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </form>

            {/* Pinned Sticky Save Footer — Always visible without scrolling! */}
            <div className="px-4 sm:px-5 pt-2.5 pb-safe bg-white/95 dark:bg-[#141923]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80">
              <motion.button
                type="submit"
                form="quick-tx-form"
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 hover:brightness-105 transition-all cursor-pointer"
              >
                <Check size={18} strokeWidth={2.6} />
                <span>
                  {editingTx
                    ? 'Cập nhật giao dịch'
                    : type === 'expense'
                      ? numericPreview > 0
                        ? `Lưu khoản chi • ${formatCompactVND(numericPreview)}`
                        : 'Lưu khoản chi tiêu'
                      : numericPreview > 0
                        ? `Lưu khoản thu • +${formatCompactVND(numericPreview)}`
                        : 'Lưu khoản thu nhập'}
                </span>
              </motion.button>
            </div>
          </motion.div>

          {/* Zoom Receipt Lightbox */}
          <AnimatePresence>
            {zoomReceipt && receiptImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomReceipt(false)}
                className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              >
                <img
                  src={receiptImage}
                  alt="Phóng to hóa đơn"
                  className="max-h-[85dvh] max-w-full rounded-2xl shadow-2xl object-contain bg-white"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
};
