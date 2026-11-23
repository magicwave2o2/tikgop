import type { Category, FamilyMember, PaymentMethod, TransactionType } from '../types/finance';
import { addDays, getToday, pad2, toDateKey } from './format';
import {
  detectCategoryFromText,
  detectMemberFromText,
  detectPaymentMethodFromText,
  detectTransactionType,
  normalizeVietnamese,
} from './categoryClassifier';

export interface VoiceParseResult {
  id: string;
  transcript: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  memberId: string;
  memberMatched: boolean;
  date: string;
  paymentMethod: PaymentMethod;
  note: string;
}

const VI_WORD_DIGITS: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

const WORD_NUM_PATTERN =
  '(?:mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|muoi)(?:\\s+(?:muoi|lam|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin))?';

function parseVietnameseSmallNumber(phrase: string): number | null {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let i = 0;
  let matched = false;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'tram') {
      total = (total === 0 ? 1 : total) * 100;
      matched = true;
      i++;
      if (tokens[i] === 'ruoi') {
        total += 50;
        i++;
      }
      continue;
    }
    if (t === 'muoi') {
      if (total % 100 === 0) {
        total += 10;
      } else {
        const last = total % 10;
        total = total - last + last * 10;
      }
      matched = true;
      i++;
      if (tokens[i] === 'ruoi') {
        total += 5;
        i++;
      }
      continue;
    }
    if (t === 'le' || t === 'linh') {
      i++;
      continue;
    }
    if (t in VI_WORD_DIGITS) {
      const val = VI_WORD_DIGITS[t];
      if (tokens[i + 1] === 'tram') {
        total += val * 100;
        matched = true;
        i += 2;
        if (tokens[i] === 'ruoi') {
          total += 50;
          i++;
        }
        continue;
      }
      if (tokens[i + 1] === 'muoi') {
        total += val * 10;
        matched = true;
        i += 2;
        continue;
      }
      total += val;
      matched = true;
      i++;
      continue;
    }
    break;
  }

  return matched ? total : null;
}

/**
 * Extracts VND amount from natural Vietnamese speech, including regional slang:
 * - Standard: "1 triệu 450 nghìn", "1 triệu rưỡi", "1,5tr", "450k", "450 nghìn", "hai trăm rưỡi"
 * - Slang: "1 củ rưỡi", "hai củ ba" (1 củ = 1tr), "2 lít", "1 lít 2", "năm xị", "nửa lít" (1 lít/xị = 100k),
 *          "ba chục", "5 chục nghìn", "4 chục rưỡi" (1 chục = 10k)
 */
export function extractVietnameseAmount(rawText: string): number {
  const norm = normalizeVietnamese(rawText);

  // 1. Numeric triệu / củ patterns: "1 trieu 450 nghin", "1 cu ruoi", "1,5tr", "2 cu 3"
  const trieuNumeric = norm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|cu)\b\s*(?:(ruoi)|(\d{1,3})\s*(?:nghin|ngan|k)?)?/,
  );
  if (trieuNumeric) {
    const baseStr = trieuNumeric[1].replace(',', '.');
    let value = parseFloat(baseStr) * 1_000_000;
    if (trieuNumeric[2] === 'ruoi') {
      value += 500_000;
    } else if (trieuNumeric[3]) {
      const sub = trieuNumeric[3];
      if (sub.length === 1) value += Number(sub) * 100_000;
      else if (sub.length === 2) value += Number(sub) * 10_000;
      else value += Number(sub) * 1_000;
    }
    return Math.round(value);
  }

  // 2. Spoken word triệu / củ patterns: "mot trieu ruoi", "hai cu ba", "mot cu nam tram nghin"
  const trieuWord = norm.match(
    new RegExp(
      `\\b(${WORD_NUM_PATTERN})\\s+(?:trieu|cu)\\b(?:\\s+(ruoi)|(?:\\s+([a-z\\s]+?))(?:\\s+(?:nghin|ngan|dong)|$))?`,
    ),
  );
  if (trieuWord) {
    const main = parseVietnameseSmallNumber(trieuWord[1]) || 0;
    let total = main * 1_000_000;
    if (trieuWord[2] === 'ruoi') {
      total += 500_000;
    } else if (trieuWord[3]) {
      const subVal = parseVietnameseSmallNumber(trieuWord[3]);
      if (subVal !== null) {
        total += subVal < 10 ? subVal * 100_000 : subVal * 1_000;
      }
    }
    if (total > 0) return total;
  }

  // 3. Colloquial lít / xị (1 lít = 1 xị = 100.000 ₫; nửa lít/xị = 50.000 ₫)
  if (/\bnua\s+(?:lit|xi)\b/.test(norm)) {
    return 50_000;
  }

  const litNumeric = norm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:lit|xi)\b\s*(?:(ruoi)|(\d{1,2})\b)?/,
  );
  if (litNumeric) {
    let value = parseFloat(litNumeric[1].replace(',', '.')) * 100_000;
    if (litNumeric[2] === 'ruoi') {
      value += 50_000;
    } else if (litNumeric[3]) {
      const sub = litNumeric[3];
      value += sub.length === 1 ? Number(sub) * 10_000 : Number(sub) * 1_000;
    }
    return Math.round(value);
  }

  const litWord = norm.match(
    new RegExp(`\\b(${WORD_NUM_PATTERN})\\s+(?:lit|xi)\\b(?:\\s+(ruoi)|\\s+(${WORD_NUM_PATTERN})\\b)?`),
  );
  if (litWord) {
    const main = parseVietnameseSmallNumber(litWord[1]) || 0;
    let value = main * 100_000;
    if (litWord[2] === 'ruoi') {
      value += 50_000;
    } else if (litWord[3]) {
      const sub = parseVietnameseSmallNumber(litWord[3]);
      if (sub !== null && sub < 10) value += sub * 10_000;
    }
    if (value > 0) return value;
  }

  // 4. Colloquial chục (1 chục = 10.000 ₫: "4 chục", "ba chục nghìn", "5 chục rưỡi")
  const chucNumeric = norm.match(/(\d+)\s*chuc(?:\s*(ruoi))?(?:\s*(?:nghin|ngan|k))?\b/);
  if (chucNumeric) {
    let value = Number(chucNumeric[1]) * 10_000;
    if (chucNumeric[2] === 'ruoi') value += 5_000;
    if (value > 0) return value;
  }

  const chucWord = norm.match(
    new RegExp(`\\b(${WORD_NUM_PATTERN})\\s+chuc(?:\\s+(ruoi))?(?:\\s+(?:nghin|ngan))?\\b`),
  );
  if (chucWord) {
    const main = parseVietnameseSmallNumber(chucWord[1]) || 0;
    let value = main * 10_000;
    if (chucWord[2] === 'ruoi') value += 5_000;
    if (value > 0) return value;
  }

  // 5. Numeric nghìn / ngàn / k / trăm rưỡi
  const tramRuoiNumeric = norm.match(/(\d+)\s*tram\s*ruoi/);
  if (tramRuoiNumeric) {
    return (Number(tramRuoiNumeric[1]) * 100 + 50) * 1_000;
  }

  const nghinNumeric = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:nghin|ngan|k\b|ka\b)/);
  if (nghinNumeric) {
    const val = parseFloat(nghinNumeric[1].replace(',', '.'));
    return Math.round(val * 1_000);
  }

  // 6. Spoken word nghìn / ngàn / trăm rưỡi
  const spokenTramRuoi = norm.match(
    /\b(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin)\s+tram\s+ruoi\b/,
  );
  if (spokenTramRuoi) {
    const h = VI_WORD_DIGITS[spokenTramRuoi[1]] || 0;
    return (h * 100 + 50) * 1_000;
  }

  const spokenNghin = norm.match(
    /\b((?:(?:mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|muoi|tram|le|linh|ruoi)\s*)+)\s*(?:nghin|ngan)\b/,
  );
  if (spokenNghin) {
    const val = parseVietnameseSmallNumber(spokenNghin[1]);
    if (val && val > 0) return val * 1_000;
  }

  // 7. Formatted currency numbers like "450.000", "1.420.000", "385,000"
  const formattedMatches = norm.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g);
  if (formattedMatches && formattedMatches.length > 0) {
    const nums = formattedMatches.map((m) => Number(m.replace(/[.,]/g, '')));
    return Math.max(...nums);
  }

  // 8. Bare integer >= 1000 (excluding dates & years)
  const strippedDates = norm
    .replace(/\bngay\s+\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ');

  const plainNums = strippedDates.match(/\b\d{4,9}\b/g);
  if (plainNums && plainNums.length > 0) {
    const valid = plainNums
      .map(Number)
      .filter((n) => n >= 1000 && n !== 2025 && n !== 2026 && n !== 2027);
    if (valid.length > 0) return Math.max(...valid);
  }

  return 0;
}

export function extractVietnameseDate(rawText: string): string {
  const today = getToday();
  const norm = normalizeVietnamese(rawText);

  if (norm.includes('hom qua')) return toDateKey(addDays(today, -1));
  if (norm.includes('hom kia')) return toDateKey(addDays(today, -2));
  if (norm.includes('hom nay')) return toDateKey(today);

  const fullDate = norm.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (fullDate) {
    const day = Number(fullDate[1]);
    const month = Number(fullDate[2]);
    let year = fullDate[3] ? Number(fullDate[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const dayOnly = norm.match(/\bngay\s+(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(day)}`;
    }
  }

  return toDateKey(today);
}

function buildCleanVoiceNote(rawText: string, matchedMemberName?: string): string {
  let note = rawText.trim();
  note = note
    .replace(/^(hôm nay|hôm qua|hôm kia|sáng nay|trưa nay|chiều nay|tối nay)\s+/i, '')
    .replace(
      /\b(hết|tổng cộng|khoảng|giá|với giá)?\s*\d+(?:[.,]\d+)?\s*(triệu|tr|củ|lít|xị|chục|nghìn|ngàn|k|đồng|đ|vnd)(?:\s+(rưỡi|\d{1,3}\s*(?:nghìn|ngàn|k)?))?/gi,
      '',
    )
    .replace(
      /\b(nửa|một|hai|ba|bốn|tư|năm|sáu|bảy|tám|chín|mười)(?:\s+(?:mươi|lăm|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|trăm))*\s*(triệu|củ|lít|xị|chục|nghìn|ngàn)(?:\s+rưỡi)?\b/gi,
      '',
    )
    .replace(/\b(bằng\s+)?(tiền mặt|chuyển khoản|thẻ tín dụng|ví điện tử|momo)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\-;\s]+|[,.\-;\s]+$/g, '')
    .trim();

  if (matchedMemberName) {
    const escaped = matchedMemberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    note = note.replace(new RegExp(`^${escaped}\\s+`, 'i'), '').trim();
  }

  if (!note) return rawText.trim();
  return note.charAt(0).toUpperCase() + note.slice(1);
}

export function parseVietnameseVoiceExpense(
  transcript: string,
  categories: Category[],
  members: FamilyMember[],
  defaultMemberId: string,
  inherited?: {
    date?: string;
    paymentMethod?: PaymentMethod;
    fallbackCategoryId?: string;
    index?: number;
  },
): VoiceParseResult {
  const type = detectTransactionType(transcript);
  const amount = extractVietnameseAmount(transcript);
  const detectedCat = detectCategoryFromText(transcript, type, categories);
  const otherFallback = type === 'income' ? 'other_income' : 'other_expense';
  const categoryId =
    detectedCat === otherFallback && inherited?.fallbackCategoryId
      ? inherited.fallbackCategoryId
      : detectedCat;

  const memberRes = detectMemberFromText(transcript, members, defaultMemberId);
  const ownDateNorm = normalizeVietnamese(transcript);
  const hasExplicitDate =
    ownDateNorm.includes('hom qua') ||
    ownDateNorm.includes('hom kia') ||
    ownDateNorm.includes('hom nay') ||
    /\b\d{1,2}[/-]\d{1,2}\b/.test(ownDateNorm) ||
    /\bngay\s+\d{1,2}\b/.test(ownDateNorm);

  const date = hasExplicitDate
    ? extractVietnameseDate(transcript)
    : inherited?.date || extractVietnameseDate(transcript);

  const paymentMethod =
    detectPaymentMethodFromText(transcript) || inherited?.paymentMethod || 'cash';
  const note = buildCleanVoiceNote(transcript, memberRes.matchedName);

  return {
    id: `voice_${inherited?.index ?? 0}_${amount}_${categoryId}`,
    transcript: transcript.trim(),
    type,
    amount,
    categoryId,
    memberId: memberRes.memberId,
    memberMatched: Boolean(memberRes.matchedName),
    date,
    paymentMethod,
    note,
  };
}

/**
 * Supports multi-item Vietnamese spoken sentences!
 * Example: "Hôm nay Mẹ Trang đi chợ mua thịt 120k, rau 4 chục, trái cây 65 nghìn"
 * -> Splits into 3 separate transactions inheriting shared context (Mẹ Trang, Hôm nay, Đi chợ).
 */
export function parseVietnameseVoiceBatch(
  transcript: string,
  categories: Category[],
  members: FamilyMember[],
  defaultMemberId: string,
): VoiceParseResult[] {
  const clean = transcript.trim();
  if (!clean) return [];

  // Shared context from the full utterance
  const globalDate = extractVietnameseDate(clean);
  const globalMember = detectMemberFromText(clean, members, defaultMemberId);
  const globalPayment = detectPaymentMethodFromText(clean);

  // Split candidate segments on commas, semicolons, newlines, or Vietnamese conjunctions
  const rawSegments = clean
    .split(/(?:[,;\n]+|\s+(?:và|với|thêm|rồi)\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  // Check how many segments have their own money amount
  const segmentsWithMoney = rawSegments.filter((seg) => extractVietnameseAmount(seg) >= 1_000);

  if (segmentsWithMoney.length >= 2) {
    // Inherit first segment's category as fallback for short trailing items (e.g. "đi chợ mua thịt 120k, rau 4 chục")
    const firstCat = detectCategoryFromText(segmentsWithMoney[0], 'expense', categories);
    const fallbackCat = firstCat !== 'other_expense' ? firstCat : undefined;

    return segmentsWithMoney.map((seg, idx) =>
      parseVietnameseVoiceExpense(seg, categories, members, globalMember.memberId, {
        date: globalDate,
        paymentMethod: globalPayment,
        fallbackCategoryId: idx > 0 ? fallbackCat : undefined,
        index: idx,
      }),
    );
  }

  return [
    parseVietnameseVoiceExpense(clean, categories, members, defaultMemberId, {
      index: 0,
    }),
  ];
}

export const VOICE_SAMPLE_PHRASES = [
  'Mẹ Trang đi chợ mua thịt 120k, rau 4 chục, trái cây 65 nghìn',
  'Cha Bình đổ xăng 1 lít 2 và ăn sáng 65k tiền mặt',
  'Minh Phát mua sách vở Fahasa 85 ngàn',
  'Mai Anh uống trà sữa 5 chục ví điện tử',
  'Hôm qua đóng tiền điện 1 củ 420 nghìn chuyển khoản',
];
