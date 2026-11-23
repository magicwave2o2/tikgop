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

/**
 * Converts spoken Vietnamese number words (e.g., "hai tram nam muoi", "mot tram ruoi", "chin muoi lam")
 * into numeric values so speech transcripts without digits parse accurately.
 */
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
 * Extracts VND amount from natural Vietnamese speech or text.
 * Supports:
 * - "1 triệu 450 nghìn", "1 triệu rưỡi", "1,5 triệu", "1tr5", "2 triệu 3"
 * - "450 nghìn", "450 ngàn", "450k", "85k"
 * - "một triệu rưỡi", "hai trăm năm mươi nghìn", "một trăm rưỡi", "năm mươi ngàn"
 * - "450.000", "450,000", "1420000"
 */
export function extractVietnameseAmount(rawText: string): number {
  const norm = normalizeVietnamese(rawText);

  // 1. Numeric triệu patterns: "1 trieu 450 nghin", "1 trieu ruoi", "1,5 trieu", "1tr5", "2 trieu 3"
  const trieuNumeric = norm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|cu)\s*(?:(ruoi)|(\d{1,3})\s*(?:nghin|ngan|k)?)?/,
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

  // 2. Spoken word triệu patterns: "mot trieu ruoi", "hai trieu ba tram nghin"
  const trieuWord = norm.match(
    /\b((?:mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)(?:\s+(?:muoi|lam|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin))?)\s+trieu(?:\s+(ruoi)|(?:\s+([a-z\s]+?))(?:\s+(?:nghin|ngan|dong)|$))?/,
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

  // 3. Numeric nghìn / ngàn / k / trăm rưỡi patterns
  const tramRuoiNumeric = norm.match(/(\d+)\s*tram\s*ruoi/);
  if (tramRuoiNumeric) {
    return (Number(tramRuoiNumeric[1]) * 100 + 50) * 1_000;
  }

  const nghinNumeric = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:nghin|ngan|k\b|ka\b)/);
  if (nghinNumeric) {
    const val = parseFloat(nghinNumeric[1].replace(',', '.'));
    return Math.round(val * 1_000);
  }

  // 4. Spoken word nghìn / ngàn / trăm rưỡi: "hai tram ruoi", "nam muoi nghin", "mot tram hai muoi ngan"
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

  // 5. Formatted currency number like "450.000", "1.420.000", "385,000", or bare integer >= 1000
  const formattedMatches = norm.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g);
  if (formattedMatches && formattedMatches.length > 0) {
    const nums = formattedMatches.map((m) => Number(m.replace(/[.,]/g, '')));
    return Math.max(...nums);
  }

  // Avoid confusing dates like "15/11" or "ngày 20" with money
  const strippedDates = norm
    .replace(/\bngay\s+\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ');

  const plainNums = strippedDates.match(/\b\d{4,9}\b/g);
  if (plainNums && plainNums.length > 0) {
    const valid = plainNums.map(Number).filter((n) => n >= 1000 && n !== 2025 && n !== 2026 && n !== 2027);
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

  // Match "ngày 15/11" or "15/11/2026"
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

  // Match "ngày 15"
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
  // Remove leading time/filler phrases while keeping natural Vietnamese accents
  note = note
    .replace(/^(hôm nay|hôm qua|hôm kia|sáng nay|trưa nay|chiều nay|tối nay)\s+/i, '')
    .replace(/\b(hết|tổng cộng|khoảng|giá|với giá)\s+\d[\d.,\s]*(triệu|tr|nghìn|ngàn|k|đồng|đ|vnd)?/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(triệu|tr|nghìn|ngàn|k|đồng|đ|vnd)\b/gi, '')
    .replace(/\b(bằng\s+)?(tiền mặt|chuyển khoản|thẻ tín dụng|ví điện tử|momo)\b/gi, '')
    .replace(/\s+/g, ' ')
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
): VoiceParseResult {
  const type = detectTransactionType(transcript);
  const amount = extractVietnameseAmount(transcript);
  const categoryId = detectCategoryFromText(transcript, type, categories);
  const memberRes = detectMemberFromText(transcript, members, defaultMemberId);
  const date = extractVietnameseDate(transcript);
  const paymentMethod = detectPaymentMethodFromText(transcript) || 'cash';
  const note = buildCleanVoiceNote(transcript, memberRes.matchedName);

  return {
    transcript,
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

export const VOICE_SAMPLE_PHRASES = [
  'Hôm nay Mẹ Trang đi siêu thị WinMart hết 450 nghìn',
  'Cha Bình đổ xăng xe máy 120k tiền mặt',
  'Minh Phát mua sách vở Fahasa 85 ngàn',
  'Mai Anh uống trà sữa 65 nghìn ví điện tử',
  'Hôm qua đóng tiền điện 1 triệu 420 nghìn chuyển khoản',
];
