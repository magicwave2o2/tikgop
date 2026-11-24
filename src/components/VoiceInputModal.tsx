import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Cloud,
  Edit3,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useFinance } from '../store/useFinanceStore';
import type { TransactionDraft } from '../types/finance';
import { formatVND, pad2 } from '../utils/format';
import {
  VOICE_SAMPLE_PHRASES,
  type VoiceParseResult,
  parseVietnameseVoiceBatch,
  parseVoiceWithAI,
} from '../utils/voiceParser';
import { CategoryIconBadge, DynamicIcon } from './IconRenderer';

interface VoiceInputModalProps {
  open: boolean;
  onClose: () => void;
  onEditDraft: (draft: TransactionDraft) => void;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const AUTOSAVE_PREF_KEY = 'tikgop_voice_autosave';

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function detectInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Zalo|FBAN|FBAV|Instagram|Line|Messenger/i.test(navigator.userAgent);
}

function getSavedAutoSavePref(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_PREF_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  open,
  onClose,
  onEditDraft,
}) => {
  const { state, activeMember, addTransactionsBatch } = useFinance();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [fromSpeechEnd, setFromSpeechEnd] = useState(false);

  // Smart hybrid items: instant local parse + automatic Cloudflare AI refinement
  const [aiItems, setAiItems] = useState<VoiceParseResult[] | null>(null);
  const [isRefiningAI, setIsRefiningAI] = useState(false);
  const [overrides, setOverrides] = useState<
    Record<string, { categoryId?: string; memberId?: string }>
  >({});
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [editingCatItemId, setEditingCatItemId] = useState<string | null>(null);

  // Hands-free Auto-Save mode (runs 2.5s countdown right after speech ends + AI finishes)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(getSavedAutoSavePref);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);
  const [error, setError] = useState('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const hadSpeechResultRef = useRef(false);

  const isSpeechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const isInAppBrowser = useMemo(() => detectInAppWebView(), []);

  const cancelAutoSave = useCallback(() => {
    setAutoSaveCountdown(null);
    setFromSpeechEnd(false);
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
    }
    setIsListening(false);
  }, []);

  const toggleAutoSavePref = () => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOSAVE_PREF_KEY, next ? '1' : '0');
      } catch {
        // ignore storage error
      }
      if (!next) setAutoSaveCountdown(null);
      return next;
    });
  };

  const startListening = useCallback(
    (silentFail = false) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        if (!silentFail) {
          setError(
            isInAppBrowser
              ? 'Hãy mở bằng Chrome hoặc Safari để bật Micro.'
              : 'Trình duyệt chưa hỗ trợ Micro — hãy nhập trực tiếp.',
          );
        }
        return;
      }

      setError('');
      cancelAutoSave();
      hadSpeechResultRef.current = false;

      try {
        const rec = new Ctor();
        rec.lang = 'vi-VN';
        rec.continuous = false;
        rec.interimResults = true;

        rec.onstart = () => {
          setIsListening(true);
          setError('');
        };

        rec.onresult = (event) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript;
          }
          const clean = combined.trim();
          if (clean) {
            hadSpeechResultRef.current = true;
            setTranscript(clean);
            setAiItems(null);
            setOverrides({});
            setExcludedIds([]);
            setEditingCatItemId(null);
          }
        };

        rec.onerror = (event) => {
          setIsListening(false);
          if (silentFail) return;
          if (event.error === 'not-allowed') {
            setError('Chưa cấp quyền Micro trên trình duyệt.');
          } else if (event.error === 'no-speech') {
            setError('Không nghe thấy giọng nói, hãy thử lại.');
          } else if (event.error !== 'aborted') {
            setError(`Lỗi Micro (${event.error}).`);
          }
        };

        rec.onend = () => {
          setIsListening(false);
          if (hadSpeechResultRef.current) {
            setFromSpeechEnd(true);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch {
        if (!silentFail) setError('Không thể khởi động Micro.');
        setIsListening(false);
      }
    },
    [isInAppBrowser, cancelAutoSave],
  );

  // Auto-listen when modal opens
  useEffect(() => {
    if (!open) {
      stopListening();
      aiAbortRef.current?.abort();
      setTranscript('');
      setAiItems(null);
      setIsRefiningAI(false);
      setOverrides({});
      setExcludedIds([]);
      setEditingCatItemId(null);
      setAutoSaveCountdown(null);
      setFromSpeechEnd(false);
      setError('');
      return;
    }

    if (isSpeechSupported && !isInAppBrowser) {
      const timer = window.setTimeout(() => {
        startListening(true);
      }, 200);
      return () => window.clearTimeout(timer);
    }
  }, [open, isSpeechSupported, isInAppBrowser, startListening, stopListening]);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  // 1) Instant 0ms local NLP parse while speaking or typing
  const localItems = useMemo<VoiceParseResult[]>(() => {
    if (!transcript.trim()) return [];
    return parseVietnameseVoiceBatch(
      transcript,
      state.categories,
      state.members,
      activeMember.id,
    );
  }, [transcript, state.categories, state.members, activeMember.id]);

  // 2) Automatic Cloudflare AI semantic refinement once user pauses speaking/typing
  useEffect(() => {
    aiAbortRef.current?.abort();
    const clean = transcript.trim();

    if (!open || isListening || clean.length < 4) {
      setIsRefiningAI(false);
      return;
    }

    const delayMs = fromSpeechEnd ? 80 : 480;
    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      aiAbortRef.current = controller;
      setIsRefiningAI(true);

      void parseVoiceWithAI(
        clean,
        state.categories,
        state.members,
        activeMember.id,
        controller.signal,
      ).then((res) => {
        if (controller.signal.aborted) return;
        setIsRefiningAI(false);
        if (res && res.length > 0) {
          setAiItems(res);
          setOverrides({});
          setExcludedIds([]);
        }
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      aiAbortRef.current?.abort();
    };
  }, [open, isListening, transcript, fromSpeechEnd, state.categories, state.members, activeMember.id]);

  const mergedItems = useMemo<VoiceParseResult[]>(() => {
    const base = aiItems && aiItems.length > 0 ? aiItems : localItems;
    return base
      .filter((item) => !excludedIds.includes(item.id))
      .map((item) => {
        const ov = overrides[item.id];
        return ov
          ? {
              ...item,
              categoryId: ov.categoryId ?? item.categoryId,
              memberId: ov.memberId ?? item.memberId,
            }
          : item;
      });
  }, [aiItems, localItems, excludedIds, overrides]);

  const validItems = useMemo(
    () => mergedItems.filter((item) => item.amount > 0),
    [mergedItems],
  );

  const totalBatchAmount = useMemo(
    () => validItems.reduce((sum, i) => sum + i.amount, 0),
    [validItems],
  );

  const handleSaveAll = useCallback(() => {
    if (validItems.length === 0) {
      setError('Chưa nhận diện được số tiền.');
      return;
    }
    const now = new Date();
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    addTransactionsBatch(
      validItems.map((item) => ({
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        memberId: item.memberId,
        date: item.date,
        time: timeStr,
        note: item.note || item.transcript,
        paymentMethod: item.paymentMethod,
        source: 'voice',
      })),
    );
    onClose();
  }, [validItems, addTransactionsBatch, onClose]);

  // Hands-free Auto-Save Countdown: starts automatically after voice ends + AI refinement completes
  useEffect(() => {
    if (
      !open ||
      !autoSaveEnabled ||
      !fromSpeechEnd ||
      isListening ||
      isRefiningAI ||
      validItems.length === 0 ||
      editingCatItemId !== null
    ) {
      return;
    }

    setAutoSaveCountdown(2.5);
    const startedAt = Date.now();
    const totalMs = 2500;

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, (totalMs - (Date.now() - startedAt)) / 1000);
      if (remaining <= 0.05) {
        window.clearInterval(interval);
        setAutoSaveCountdown(null);
        handleSaveAll();
      } else {
        setAutoSaveCountdown(remaining);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    open,
    autoSaveEnabled,
    fromSpeechEnd,
    isListening,
    isRefiningAI,
    validItems.length,
    editingCatItemId,
    handleSaveAll,
  ]);

  const catMap = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c])),
    [state.categories],
  );
  const memMap = useMemo(
    () => new Map(state.members.map((m) => [m.id, m])),
    [state.members],
  );

  const cycleMemberForItem = (item: VoiceParseResult) => {
    cancelAutoSave();
    const idx = state.members.findIndex((m) => m.id === item.memberId);
    const next = state.members[(idx + 1) % state.members.length];
    if (!next) return;
    setOverrides((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], memberId: next.id },
    }));
  };

  const setCategoryForItem = (itemId: string, catId: string) => {
    cancelAutoSave();
    setOverrides((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], categoryId: catId },
    }));
    setEditingCatItemId(null);
  };

  const buildDraftFromItem = (item: VoiceParseResult): TransactionDraft => {
    const now = new Date();
    return {
      type: item.type,
      amount: item.amount,
      categoryId: item.categoryId,
      memberId: item.memberId,
      date: item.date,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      note: item.note || item.transcript,
      paymentMethod: item.paymentMethod,
      source: 'voice',
    };
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening(false);
  };

  const isMultiBatch = mergedItems.length >= 2;
  const singleItem = mergedItems[0] || null;
  const isAiPowered = Boolean(aiItems && aiItems.length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 dark:bg-black/72 sm:backdrop-blur-xs animate-ios-fade"
      />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col modal-surface rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden animate-ios-sheet">
        {/* Header with Hands-Free Auto-Save Toggle */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.07] gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Mic size={19} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Nhập bằng giọng nói
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleAutoSavePref}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    autoSaveEnabled
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent'
                  }`}
                  title="Tự động lưu sau khi nói xong"
                >
                  <Zap size={12} />
                  <span>Tự lưu</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              {/* Interactive Pulsing Microphone Stage (100% GPU CSS keyframes) */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <>
                      <span className="absolute w-20 h-20 rounded-full bg-violet-500/35 pointer-events-none animate-ios-ripple" />
                      <span
                        className="absolute w-20 h-20 rounded-full bg-emerald-500/35 pointer-events-none animate-ios-ripple"
                        style={{ animationDelay: '0.45s' }}
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`relative z-10 w-18 h-18 rounded-full flex items-center justify-center text-white shadow-xl active:scale-92 transition-transform duration-100 cursor-pointer ${
                      isListening
                        ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/40'
                        : 'bg-gradient-to-tr from-violet-600 via-indigo-500 to-emerald-500 shadow-violet-500/35'
                    }`}
                    aria-label={isListening ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                  >
                    {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>
                </div>

                <div className="h-6 flex items-center justify-center gap-1 mt-2.5">
                  {isListening ? (
                    <>
                      {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                        <span
                          key={idx}
                          className="w-1 h-5 rounded-full bg-gradient-to-t from-violet-500 to-emerald-400 animate-ios-eq"
                          style={{ animationDelay: `${idx * 0.08}s` }}
                        />
                      ))}
                      <span className="ml-2 text-xs font-bold text-rose-500">Đang nghe...</span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isSpeechSupported ? 'Chạm để nói' : 'Nhập câu tự nhiên'}
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Editable Live Transcript Input */}
              <div className="relative">
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => {
                    cancelAutoSave();
                    setTranscript(e.target.value);
                    setAiItems(null);
                    setOverrides({});
                    setExcludedIds([]);
                    setEditingCatItemId(null);
                    setError('');
                  }}
                  placeholder="Ví dụ: Mua thịt 120k, rau 4 chục..."
                  className="w-full px-4 py-3 pr-9 rounded-2xl text-sm font-semibold bg-slate-50 dark:bg-[#0b1019] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-violet-400/70 resize-none"
                />
                {transcript && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelAutoSave();
                      setTranscript('');
                      setAiItems(null);
                      setOverrides({});
                      setExcludedIds([]);
                      setEditingCatItemId(null);
                    }}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Xóa nội dung"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Hands-free Auto-Save Countdown Bar */}
              {autoSaveCountdown !== null && (
                <div className="p-3 rounded-2xl bg-emerald-500/12 border border-emerald-500/30 space-y-2 animate-ios-fade">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Zap size={13} />
                      Tự động lưu sau {Math.ceil(autoSaveCountdown)}s...
                    </span>
                    <button
                      type="button"
                      onClick={cancelAutoSave}
                      className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-[#141b29] text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-emerald-500/20 overflow-hidden">
                    <div
                      className="h-full w-full rounded-full bg-emerald-500 origin-left transition-transform duration-100"
                      style={{ transform: `scaleX(${Math.min(1, autoSaveCountdown / 2.5)})` }}
                    />
                  </div>
                </div>
              )}

              {/* Smart Hybrid Extraction Preview (Instant Local + AI Semantic Refinement + Inline Category/Member Tweak) */}
              {mergedItems.length > 0 && (
                <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500/8 via-emerald-500/6 to-teal-500/8 border border-emerald-500/25 space-y-3 animate-ios-fade">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {isMultiBatch ? <Layers size={13} /> : <Sparkles size={13} />}
                        <span>
                          {isMultiBatch ? `${mergedItems.length} khoản` : 'Tự động phân loại'}
                        </span>
                      </span>

                      {isRefiningAI ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-bold">
                          <Loader2 size={10} className="animate-spin" />
                          AI
                        </span>
                      ) : isAiPowered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          <Cloud size={10} />
                          AI
                        </span>
                      ) : null}
                    </div>

                    {isMultiBatch ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold tabular-nums">
                        {formatVND(totalBatchAmount)}
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          singleItem?.type === 'income'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-rose-500/15 text-rose-500'
                        }`}
                      >
                        {singleItem?.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
                      </span>
                    )}
                  </div>

                  {/* Extracted Items List with 1-Tap Inline Category & Member Tweaking */}
                  <div className="space-y-2">
                    {mergedItems.map((item) => {
                      const cat = catMap.get(item.categoryId);
                      const mem = memMap.get(item.memberId) || activeMember;
                      const isEditingCat = editingCatItemId === item.id;
                      const availableCats = state.categories.filter((c) => c.type === item.type);

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-white/85 dark:bg-slate-900/65 border border-slate-200/60 dark:border-slate-800 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2.5 p-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  cancelAutoSave();
                                  setEditingCatItemId((prev) =>
                                    prev === item.id ? null : item.id,
                                  );
                                }}
                                title="Đổi danh mục"
                                className="cursor-pointer rounded-xl focus:outline-none"
                              >
                                <CategoryIconBadge
                                  icon={cat?.icon || 'MoreHorizontal'}
                                  color={cat?.color || '#64748B'}
                                  size="sm"
                                  active={isEditingCat}
                                />
                              </button>

                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                  {item.note}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      cancelAutoSave();
                                      setEditingCatItemId((prev) =>
                                        prev === item.id ? null : item.id,
                                      );
                                    }}
                                    className="font-bold hover:underline cursor-pointer"
                                    style={{ color: cat?.color }}
                                  >
                                    {cat?.shortName || 'Khác'}
                                  </button>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() => cycleMemberForItem(item)}
                                    className="inline-flex items-center gap-0.5 font-bold hover:underline cursor-pointer"
                                    style={{ color: mem.color }}
                                    title="Chạm đổi thành viên"
                                  >
                                    <DynamicIcon name={mem.icon} size={10} />
                                    {mem.name}
                                  </button>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <Calendar size={10} />
                                    {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-sm font-extrabold tabular-nums ${
                                  item.amount > 0
                                    ? item.type === 'income'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-900 dark:text-white'
                                    : 'text-amber-500'
                                }`}
                              >
                                {item.amount > 0 ? formatVND(item.amount) : 'Chưa rõ'}
                              </span>

                              {isMultiBatch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    cancelAutoSave();
                                    setExcludedIds((prev) => [...prev, item.id]);
                                  }}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                                  aria-label="Bỏ khoản này"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline 1-Tap Category Switcher Strip */}
                          {isEditingCat && (
                            <div className="border-t border-slate-100 dark:border-white/[0.07] animate-ios-fade">
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-2 bg-slate-50/70 dark:bg-[#0b1019]">
                                {availableCats.map((c) => {
                                  const active = c.id === item.categoryId;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => setCategoryForItem(item.id, c.id)}
                                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                        active
                                          ? 'text-white border-transparent'
                                          : 'bg-white dark:bg-[#141b29] text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-white/[0.08]'
                                      }`}
                                      style={active ? { backgroundColor: c.color } : undefined}
                                    >
                                      <DynamicIcon
                                        name={c.icon}
                                        size={11}
                                        style={!active ? { color: c.color } : undefined}
                                      />
                                      <span>{c.shortName}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clickable Sample Phrases */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Câu mẫu
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_SAMPLE_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => {
                        cancelAutoSave();
                        setTranscript(phrase);
                        setAiItems(null);
                        setOverrides({});
                        setExcludedIds([]);
                        setEditingCatItemId(null);
                        setError('');
                      }}
                      className="text-left px-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-violet-300 transition-colors cursor-pointer"
                    >
                      &ldquo;{phrase}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pinned Footer — solid surface, zero backdrop-blur cost on iOS */}
            <div className="px-5 pt-2.5 pb-safe border-t border-slate-100 dark:border-white/[0.07] bg-white dark:bg-[#0e131e]">
              <div className={`grid gap-2.5 ${isMultiBatch ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!isMultiBatch && (
                  <button
                    type="button"
                    disabled={!singleItem}
                    onClick={() => {
                      if (!singleItem) return;
                      cancelAutoSave();
                      const draft = buildDraftFromItem(singleItem);
                      onClose();
                      onEditDraft(draft);
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 text-xs font-bold disabled:opacity-40 active:scale-96 transition-transform duration-100 cursor-pointer"
                  >
                    <Edit3 size={15} />
                    <span>Chỉnh sửa</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={validItems.length === 0}
                  onClick={handleSaveAll}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 active:scale-96 transition-transform duration-100 cursor-pointer"
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {isMultiBatch
                      ? `Lưu cả ${validItems.length} khoản (${formatVND(totalBatchAmount)})`
                      : 'Lưu giao dịch'}
                  </span>
                </button>
              </div>
            </div>
      </div>
    </div>
  );
};
