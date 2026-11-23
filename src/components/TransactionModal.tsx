import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  FileText,
  Mic,
  Receipt,
  ScanLine,
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
import {
  addDays,
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

const QUICK_AMOUNTS = [
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
  const [memberId, setMemberId] = useState(activeMember.id);
  const [date, setDate] = useState(toDateKey(getToday()));
  const [time, setTime] = useState(getCurrentTimeStr());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [note, setNote] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<'manual' | 'receipt' | 'voice'>('manual');
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [error, setError] = useState('');

  const filteredCategories = state.categories.filter((c) => c.type === type);
  const selectedCategory =
    filteredCategories.find((c) => c.id === categoryId) || filteredCategories[0];

  useEffect(() => {
    if (!open) return;
    setError('');
    setZoomReceipt(false);
    if (editingTx) {
      setType(editingTx.type);
      setAmountInput(formatRawAmount(String(editingTx.amount)));
      setCategoryId(editingTx.categoryId);
      setMemberId(editingTx.memberId);
      setDate(editingTx.date);
      setTime(editingTx.time);
      setPaymentMethod(editingTx.paymentMethod);
      setNote(editingTx.note);
      setReceiptImage(editingTx.receiptImage);
      setSource(editingTx.source || 'manual');
    } else if (draft) {
      setType(draft.type || 'expense');
      setAmountInput(draft.amount ? formatRawAmount(String(draft.amount)) : '');
      setCategoryId(draft.categoryId || 'food');
      setMemberId(draft.memberId || activeMember.id);
      setDate(draft.date || defaultDate || toDateKey(getToday()));
      setTime(draft.time || getCurrentTimeStr());
      setPaymentMethod(draft.paymentMethod || 'bank');
      setNote(draft.note || '');
      setReceiptImage(draft.receiptImage);
      setSource(draft.source || 'manual');
    } else {
      setType('expense');
      setAmountInput('');
      setCategoryId('food');
      setMemberId(activeMember.id);
      setDate(defaultDate || toDateKey(getToday()));
      setTime(getCurrentTimeStr());
      setPaymentMethod('bank');
      setNote('');
      setReceiptImage(undefined);
      setSource('manual');
    }
  }, [open, editingTx, draft, defaultDate, activeMember.id]);

  // Keep category synced with type
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseRawAmount(amountInput);
    if (numericAmount <= 0) {
      setError('Vui lòng nhập số tiền lớn hơn 0');
      return;
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white dark:bg-[#141923] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Header with Smart Scan & Voice shortcuts */}
            <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {editingTx ? 'Chỉnh sửa giao dịch' : 'Ghi nhận giao dịch'}
              </h2>

              <div className="flex items-center gap-1.5 shrink-0">
                {!editingTx && onOpenReceiptScan && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      onClose();
                      onOpenReceiptScan();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/20 cursor-pointer"
                  >
                    <ScanLine size={14} />
                    <span>Quét bill</span>
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300 text-[11px] font-bold hover:bg-violet-500/20 cursor-pointer"
                  >
                    <Mic size={14} />
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
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                    aria-label="Xóa giao dịch"
                  >
                    <Trash2 size={18} />
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Đóng"
                >
                  <X size={20} />
                </motion.button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Type segmented switch */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
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
                      className={`relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors z-10 cursor-pointer ${
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
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className="absolute inset-0 rounded-xl bg-white dark:bg-slate-900 shadow-sm -z-10"
                        />
                      )}
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Hero Amount Input */}
              <div className="rounded-3xl p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Số tiền (VNĐ)
                  </span>
                  {amountInput && (
                    <button
                      type="button"
                      onClick={() => setAmountInput('')}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(formatRawAmount(e.target.value));
                      setError('');
                    }}
                    className={`w-full bg-transparent text-3xl sm:text-4xl font-extrabold tabular-nums focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 ${
                      type === 'expense'
                        ? 'text-slate-900 dark:text-white'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                  <span className="text-xl font-bold text-slate-400 shrink-0">₫</span>
                </div>

                {error && <p className="text-xs font-semibold text-rose-500 mt-1.5">{error}</p>}

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleMultiplyThousand}
                    className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                  >
                    .000
                  </button>
                  {QUICK_AMOUNTS.map((q) => (
                    <motion.button
                      key={q.value}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleQuickAddAmount(q.value)}
                      className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      {q.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Attached Receipt Thumbnail Preview */}
              {receiptImage && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
                  <button
                    type="button"
                    onClick={() => setZoomReceipt(true)}
                    className="flex items-center gap-3 text-left cursor-pointer min-w-0"
                  >
                    <img
                      src={receiptImage}
                      alt="Ảnh hóa đơn đính kèm"
                      className="w-12 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                    />
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Receipt size={13} />
                        <span>Hóa đơn đính kèm</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Chạm để phóng to xem ảnh bill
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptImage(undefined)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                    aria-label="Gỡ ảnh hóa đơn"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Icon-first Category Grid */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Phân loại
                  </label>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {selectedCategory?.name}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {filteredCategories.map((cat) => {
                    const active = selectedCategory?.id === cat.id;
                    return (
                      <motion.button
                        key={cat.id}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setCategoryId(cat.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          active
                            ? 'bg-slate-900/5 dark:bg-white/10 border-emerald-500/70 ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        <CategoryIconBadge
                          icon={cat.icon}
                          color={cat.color}
                          size="md"
                          active={active}
                        />
                        <span
                          className={`text-[11px] font-semibold text-center leading-tight line-clamp-1 ${
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

              {/* Family Member & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Thành viên (4 người)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {state.members.map((m) => {
                      const active = memberId === m.id;
                      return (
                        <motion.button
                          key={m.id}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setMemberId(m.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            active
                              ? 'text-white border-transparent shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                          }`}
                          style={active ? { backgroundColor: m.color } : undefined}
                        >
                          <DynamicIcon
                            name={m.icon}
                            size={14}
                            style={!active ? { color: m.color } : undefined}
                          />
                          <span>{m.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Nguồn tiền
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_METHODS.map((pm) => {
                      const active = paymentMethod === pm.id;
                      return (
                        <motion.button
                          key={pm.id}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/50'
                              : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                          }`}
                        >
                          <PaymentMethodIcon method={pm.id} size={14} />
                          <span>{pm.shortLabel}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Date & Time Row */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Ngày & Giờ
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDate(todayKey)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        date === todayKey
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(yesterdayKey)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        date === yesterdayKey
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Hôm qua
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3 relative flex items-center">
                    <Calendar
                      size={16}
                      className="absolute left-3 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2 relative flex items-center">
                    <Clock
                      size={16}
                      className="absolute left-3 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Note & Smart Quick Tags */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Ghi chú nhanh
                </label>
                <div className="relative flex items-center">
                  <FileText
                    size={16}
                    className="absolute left-3.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder={`Ví dụ: ${selectedCategory?.quickNotes?.[0] || 'Nội dung chi tiêu...'}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {selectedCategory?.quickNotes && selectedCategory.quickNotes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedCategory.quickNotes.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNote(tag)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                          note === tag
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 pb-safe">
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.97 }}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer ${
                    type === 'expense'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/30 hover:brightness-105'
                      : 'bg-gradient-to-r from-emerald-600 to-green-500 shadow-emerald-500/30 hover:brightness-105'
                  }`}
                >
                  <Check size={18} strokeWidth={2.5} />
                  <span>
                    {editingTx
                      ? 'Cập nhật giao dịch'
                      : type === 'expense'
                        ? 'Lưu khoản chi tiêu'
                        : 'Lưu khoản thu nhập'}
                  </span>
                </motion.button>
              </div>
            </form>
          </motion.div>

          {/* Zoom Receipt Fullscreen Lightbox */}
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
