import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  Check,
  Edit3,
  Mic,
  MicOff,
  Sparkles,
  X,
} from 'lucide-react';
import { useFinance } from '../store/useFinanceStore';
import type { TransactionDraft } from '../types/finance';
import { formatVND, pad2 } from '../utils/format';
import { VOICE_SAMPLE_PHRASES, parseVietnameseVoiceExpense } from '../utils/voiceParser';
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

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  open,
  onClose,
  onEditDraft,
}) => {
  const { state, activeMember, addTransaction } = useFinance();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isSpeechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (!open) {
      stopListening();
      setTranscript('');
      setError('');
    }
  }, [open]);

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
    if (isListening) {
      stopListening();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError(
        'Trình duyệt hiện tại không hỗ trợ Web Speech API. Bạn vẫn có thể gõ hoặc chạm câu mẫu tiếng Việt bên dưới để tự động trích xuất!',
      );
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
      };

      rec.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('Bạn chưa cấp quyền Micro. Vui lòng cho phép micro trên trình duyệt hoặc dùng câu mẫu bên dưới.');
        } else if (event.error === 'no-speech') {
          setError('Không nghe thấy giọng nói. Hãy bấm micro và thử nói lại rõ hơn.');
        } else if (event.error !== 'aborted') {
          setError(`Lỗi nhận diện giọng nói (${event.error}). Bạn có thể thử lại hoặc nhập trực tiếp.`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setError('Không thể khởi động Micro. Bạn có thể gõ câu tiếng Việt tự nhiên bên dưới.');
      setIsListening(false);
    }
  };

  const parsed = useMemo(() => {
    if (!transcript.trim()) return null;
    return parseVietnameseVoiceExpense(
      transcript,
      state.categories,
      state.members,
      activeMember.id,
    );
  }, [transcript, state.categories, state.members, activeMember.id]);

  const matchedCategory = state.categories.find((c) => c.id === parsed?.categoryId);
  const matchedMember = state.members.find((m) => m.id === parsed?.memberId) || activeMember;

  const buildDraft = (): TransactionDraft => {
    const now = new Date();
    return {
      type: parsed?.type || 'expense',
      amount: parsed?.amount || 0,
      categoryId: parsed?.categoryId || 'other_expense',
      memberId: parsed?.memberId || activeMember.id,
      date: parsed?.date,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      note: parsed?.note || transcript.trim(),
      paymentMethod: parsed?.paymentMethod || 'cash',
      source: 'voice',
    };
  };

  const handleSaveDirectly = () => {
    if (!parsed || parsed.amount <= 0) {
      setError('Chưa nhận diện được số tiền. Hãy nói rõ mức tiền (ví dụ: "450 nghìn" hoặc "120k").');
      return;
    }
    const draft = buildDraft();
    addTransaction({
      type: draft.type || 'expense',
      amount: draft.amount || 0,
      categoryId: draft.categoryId || 'other_expense',
      memberId: draft.memberId || activeMember.id,
      date: draft.date || new Date().toISOString().slice(0, 10),
      time: draft.time || '12:00',
      note: draft.note || transcript.trim(),
      paymentMethod: draft.paymentMethod || 'cash',
      source: 'voice',
    });
    onClose();
  };

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
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Nhập chi tiêu bằng Giọng nói
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Nói tự nhiên tiếng Việt • Tự hiểu người chi, danh mục & số tiền
                  </p>
                </div>
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
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Interactive Pulsing Microphone Stage */}
              <div className="flex flex-col items-center justify-center py-2">
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
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
                      isListening
                        ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/40'
                        : 'bg-gradient-to-tr from-violet-600 via-indigo-500 to-emerald-500 shadow-violet-500/35'
                    }`}
                    aria-label={isListening ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                  >
                    {isListening ? <MicOff size={30} /> : <Mic size={30} />}
                  </motion.button>
                </div>

                {/* Live Equalizer Bars while listening */}
                <div className="h-7 flex items-center justify-center gap-1 mt-3">
                  {isListening ? (
                    [0, 1, 2, 3, 4, 5, 6].map((idx) => (
                      <motion.span
                        key={idx}
                        animate={{ height: [6, 22 - Math.abs(3 - idx) * 3, 8] }}
                        transition={{
                          duration: 0.55,
                          delay: idx * 0.08,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-emerald-400"
                      />
                    ))
                  ) : (
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isSpeechSupported
                        ? 'Chạm Micro để nói tiếng Việt (vi-VN)'
                        : 'Gõ hoặc chạm câu mẫu tiếng Việt bên dưới'}
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
              <div>
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setError('');
                  }}
                  placeholder='Ví dụ: "Hôm nay Mẹ Trang đi siêu thị WinMart hết 450 nghìn"'
                  className="w-full px-4 py-3 rounded-2xl text-sm font-semibold bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              {/* Instant Live NLP Extraction Preview */}
              {parsed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-3xl bg-gradient-to-br from-violet-500/8 via-emerald-500/6 to-teal-500/8 border border-emerald-500/25 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={13} />
                      <span>Tự động bóc tách thông minh</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        parsed.type === 'income'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}
                    >
                      {parsed.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIconBadge
                        icon={matchedCategory?.icon || 'MoreHorizontal'}
                        color={matchedCategory?.color || '#64748B'}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {parsed.note}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {matchedCategory?.name || 'Chi khác'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-lg font-extrabold tabular-nums ${
                          parsed.amount > 0
                            ? parsed.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                            : 'text-amber-500'
                        }`}
                      >
                        {parsed.amount > 0 ? formatVND(parsed.amount) : 'Chưa rõ tiền'}
                      </div>
                    </div>
                  </div>

                  {/* Extracted Metadata Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-white"
                      style={{ backgroundColor: matchedMember.color }}
                    >
                      <DynamicIcon name={matchedMember.icon} size={12} />
                      <span>{matchedMember.name}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Calendar size={12} />
                      <span className="tabular-nums">{parsed.date}</span>
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Clickable Sample Phrases */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Mẫu câu nói nhanh (chạm để thử ngay)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_SAMPLE_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => {
                        setTranscript(phrase);
                        setError('');
                      }}
                      className="text-left px-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-violet-300 transition-colors cursor-pointer"
                    >
                      &ldquo;{phrase}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Footer */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 pb-safe">
                <button
                  type="button"
                  disabled={!parsed}
                  onClick={() => {
                    const draft = buildDraft();
                    onClose();
                    onEditDraft(draft);
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  <Edit3 size={15} />
                  <span>Chỉnh sửa chi tiết</span>
                </button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={!parsed || parsed.amount <= 0}
                  onClick={handleSaveDirectly}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 cursor-pointer"
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>Lưu giao dịch</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
