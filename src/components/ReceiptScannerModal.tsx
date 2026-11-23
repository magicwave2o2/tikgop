import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  Check,
  Cloud,
  Cpu,
  Edit3,
  FileText,
  ImagePlus,
  Receipt,
  RefreshCw,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react';
import { useFinance } from '../store/useFinanceStore';
import type { TransactionDraft } from '../types/finance';
import {
  formatCompactVND,
  formatRawAmount,
  formatVND,
  pad2,
  parseRawAmount,
} from '../utils/format';
import {
  type DemoReceiptPreset,
  type ReceiptParseResult,
  generateDemoReceiptImage,
  scanReceiptSmart,
} from '../utils/receiptParser';
import { saveReceiptImage } from '../utils/receiptStorage';
import { CategoryIconBadge, DynamicIcon } from './IconRenderer';

interface ReceiptScannerModalProps {
  open: boolean;
  onClose: () => void;
  onEditDraft: (draft: TransactionDraft) => void;
}

const DEMO_RECEIPTS: Array<{
  id: DemoReceiptPreset;
  title: string;
  sub: string;
  amountHint: string;
}> = [
  { id: 'winmart', title: 'Siêu thị WinMart', sub: 'Thực phẩm tươi', amountHint: '385k' },
  { id: 'coffee', title: 'Highlands Coffee', sub: 'Cà phê & bánh', amountHint: '125k' },
  { id: 'evn', title: 'Tiền điện EVN', sub: 'Hóa đơn điện', amountHint: '1,42tr' },
  { id: 'bank', title: 'Chuyển khoản VCB', sub: 'Nhà thuốc Long Châu', amountHint: '350k' },
];

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  open,
  onClose,
  onEditDraft,
}) => {
  const { state, activeMember, addTransaction } = useFinance();

  const [step, setStep] = useState<'idle' | 'camera' | 'scanning' | 'result'>('idle');
  const [preferAI, setPreferAI] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  // Editable result fields right inside the result review screen (zero extra clicks!)
  const [result, setResult] = useState<ReceiptParseResult | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('other_expense');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(activeMember.id);
  const [showRawText, setShowRawText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const expenseCategories = state.categories.filter((c) => c.type === 'expense');

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopCameraStream();
      setStep('idle');
      setPreviewUrl('');
      setProgress(0);
      setStatusText('');
      setError('');
      setResult(null);
      setShowRawText(false);
    } else {
      setSelectedMemberId(activeMember.id);
    }
  }, [open, activeMember.id]);

  useEffect(() => {
    return () => stopCameraStream();
  }, []);

  const runOCRScan = async (source: File | Blob | string, displayUrl: string) => {
    stopCameraStream();
    setError('');
    setPreviewUrl(displayUrl);
    setStep('scanning');
    setProgress(8);
    setStatusText('Đang chuẩn bị ảnh hóa đơn...');

    try {
      const parsed = await scanReceiptSmart(
        source,
        state.categories,
        { preferAI },
        (pct, label) => {
          setProgress(pct);
          setStatusText(label);
        },
      );
      setResult(parsed);
      setAmountInput(parsed.amount > 0 ? formatRawAmount(String(parsed.amount)) : '');
      setNoteInput(parsed.note);
      setSelectedCategoryId(parsed.categoryId);
      setStep('result');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể quét hóa đơn. Vui lòng thử ảnh rõ nét hơn hoặc thử lại.',
      );
      setStep('idle');
    }
  };

  const handleOpenLiveCamera = async () => {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      nativeCameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setStep('camera');
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      nativeCameraInputRef.current?.click();
    }
  };

  const handleCapturePhotoFromCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    void runOCRScan(dataUrl, dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    void runOCRScan(file, objUrl);
    e.target.value = '';
  };

  const handleRunDemoReceipt = (preset: DemoReceiptPreset) => {
    const dataUrl = generateDemoReceiptImage(preset);
    if (!dataUrl) return;
    void runOCRScan(dataUrl, dataUrl);
  };

  const selectedAmount = parseRawAmount(amountInput);

  const buildDraft = async (): Promise<TransactionDraft> => {
    const now = new Date();
    const receiptRef = result?.thumbnailDataUrl
      ? await saveReceiptImage(result.thumbnailDataUrl)
      : undefined;

    return {
      type: 'expense',
      amount: selectedAmount,
      categoryId: selectedCategoryId || 'other_expense',
      memberId: selectedMemberId,
      date: result?.date,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      note: noteInput.trim() || result?.note || 'Hóa đơn đã quét',
      paymentMethod: result?.paymentMethod || 'bank',
      receiptImage: receiptRef,
      source: 'receipt',
    };
  };

  const handleSaveDirectly = async () => {
    if (!result || selectedAmount <= 0) {
      setError('Vui lòng nhập hoặc chọn số tiền hợp lệ lớn hơn 0.');
      return;
    }
    const draft = await buildDraft();
    addTransaction({
      type: 'expense',
      amount: draft.amount || 0,
      categoryId: draft.categoryId || 'other_expense',
      memberId: draft.memberId || activeMember.id,
      date: draft.date || new Date().toISOString().slice(0, 10),
      time: draft.time || '12:00',
      note: draft.note || 'Chi tiêu từ hóa đơn',
      paymentMethod: draft.paymentMethod || 'bank',
      receiptImage: draft.receiptImage,
      source: 'receipt',
    });
    onClose();
  };

  const handleOpenInFullEditor = async () => {
    const draft = await buildDraft();
    onClose();
    onEditDraft(draft);
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
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ScanLine size={19} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  Quét hóa đơn
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

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: IDLE */}
              {step === 'idle' && (
                <div className="space-y-4">
                  {/* Engine mode selector */}
                  <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setPreferAI(true)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        preferAI
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Cloud size={14} />
                      <span>Cloudflare AI Vision</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferAI(false)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !preferAI
                          ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Cpu size={14} />
                      <span>OCR Offline trên máy</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void handleOpenLiveCamera()}
                      className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Camera size={24} />
                      </div>
                      <span className="text-sm font-extrabold">Chụp hóa đơn</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-emerald-400 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
                        <ImagePlus size={24} />
                      </div>
                      <span className="text-sm font-extrabold">Chọn ảnh bill</span>
                    </motion.button>
                  </div>

                  {/* Demo Receipts */}
                  <div className="p-4 rounded-3xl bg-slate-50/90 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Sparkles size={14} className="text-amber-500" />
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                        Hóa đơn mẫu
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DEMO_RECEIPTS.map((demo) => (
                        <motion.button
                          key={demo.id}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRunDemoReceipt(demo.id)}
                          className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 hover:border-emerald-500 text-left transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Receipt size={14} className="text-emerald-500" />
                            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {demo.amountHint}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
                            {demo.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {demo.sub}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: LIVE CAMERA */}
              {step === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-[3/4] max-h-[55dvh] mx-auto">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-6 border-2 border-white/25 rounded-2xl">
                      <div className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                      <div className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                      <div className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraStream();
                        setStep('idle');
                      }}
                      className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={handleCapturePhotoFromCamera}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/30 cursor-pointer"
                    >
                      <Camera size={18} />
                      <span>Chụp & Quét hóa đơn</span>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* STEP 3: SCANNING */}
              {step === 'scanning' && (
                <div className="space-y-4 py-2">
                  <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 max-h-64 flex items-center justify-center">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Hóa đơn đang quét"
                        className="max-h-64 w-auto object-contain opacity-90"
                      />
                    )}
                    <motion.div
                      initial={{ top: '6%' }}
                      animate={{ top: ['6%', '88%', '6%'] }}
                      transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-x-3 h-1 rounded-full bg-emerald-400 shadow-[0_0_20px_5px_rgba(16,185,129,0.75)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">{statusText}</span>
                      <span className="tabular-nums text-slate-500">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.25 }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: INLINE-EDITABLE RESULT REVIEW */}
              {step === 'result' && result && (
                <div className="space-y-3.5">
                  {/* Engine Indicator Pill */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        result.engine === 'cloudflare-ai'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {result.engine === 'cloudflare-ai' ? (
                        <>
                          <Cloud size={12} />
                          <span>Cloudflare AI Vision</span>
                        </>
                      ) : (
                        <>
                          <Cpu size={12} />
                          <span>OCR Ngoại tuyến trên máy</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      Ngày bill: {result.date}
                    </span>
                  </div>

                  {/* Thumbnail + Directly Editable Amount & Note */}
                  <div className="flex items-start gap-3 p-3.5 rounded-3xl bg-emerald-500/8 border border-emerald-500/25">
                    {result.thumbnailDataUrl && (
                      <img
                        src={result.thumbnailDataUrl}
                        alt="Ảnh hóa đơn"
                        className="w-16 h-22 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Tổng tiền
                        </label>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={amountInput}
                            onChange={(e) => {
                              setAmountInput(formatRawAmount(e.target.value));
                              setError('');
                            }}
                            placeholder="0"
                            className="w-full bg-white/80 dark:bg-slate-900/70 px-2.5 py-1 rounded-xl text-xl font-extrabold text-slate-900 dark:text-white tabular-nums border border-emerald-500/30 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-base font-extrabold text-slate-500">₫</span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Ghi chú hóa đơn..."
                        className="w-full bg-white/80 dark:bg-slate-900/70 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Alternative detected amounts pills */}
                  {result.candidateAmounts.length > 1 && (
                    <div>
                      <span className="block text-[10.5px] font-bold text-slate-400 mb-1.5">
                        Số tiền khác:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {result.candidateAmounts.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAmountInput(formatRawAmount(String(amt)))}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold tabular-nums transition-all cursor-pointer ${
                              selectedAmount === amt
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15'
                            }`}
                          >
                            {formatCompactVND(amt)} ({formatVND(amt, { showUnit: false })})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline 1-Tap Category Strip */}
                  <div>
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Phân loại
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                      {expenseCategories.map((cat) => {
                        const active = selectedCategoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              active
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                            }`}
                          >
                            <CategoryIconBadge
                              icon={cat.icon}
                              color={cat.color}
                              size="sm"
                              active={active}
                              className="!w-6 !h-6 !rounded-lg"
                            />
                            <span>{cat.shortName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inline Member Picker */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                      Người chi tiêu
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {state.members.map((m) => {
                        const active = selectedMemberId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMemberId(m.id)}
                            className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              active
                                ? 'text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                            }`}
                            style={active ? { backgroundColor: m.color } : undefined}
                          >
                            <DynamicIcon name={m.icon} size={11} />
                            <span className="truncate">{m.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collapsible raw text */}
                  {result.rawText && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowRawText((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>{showRawText ? 'Ẩn nội dung đã đọc' : 'Xem nội dung đọc được từ bill'}</span>
                      </button>
                      {showRawText && (
                        <pre className="mt-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-28 overflow-y-auto font-mono">
                          {result.rawText}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="grid grid-cols-12 gap-2 pt-1 pb-safe">
                    <button
                      type="button"
                      onClick={() => setStep('idle')}
                      className="col-span-2 flex items-center justify-center py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Quét lại"
                    >
                      <RefreshCw size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleOpenInFullEditor()}
                      className="col-span-4 flex items-center justify-center gap-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Edit3 size={14} />
                      <span>Chi tiết</span>
                    </button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void handleSaveDirectly()}
                      disabled={selectedAmount <= 0}
                      className="col-span-6 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 cursor-pointer"
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>
                        {selectedAmount > 0 ? `Lưu • ${formatCompactVND(selectedAmount)}` : 'Lưu ngay'}
                      </span>
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
