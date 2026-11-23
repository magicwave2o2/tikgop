import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  Check,
  Edit3,
  Layers,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../store/useFinanceStore';
import type { TransactionDraft } from '../types/finance';
import { formatVND, pad2 } from '../utils/format';
import {
  VOICE_SAMPLE_PHRASES,
  type VoiceParseResult,
  parseVietnameseVoiceBatch,
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

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  open,
  onClose,
  onEditDraft,
}) => {
  const { state, activeMember, addTransactionsBatch } = useFinance();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isSpeechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const isInAppBrowser = useMemo(() => detectInAppWebView(), []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((silentFail = false) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      if (!silentFail) {
        setError(
          isInAppBrowser
            ? 'Trình duyệt trong Zalo/Facebook hạn chế Micro. Hãy mở bằng Chrome/Safari hoặc gõ/chọn câu mẫu bên dưới!'
            : 'Trình duyệt hiện tại không hỗ trợ Web Speech API. Bạn vẫn có thể gõ hoặc chạm câu mẫu tiếng Việt bên dưới!',
        );
      }
      return;
    }

    setError('');
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
        setTranscript(combined.trim());
        setExcludedIds([]);
      };

      rec.onerror = (event) => {
        setIsListening(false);
        if (silentFail) return;
        if (event.error === 'not-allowed') {
          setError(
            'Bạn chưa cấp quyền Micro. Vui lòng bật quyền Micro cho trang này hoặc nhập câu tự nhiên bên dưới.',
          );
        } else if (event.error === 'no-speech') {
          setError('Không nghe thấy giọng nói. Hãy bấm Micro và thử nói lại rõ hơn.');
        } else if (event.error !== 'aborted') {
          setError(
            `Không thể nhận diện giọng nói (${event.error}). Bạn có thể thử lại hoặc nhập trực tiếp.`,
          );
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      if (!silentFail) {
        setError('Không thể khởi động Micro. Bạn có thể gõ câu tiếng Việt tự nhiên bên dưới.');
      }
      setIsListening(false);
    }
  }, [isInAppBrowser]);

  // Auto-listen immediately when modal opens (silent fallback if browser requires tap)
  useEffect(() => {
    if (!open) {
      stopListening();
      setTranscript('');
      setExcludedIds([]);
      setError('');
      return;
    }

    if (isSpeechSupported && !isInAppBrowser) {
      const timer = window.setTimeout(() => {
        startListening(true);
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [open, isSpeechSupported, isInAppBrowser, startListening, stopListening]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening(false);
  };

  const parsedItems = useMemo<VoiceParseResult[]>(() => {
    if (!transcript.trim()) return [];
    return parseVietnameseVoiceBatch(
      transcript,
      state.categories,
      state.members,
      activeMember.id,
    );
  }, [transcript, state.categories, state.members, activeMember.id]);

  const activeItems = useMemo(
    () => parsedItems.filter((item) => !excludedIds.includes(item.id)),
    [parsedItems, excludedIds],
  );

  const validItems = useMemo(
    () => activeItems.filter((item) => item.amount > 0),
    [activeItems],
  );

  const totalBatchAmount = useMemo(
    () => validItems.reduce((sum, i) => sum + i.amount, 0),
    [validItems],
  );

  const catMap = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c])),
    [state.categories],
  );
  const memMap = useMemo(
    () => new Map(state.members.map((m) => [m.id, m])),
    [state.members],
  );

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

  const handleSaveAll = () => {
    if (validItems.length === 0) {
      setError(
        'Chưa nhận diện được số tiền. Hãy nói rõ số tiền (vd: "4 chục", "1 lít 2", "450 nghìn").',
      );
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
  };

  const isMultiBatch = activeItems.length >= 2;
  const singleItem = activeItems[0] || null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.85 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white dark:bg-[#141923] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Mic size={19} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  Nhập bằng giọng nói
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Interactive Pulsing Microphone Stage */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <>
                      <motion.span
                        initial={{ scale: 1, opacity: 0.55 }}
                        animate={{ scale: 1.85, opacity: 0 }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute w-20 h-20 rounded-full bg-violet-500/35 pointer-events-none"
                      />
                      <motion.span
                        initial={{ scale: 1, opacity: 0.45 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{
                          duration: 1.4,
                          delay: 0.45,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }}
                        className="absolute w-20 h-20 rounded-full bg-emerald-500/35 pointer-events-none"
                      />
                    </>
                  )}

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={toggleListening}
                    className={`relative z-10 w-18 h-18 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
                      isListening
                        ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/40'
                        : 'bg-gradient-to-tr from-violet-600 via-indigo-500 to-emerald-500 shadow-violet-500/35'
                    }`}
                    aria-label={isListening ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                  >
                    {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                  </motion.button>
                </div>

                <div className="h-6 flex items-center justify-center gap-1 mt-2.5">
                  {isListening ? (
                    <>
                      {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                        <motion.span
                          key={idx}
                          animate={{ height: [5, 20 - Math.abs(3 - idx) * 2.5, 7] }}
                          transition={{
                            duration: 0.52,
                            delay: idx * 0.08,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-emerald-400"
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

              {isInAppBrowser && !error && (
                <div className="flex items-start gap-2 p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-medium">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Bạn đang mở từ Zalo/Facebook — nếu Micro không bật, hãy mở link bằng Chrome hoặc Safari để dùng giọng nói tốt nhất.
                  </span>
                </div>
              )}

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
                    setTranscript(e.target.value);
                    setExcludedIds([]);
                    setError('');
                  }}
                  placeholder="Ví dụ: Mua thịt 120k, rau 4 chục..."
                  className="w-full px-4 py-3 pr-9 rounded-2xl text-sm font-semibold bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-500 resize-none"
                />
                {transcript && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript('');
                      setExcludedIds([]);
                    }}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Xóa nội dung"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Instant Live NLP Extraction Preview — Supports BOTH Single & Multi-Item Batch! */}
              {activeItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-3xl bg-gradient-to-br from-violet-500/8 via-emerald-500/6 to-teal-500/8 border border-emerald-500/25 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {isMultiBatch ? <Layers size={13} /> : <Sparkles size={13} />}
                      <span>
                        {isMultiBatch
                          ? `Tự động tách ${activeItems.length} khoản chi`
                          : 'Tự động bóc tách thông minh'}
                      </span>
                    </span>

                    {isMultiBatch ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold tabular-nums">
                        Tổng {formatVND(totalBatchAmount)}
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

                  {/* Extracted Items List */}
                  <div className="space-y-2">
                    {activeItems.map((item) => {
                      const cat = catMap.get(item.categoryId);
                      const mem = memMap.get(item.memberId) || activeMember;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CategoryIconBadge
                              icon={cat?.icon || 'MoreHorizontal'}
                              color={cat?.color || '#64748B'}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {item.note}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                                <span>{cat?.shortName || 'Khác'}</span>
                                <span>•</span>
                                <span
                                  className="inline-flex items-center gap-0.5 font-bold"
                                  style={{ color: mem.color }}
                                >
                                  <DynamicIcon name={mem.icon} size={10} />
                                  {mem.name}
                                </span>
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
                                onClick={() => setExcludedIds((prev) => [...prev, item.id])}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                                aria-label="Bỏ khoản này"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Clickable Sample Phrases (including multi-item & colloquial Vietnamese slang!) */}
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
                        setTranscript(phrase);
                        setExcludedIds([]);
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

            {/* Pinned Footer */}
            <div className="px-5 pt-2.5 pb-safe border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#141923]/95">
              <div className={`grid gap-2.5 ${isMultiBatch ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!isMultiBatch && (
                  <button
                    type="button"
                    disabled={!singleItem}
                    onClick={() => {
                      if (!singleItem) return;
                      const draft = buildDraftFromItem(singleItem);
                      onClose();
                      onEditDraft(draft);
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <Edit3 size={15} />
                    <span>Chỉnh sửa chi tiết</span>
                  </button>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={validItems.length === 0}
                  onClick={handleSaveAll}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 cursor-pointer"
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {isMultiBatch
                      ? `Lưu cả ${validItems.length} khoản (${formatVND(totalBatchAmount)})`
                      : 'Lưu giao dịch'}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
