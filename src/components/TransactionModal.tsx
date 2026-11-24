import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Mic,
  Plus,
  Receipt,
  ScanLine,
  Sparkles,
  Trash2,
  X,
  Zap,
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
  formatVND,
  getToday,
  pad2,
  toDateKey,
} from '../utils/format';
import { evaluateAmountExpression, getSmartMultiplierSuggestions } from '../utils/mathEval';
import { loadReceiptImage, saveReceiptImage } from '../utils/receiptStorage';
import { extractVietnameseAmount } from '../utils/voiceParser';
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

interface QuickTemplate {
  label: string;
  amount: number;
  categoryId: string;
  note: string;
}

const BUILTIN_TEMPLATES: QuickTemplate[] = [
  { label: 'Ăn sáng 50k', amount: 50_000, categoryId: 'food', note: 'Ăn sáng' },
  { label: 'Cà phê 45k', amount: 45_000, categoryId: 'food', note: 'Cà phê' },
  { label: 'Đổ xăng 100k', amount: 100_000, categoryId: 'transport', note: 'Đổ xăng xe' },
  { label: 'Đi chợ 200k', amount: 200_000, categoryId: 'grocery', note: 'Đi chợ thực phẩm' },
  { label: 'Tiền điện', amount: 0, categoryId: 'bills', note: 'Thanh toán tiền điện' },
  { label: 'Học phí', amount: 0, categoryId: 'kids', note: 'Đóng học phí tháng' },
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
  const [autoPriceHint, setAutoPriceHint] = useState(false);
  const [memberId, setMemberId] = useState(activeMember.id);
  const [date, setDate] = useState(toDateKey(getToday()));
  const [time, setTime] = useState(getCurrentTimeStr());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(getLastPaymentMethod);
  const [note, setNote] = useState('');
  const [receiptRef, setReceiptRef] = useState<string | undefined>(undefined);
  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string | null>(null);
  const [source, setSource] = useState<'manual' | 'receipt' | 'voice'>('manual');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [sessionSavedCount, setSessionSavedCount] = useState(0);
  const [error, setError] = useState('');

  const amountRef = useRef<HTMLInputElement>(null);

  const filteredCategories = state.categories.filter((c) => c.type === type);
  const selectedCategory =
    filteredCategories.find((c) => c.id === categoryId) || filteredCategories[0];
  const selectedMember = state.members.find((m) => m.id === memberId) || activeMember;

  // Build smart frequent templates combining recent user entries + practical defaults
  const frequentTemplates = useMemo<QuickTemplate[]>(() => {
    if (type !== 'expense') return [];
    const counts = new Map<string, { item: QuickTemplate; freq: number }>();
    for (const tx of state.transactions) {
      if (tx.type !== 'expense' || !tx.note.trim()) continue;
      const key = `${tx.categoryId}|${tx.note.trim().toLowerCase()}`;
      const existing = counts.get(key);
      if (existing) {
        existing.freq += 1;
      } else {
        counts.set(key, {
          freq: 1,
          item: {
            label: `${tx.note.trim().slice(0, 14)} ${formatCompactVND(tx.amount)}`,
            amount: tx.amount,
            categoryId: tx.categoryId,
            note: tx.note.trim(),
          },
        });
      }
    }
    const userTop = Array.from(counts.values())
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 3)
      .map((x) => x.item);

    const merged = [...userTop];
    for (const b of BUILTIN_TEMPLATES) {
      if (merged.length >= 6) break;
      if (!merged.some((m) => m.note.toLowerCase() === b.note.toLowerCase())) {
        merged.push(b);
      }
    }
    return merged;
  }, [state.transactions, type]);

  // Resolve IndexedDB receipt image whenever receiptRef changes
  useEffect(() => {
    let active = true;
    if (!receiptRef) {
      setResolvedReceiptUrl(null);
      return;
    }
    void loadReceiptImage(receiptRef).then((url) => {
      if (active) setResolvedReceiptUrl(url);
    });
    return () => {
      active = false;
    };
  }, [receiptRef]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setZoomReceipt(false);
    setAutoMatchedHint(false);
    setAutoPriceHint(false);
    setSessionSavedCount(0);

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
      setReceiptRef(editingTx.receiptImage);
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
      setReceiptRef(draft.receiptImage);
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
      setReceiptRef(undefined);
      setSource('manual');
      setShowMoreOptions(Boolean(defaultDate && defaultDate !== toDateKey(getToday())));
      window.setTimeout(() => {
        amountRef.current?.focus();
      }, 120);
    }
  }, [open, editingTx, draft, defaultDate, activeMember.id]);

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

  const exprResult = useMemo(() => evaluateAmountExpression(amountInput), [amountInput]);
  const multiplierSuggestions = useMemo(
    () => getSmartMultiplierSuggestions(amountInput),
    [amountInput],
  );

  // Format plain numeric input smoothly, while preserving operator expressions like "120+35"
  const handleAmountChange = (rawValue: string) => {
    setError('');
    setAutoPriceHint(false);
    const cleaned = rawValue.replace(/[^0-9+\-*/x×.,kKtrTR ]/g, '');
    if (/[+\-*/x×kKtrTR]/.test(cleaned)) {
      setAmountInput(cleaned);
    } else {
      setAmountInput(formatRawAmount(cleaned));
    }
  };

  const handleInsertOperator = (op: '+' | '-' | '*') => {
    if (!amountInput.trim()) return;
    const trimmed = amountInput.trim();
    if (/[+\-*/]$/.test(trimmed)) {
      setAmountInput(trimmed.slice(0, -1) + op);
    } else {
      setAmountInput(trimmed + op);
    }
    amountRef.current?.focus();
  };

  const handleApplyExpression = (multiplyThousand = false) => {
    if (!exprResult.valid) return;
    const finalVal = multiplyThousand ? exprResult.value * 1_000 : exprResult.value;
    setAmountInput(formatRawAmount(String(finalVal)));
    setError('');
  };

  const handleQuickAddAmount = (delta: number) => {
    const current = exprResult.valid ? exprResult.value : 0;
    setAmountInput(formatRawAmount(String(current + delta)));
    setError('');
  };

  const handleMultiplyThousand = () => {
    if (exprResult.valid && exprResult.value > 0 && exprResult.value < 1_000_000) {
      setAmountInput(formatRawAmount(String(exprResult.value * 1_000)));
      setError('');
    }
  };

  const handleNoteChange = (nextNote: string) => {
    setNote(nextNote);
    // 1. Auto-detect category while typing quick note
    if (!manualCategoryPicked && nextNote.trim().length >= 2) {
      const detected = detectCategoryFromText(nextNote, type, state.categories);
      const fallback = type === 'income' ? 'other_income' : 'other_expense';
      if (detected !== fallback && detected !== categoryId) {
        setCategoryId(detected);
        setAutoMatchedHint(true);
      }
    }
    // 2. Smart single-line price extraction if Amount is currently empty (e.g. typing "Phở bò 50k")
    if (!amountInput.trim() && /\d|chục|lít|xị|nghìn|ngàn|triệu/i.test(nextNote)) {
      const extracted = extractVietnameseAmount(nextNote);
      if (extracted >= 1_000) {
        setAmountInput(formatRawAmount(String(extracted)));
        setAutoPriceHint(true);
        setError('');
      }
    }
  };

  const handleApplyTemplate = (tpl: QuickTemplate) => {
    setCategoryId(tpl.categoryId);
    setManualCategoryPicked(true);
    setAutoMatchedHint(false);
    setNote(tpl.note);
    if (tpl.amount > 0) {
      setAmountInput(formatRawAmount(String(tpl.amount)));
      setError('');
    } else {
      amountRef.current?.focus();
    }
  };

  const saveEntry = async (keepOpenForNext: boolean) => {
    const numericAmount = exprResult.valid ? exprResult.value : 0;
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

    let finalReceiptRef = receiptRef;
    if (receiptRef && receiptRef.startsWith('data:image/')) {
      finalReceiptRef = await saveReceiptImage(receiptRef);
    }

    // Strip redundant price suffix if user typed "Phở bò 50k" into note and price was auto-extracted
    const cleanNote = autoPriceHint
      ? note
          .replace(/\b\d+(?:[.,]\d+)?\s*(triệu|tr|nghìn|ngàn|k|đ|vnd)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim() || note.trim()
      : note.trim();

    const payload = {
      type,
      amount: numericAmount,
      categoryId: selectedCategory?.id || categoryId,
      memberId,
      date,
      time: time || getCurrentTimeStr(),
      paymentMethod,
      note: cleanNote,
      receiptImage: finalReceiptRef,
      source,
    };

    if (editingTx) {
      updateTransaction(editingTx.id, payload);
      onClose();
      return;
    }

    addTransaction(payload);

    if (keepOpenForNext) {
      setSessionSavedCount((c) => c + 1);
      setAmountInput('');
      setNote('');
      setManualCategoryPicked(false);
      setAutoMatchedHint(false);
      setAutoPriceHint(false);
      setReceiptRef(undefined);
      setSource('manual');
      setTime(getCurrentTimeStr());
      setError('');
      window.setTimeout(() => amountRef.current?.focus(), 60);
    } else {
      onClose();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void saveEntry(false);
  };

  const todayKey = toDateKey(getToday());
  const yesterdayKey = toDateKey(addDays(getToday(), -1));
  const numericPreview = exprResult.valid ? exprResult.value : 0;
  const dateBadgeLabel =
    date === todayKey
      ? 'Hôm nay'
      : date === yesterdayKey
        ? 'Hôm qua'
        : `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 dark:bg-black/72 sm:backdrop-blur-xs animate-ios-fade"
      />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[94dvh] flex flex-col modal-surface rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden animate-ios-sheet">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-white/15" />
        </div>

        {/* Compact Top Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 pt-2.5 pb-2.5 border-b border-slate-100 dark:border-white/[0.07] gap-1.5">
          <div className="grid grid-cols-2 p-0.5 rounded-xl bg-slate-100 dark:bg-[#0b1019] dark:border dark:border-white/[0.06] shrink-0">
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
                  className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? item.id === 'expense'
                        ? 'bg-white dark:bg-[#1a2335] text-rose-600 dark:text-rose-400 shadow-xs'
                        : 'bg-white dark:bg-[#1a2335] text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!editingTx && onOpenReceiptScan && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReceiptScan();
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold whitespace-nowrap hover:bg-emerald-500/20 active:scale-92 transition-transform duration-100 cursor-pointer"
              >
                <ScanLine size={13} />
                <span>Bill</span>
              </button>
            )}

            {!editingTx && onOpenVoiceInput && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVoiceInput();
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300 text-[11px] font-bold whitespace-nowrap hover:bg-violet-500/20 active:scale-92 transition-transform duration-100 cursor-pointer"
              >
                <Mic size={13} />
                <span>Nói</span>
              </button>
            )}

            {editingTx && (
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(editingTx.id);
                  onClose();
                }}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-92 transition-transform duration-100 cursor-pointer"
                aria-label="Xóa giao dịch"
              >
                <Trash2 size={17} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] active:scale-92 transition-transform duration-100 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Stage */}
        <form
          id="quick-tx-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 space-y-3"
        >
          {/* Session batch save notice when user uses "Lưu & tiếp" */}
          {sessionSavedCount > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold animate-ios-fade">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} strokeWidth={2.5} />
                Đã lưu {sessionSavedCount} khoản
              </span>
              <button
                type="button"
                onClick={onClose}
                className="underline text-[11px] cursor-pointer"
              >
                Xong
              </button>
            </div>
          )}

              {/* UNIFIED TOP HERO CARD: Số tiền (with Calc + Smart Multipliers) + Ghi chú nhanh */}
              <div className="rounded-3xl p-3.5 bg-slate-50 dark:bg-[#0b1019] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                {/* 1. Số tiền + Inline Calculator */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Số tiền
                      </span>
                      {autoPriceHint && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                          <Sparkles size={10} />
                          Tự tách giá
                        </span>
                      )}
                    </div>
                    {amountInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmountInput('');
                          setAutoPriceHint(false);
                          amountRef.current?.focus();
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="next"
                      placeholder="0"
                      value={amountInput}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className={`w-full bg-transparent text-3xl sm:text-[34px] font-extrabold tabular-nums leading-tight focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 ${
                        type === 'expense'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    />
                    <span className="text-xl font-extrabold text-slate-400 shrink-0">₫</span>
                  </div>

                  {/* Live Expression Calculator Result Bar */}
                  {exprResult.hasOperator && exprResult.valid && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyExpression(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold tabular-nums cursor-pointer"
                      >
                        <Calculator size={12} />
                        <span>= {formatVND(exprResult.value)}</span>
                      </button>
                      {exprResult.suggestThousands && (
                        <button
                          type="button"
                          onClick={() => handleApplyExpression(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-xs font-extrabold tabular-nums shadow-xs cursor-pointer"
                        >
                          <span>= {formatVND(exprResult.value * 1_000)}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {error && <p className="text-xs font-semibold text-rose-500 mt-1">{error}</p>}

                  {/* Dynamic Bar: MoMo-style Multiplier Suggestions OR Quick Operators + Amounts */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
                    {multiplierSuggestions.length > 0 ? (
                      <>
                        {multiplierSuggestions.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setAmountInput(formatRawAmount(String(val)));
                              setError('');
                            }}
                            className="shrink-0 px-3 py-1 rounded-xl text-xs font-extrabold tabular-nums bg-emerald-500/14 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500 hover:text-white active:scale-92 transition-transform duration-100 cursor-pointer"
                          >
                            {formatVND(val)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleInsertOperator('+')}
                          className="shrink-0 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Cộng thêm số tiền"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertOperator('-')}
                          className="shrink-0 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Trừ bớt số tiền"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertOperator('*')}
                          className="shrink-0 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Nhân số lượng"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleMultiplyThousand}
                          className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                        >
                          .000
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertOperator('+')}
                          className="shrink-0 px-2 py-1 rounded-xl text-xs font-extrabold bg-slate-200/75 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white cursor-pointer"
                          title="Cộng nhiều món"
                        >
                          +
                        </button>
                        {QUICK_AMOUNTS.map((q) => (
                          <button
                            key={q.value}
                            type="button"
                            onClick={() => handleQuickAddAmount(q.value)}
                            className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-400 hover:text-emerald-600 active:scale-92 transition-transform duration-100 cursor-pointer"
                          >
                            {q.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Ghi chú nhanh (Smart auto-category + auto-price extraction!) */}
                <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07]">
                  <div className="relative flex items-center">
                    <FileText
                      size={15}
                      className="absolute left-3 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      enterKeyHint="done"
                      placeholder="Ghi chú nhanh..."
                      value={note}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-2xl text-sm font-medium bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/70"
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

                  {/* Quick-note suggestion chips for active category */}
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

              {/* 1-Tap Frequent Family Templates Strip (when adding new expense) */}
              {!editingTx && frequentTemplates.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-500 pr-0.5">
                    <Zap size={12} />
                    Mẫu nhanh:
                  </span>
                  {frequentTemplates.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Attached Receipt Thumbnail Preview */}
              {resolvedReceiptUrl && (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
                  <button
                    type="button"
                    onClick={() => setZoomReceipt(true)}
                    className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                  >
                    <img
                      src={resolvedReceiptUrl}
                      alt="Ảnh hóa đơn đính kèm"
                      className="w-10 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                    />
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Receipt size={13} />
                        <span>Hóa đơn đính kèm</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptRef(undefined)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Compact 4-Column Icon Category Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
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
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(cat.id);
                          setManualCategoryPicked(true);
                          setAutoMatchedHint(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-2xl border active:scale-92 transition-transform duration-100 cursor-pointer ${
                          active
                            ? 'bg-emerald-500/8 dark:bg-emerald-500/14 border-emerald-500/70 dark:border-emerald-400/60 ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/12'
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
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Quick Metadata Strip */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-[#0b1019] border border-slate-200/60 dark:border-white/[0.07] p-2.5 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions((v) => !v)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-xs whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: selectedMember.color }}
                    >
                      <DynamicIcon name={selectedMember.icon} size={12} />
                      <span>{selectedMember.name}</span>
                    </button>

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

                {showMoreOptions && (
                  <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07] space-y-3 animate-ios-fade">
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
                    )}
              </div>
            </form>

            {/* Pinned Sticky Save Footer — solid surface, zero backdrop-blur cost on iOS */}
            <div className="px-4 sm:px-5 pt-2.5 pb-safe bg-white dark:bg-[#0e131e] border-t border-slate-100 dark:border-white/[0.07] space-y-2">
              {numericPreview > 0 && numericPreview < 1_000 && (
                <button
                  type="button"
                  onClick={handleMultiplyThousand}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/12 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold cursor-pointer"
                >
                  <span>Ý bạn là {formatVND(numericPreview * 1_000)}?</span>
                  <span className="underline">Chạm để đổi ×1.000</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                {!editingTx && (
                  <button
                    type="button"
                    onClick={() => void saveEntry(true)}
                    className="shrink-0 inline-flex items-center justify-center gap-1 px-3.5 py-3.5 rounded-2xl text-xs font-extrabold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 whitespace-nowrap active:scale-95 transition-transform duration-100 cursor-pointer"
                    title="Lưu khoản này và giữ khung mở để nhập tiếp ngay"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>Lưu & tiếp</span>
                  </button>
                )}

                <button
                  type="submit"
                  form="quick-tx-form"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 hover:brightness-105 active:scale-[0.97] transition-transform duration-100 cursor-pointer"
                >
                  <Check size={18} strokeWidth={2.6} />
                  <span>
                    {editingTx
                      ? 'Cập nhật giao dịch'
                      : type === 'expense'
                        ? numericPreview > 0
                          ? `Lưu • ${formatCompactVND(numericPreview)}`
                          : 'Lưu khoản chi'
                        : numericPreview > 0
                          ? `Lưu thu • +${formatCompactVND(numericPreview)}`
                          : 'Lưu khoản thu'}
                  </span>
                </button>
              </div>
            </div>
      </div>

      {/* Zoom Receipt Lightbox */}
      {zoomReceipt && resolvedReceiptUrl && (
        <div
          onClick={() => setZoomReceipt(false)}
          className="fixed inset-0 z-60 bg-black/88 flex items-center justify-center p-4 animate-ios-fade"
        >
          <img
            src={resolvedReceiptUrl}
            alt="Phóng to hóa đơn"
            className="max-h-[85dvh] max-w-full rounded-2xl shadow-2xl object-contain bg-white"
          />
        </div>
      )}
    </div>
  );
};
