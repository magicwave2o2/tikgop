import type { Category, PaymentMethod } from '../types/finance';
import {
  detectCategoryFromText,
  detectPaymentMethodFromText,
  normalizeVietnamese,
} from './categoryClassifier';
import { getToday, pad2, toDateKey } from './format';

export interface ReceiptParseResult {
  amount: number;
  candidateAmounts: number[];
  date: string;
  merchant: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note: string;
  rawText: string;
  thumbnailDataUrl: string;
}

export type DemoReceiptPreset = 'winmart' | 'coffee' | 'evn';

/**
 * Generates a realistic Vietnamese receipt image on an offscreen canvas so users
 * can test the REAL client-side Tesseract OCR & total extraction pipeline anytime.
 */
export function generateDemoReceiptImage(preset: DemoReceiptPreset): string {
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 820;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const today = getToday();
  const dateStr = `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;

  // Clean thermal paper white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  const configs: Record<
    DemoReceiptPreset,
    {
      store: string;
      subtitle: string;
      items: Array<[string, string]>;
      total: string;
      paid: string;
      payment: string;
    }
  > = {
    winmart: {
      store: 'SIEU THI WINMART',
      subtitle: 'HOA DON BAN LE - THUC PHAM TUOI',
      items: [
        ['Thit heo ba chi 600g', '115.000'],
        ['Ca hoi phi le tuoi', '145.000'],
        ['Rau cai ngot & ca chua', '48.000'],
        ['Sua tuoi Vinamilk 1L x2', '77.000'],
      ],
      total: '385.000',
      paid: '400.000',
      payment: 'Thanh toan: Chuyen khoan VietQR',
    },
    coffee: {
      store: 'HIGHLANDS COFFEE',
      subtitle: 'HOA DON THANH TOAN',
      items: [
        ['Phin Sua Da (Lon)', '45.000'],
        ['Tra Sen Vang (Vua)', '45.000'],
        ['Banh Mi Que Pate', '35.000'],
      ],
      total: '125.000',
      paid: '200.000',
      payment: 'Thanh toan: Vi dien tu MoMo',
    },
    evn: {
      store: 'DIEN LUC EVN HANOI',
      subtitle: 'GIAY BAO TIEN DIEN SINH HOAT',
      items: [
        ['Chi so cu: 14.210 kWh', ''],
        ['Chi so moi: 14.695 kWh', ''],
        ['Dien nang tieu thu: 485 kWh', '1.314.815'],
        ['Thue GTGT (8%)', '105.185'],
      ],
      total: '1.420.000',
      paid: '1.420.000',
      payment: 'Thanh toan: Chuyen khoan Ngan hang',
    },
  };

  const data = configs[preset];

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText(data.store, canvas.width / 2, 92);

  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText(data.subtitle, canvas.width / 2, 134);

  ctx.font = '19px "Courier New", monospace';
  ctx.fillText(`Ngay: ${dateStr}   Gio: 18:15`, canvas.width / 2, 174);
  ctx.fillText('------------------------------------------', canvas.width / 2, 212);

  ctx.textAlign = 'left';
  ctx.font = '21px "Courier New", monospace';
  let y = 264;
  for (const [name, price] of data.items) {
    ctx.fillText(name, 52, y);
    if (price) {
      ctx.textAlign = 'right';
      ctx.fillText(price, canvas.width - 52, y);
      ctx.textAlign = 'left';
    }
    y += 56;
  }

  ctx.textAlign = 'center';
  ctx.font = '19px "Courier New", monospace';
  ctx.fillText('------------------------------------------', canvas.width / 2, y + 14);

  y += 74;
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillText('TONG CONG:', 52, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${data.total} VND`, canvas.width - 52, y);

  y += 58;
  ctx.textAlign = 'left';
  ctx.font = '20px "Courier New", monospace';
  ctx.fillText('Tien khach dua:', 52, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${data.paid} VND`, canvas.width - 52, y);

  y += 56;
  ctx.textAlign = 'center';
  ctx.font = '19px "Courier New", monospace';
  ctx.fillText(data.payment, canvas.width / 2, y);
  ctx.fillText('Cam on quy khach! Hen gap lai.', canvas.width / 2, y + 48);

  return canvas.toDataURL('image/png');
}

/**
 * Preprocesses a receipt photo on canvas:
 * 1) Generates a compact thumbnail for storing inside transaction history.
 * 2) Generates a contrast-enhanced grayscale image for sharper Tesseract OCR accuracy.
 */
async function preprocessReceiptImage(
  source: File | Blob | string,
): Promise<{ ocrImageDataUrl: string; thumbnailDataUrl: string }> {
  const imgUrl = typeof source === 'string' ? source : URL.createObjectURL(source);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể đọc hình ảnh hóa đơn.'));
      el.src = imgUrl;
    });

    // 1. Compact thumbnail for localStorage (max 560px)
    const thumbScale = Math.min(1, 560 / Math.max(img.width, img.height));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.max(1, Math.round(img.width * thumbScale));
    thumbCanvas.height = Math.max(1, Math.round(img.height * thumbScale));
    const tCtx = thumbCanvas.getContext('2d');
    tCtx?.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.68);

    // 2. OCR enhanced image (scale up small images or cap large ones around 1300px)
    const targetWidth = img.width < 800 ? Math.min(1200, img.width * 1.5) : Math.min(1400, img.width);
    const ocrScale = targetWidth / img.width;
    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = Math.max(1, Math.round(img.width * ocrScale));
    ocrCanvas.height = Math.max(1, Math.round(img.height * ocrScale));
    const oCtx = ocrCanvas.getContext('2d');

    if (oCtx) {
      oCtx.drawImage(img, 0, 0, ocrCanvas.width, ocrCanvas.height);
      const imageData = oCtx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
      const d = imageData.data;
      // Grayscale + gentle contrast boost for thermal ink receipts
      const contrast = 1.32;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const boosted = Math.max(0, Math.min(255, (gray - 128) * contrast + 135));
        d[i] = boosted;
        d[i + 1] = boosted;
        d[i + 2] = boosted;
      }
      oCtx.putImageData(imageData, 0, 0);
    }

    return {
      ocrImageDataUrl: ocrCanvas.toDataURL('image/png'),
      thumbnailDataUrl,
    };
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(imgUrl);
    }
  }
}

/**
 * Extracts all plausible VND currency numbers from a single OCR text line.
 */
function extractAmountsFromLine(line: string): number[] {
  const results: number[] = [];
  // Normalize common OCR digit confusions inside numeric groups (O->0, l/I->1)
  const cleaned = line
    .replace(/(\d)[oO](\d)/g, '$10$2')
    .replace(/(\d)[.,]\s*(\d{3})/g, '$1.$2');

  // Match formatted currency values: 1.420.000, 385.000, 125,000, 48 000, 125k
  const matches = cleaned.matchAll(
    /(?<!\d)(\d{1,3}(?:[.,\s]\d{3})+|\d{4,8})\s*(?:đ|d|vnd|vnđ)?(?!\d)/gi,
  );

  for (const m of matches) {
    const raw = m[1].replace(/[.,\s]/g, '');
    // Reject phone numbers starting with 0 (e.g., 0912345678) or years
    if (raw.startsWith('0')) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    if (num < 1_000 || num > 500_000_000) continue;
    if (num >= 2020 && num <= 2035) continue;
    // Reject likely barcodes or invoice IDs (> 100M and not rounded to 100)
    if (num > 50_000_000 && num % 500 !== 0) continue;
    results.push(num);
  }

  return results;
}

/**
 * Parses raw OCR receipt text into structured Vietnamese expense fields.
 */
export function parseReceiptText(
  rawText: string,
  categories: Category[],
  thumbnailDataUrl: string,
): ReceiptParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const scoredCandidates = new Map<number, number>();

  const totalHighCues = [
    'tong thanh toan',
    'phai thanh toan',
    'khach phai tra',
    'tong cong',
    'tong tien',
    'grand total',
    'amount due',
    'total due',
    'total',
  ];
  const totalMedCues = ['thanh tien', 'cong tien', 'subtotal', 'thanh toan'];
  const ignoreCues = [
    'tien khach dua',
    'khach dua',
    'tien thua',
    'tra lai',
    'change',
    'giam gia',
    'chiet khau',
    'ma so thue',
    'mst',
    'hotline',
    'dien thoai',
    'tel',
    'chi so cu',
    'chi so moi',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const norm = normalizeVietnamese(line);
    if (ignoreCues.some((cue) => norm.includes(cue))) continue;

    // Also inspect next line in case OCR wrapped the price below the "TONG CONG" label
    const amounts = extractAmountsFromLine(line);
    const isHigh = totalHighCues.some((cue) => norm.includes(cue));
    const isMed = !isHigh && totalMedCues.some((cue) => norm.includes(cue));

    if ((isHigh || isMed) && amounts.length === 0 && lines[i + 1]) {
      const nextAmts = extractAmountsFromLine(lines[i + 1]);
      for (const a of nextAmts) {
        const score = isHigh ? 110 : 75;
        scoredCandidates.set(a, Math.max(scoredCandidates.get(a) || 0, score));
      }
    }

    for (const amt of amounts) {
      let score = 20;
      if (isHigh) score = 120;
      else if (isMed) score = 80;
      // Totals usually sit in the lower half of the receipt
      if (i >= Math.floor(lines.length * 0.45)) score += 15;
      // Round VND numbers (divisible by 500 or 1000) are much more likely to be real prices
      if (amt % 1000 === 0) score += 12;
      else if (amt % 500 === 0) score += 6;

      scoredCandidates.set(amt, Math.max(scoredCandidates.get(amt) || 0, score));
    }
  }

  // Sort candidate amounts by score first, then magnitude
  const ranked = Array.from(scoredCandidates.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([amt]) => amt);

  const amount = ranked[0] || 0;
  const candidateAmounts = ranked.slice(0, 4);

  // Extract date DD/MM/YYYY or DD-MM-YYYY
  let date = toDateKey(getToday());
  const dateMatch = rawText.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dateMatch) {
    const d = Number(dateMatch[1]);
    const m = Number(dateMatch[2]);
    const y = Number(dateMatch[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      date = `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }

  // Extract store/merchant name from top clean lines
  const merchantLine =
    lines.find((l) => {
      const norm = normalizeVietnamese(l);
      return (
        l.length >= 4 &&
        l.length <= 44 &&
        !/^[-=*_.\s\d:/]+$/.test(l) &&
        !norm.includes('hoa don') &&
        !norm.includes('ngay') &&
        !norm.includes('gio')
      );
    }) || '';

  const merchant = merchantLine
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s.&'-]/g, '')
    .trim()
    .slice(0, 38);

  const categoryId = detectCategoryFromText(rawText, 'expense', categories);
  const paymentMethod = detectPaymentMethodFromText(rawText) || 'bank';

  const catObj = categories.find((c) => c.id === categoryId);
  const note = merchant
    ? `Hóa đơn ${merchant}`
    : catObj
      ? `Hóa đơn ${catObj.name}`
      : 'Chi tiêu từ hóa đơn';

  return {
    amount,
    candidateAmounts,
    date,
    merchant,
    categoryId,
    paymentMethod,
    note,
    rawText,
    thumbnailDataUrl,
  };
}

/**
 * Full client-side OCR scan pipeline powered by Tesseract.js.
 */
export async function scanReceiptWithOCR(
  source: File | Blob | string,
  categories: Category[],
  onProgress?: (pct: number, statusLabel: string) => void,
): Promise<ReceiptParseResult> {
  onProgress?.(10, 'Đang tối ưu độ nét ảnh hóa đơn...');
  const { ocrImageDataUrl, thumbnailDataUrl } = await preprocessReceiptImage(source);

  onProgress?.(25, 'Đang khởi động bộ đọc OCR thông minh...');
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('vie', 1, {
    logger: (m) => {
      if (m.status === 'loading tesseract core') {
        onProgress?.(32, 'Đang tải lõi nhận diện chữ...');
      } else if (m.status === 'loading language traineddata') {
        onProgress?.(45, 'Đang tải gói ngôn ngữ tiếng Việt...');
      } else if (m.status === 'recognizing text') {
        const pct = Math.min(94, 52 + Math.round((m.progress || 0) * 42));
        onProgress?.(pct, 'Đang quét chữ & tách giá tiền trên hóa đơn...');
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(ocrImageDataUrl);

    onProgress?.(98, 'Đang tự động phân loại & trích xuất tổng tiền...');
    const parsed = parseReceiptText(text || '', categories, thumbnailDataUrl);
    onProgress?.(100, 'Hoàn tất quét hóa đơn!');
    return parsed;
  } finally {
    await worker.terminate();
  }
}
