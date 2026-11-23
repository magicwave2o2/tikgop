import type { Category, FamilyMember, PaymentMethod, TransactionType } from '../types/finance';

export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

const EXPENSE_KEYWORDS: Array<{ categoryId: string; keywords: string[] }> = [
  {
    categoryId: 'grocery',
    keywords: [
      'sieu thi',
      'di cho',
      'winmart',
      'vinmart',
      'coopmart',
      'co.op',
      'bach hoa xanh',
      'bhx',
      'big c',
      'go!',
      'lotte mart',
      'aeon',
      'mega market',
      'circle k',
      'gs25',
      'familymart',
      'thuc pham',
      'rau cu',
      'rau xanh',
      'trai cay',
      'thit ca',
      'thit heo',
      'thit bo',
      'hai san',
      'trung ga',
      'sua tuoi',
      'gao',
      'tap hoa',
    ],
  },
  {
    categoryId: 'food',
    keywords: [
      'an sang',
      'an trua',
      'an toi',
      'an vat',
      'an uong',
      'nha hang',
      'quan an',
      'pho',
      'bun',
      'com',
      'banh mi',
      'tra sua',
      'ca phe',
      'cafe',
      'coffee',
      'highlands',
      'phuc long',
      'starbucks',
      'katina',
      'gong cha',
      'mixue',
      'pizza',
      'kfc',
      'lotteria',
      'jollibee',
      'lau',
      'nuong',
      'bbq',
      'buffet',
      'kem',
      'banh ngot',
      'nuoc ep',
      'sinh to',
    ],
  },
  {
    categoryId: 'bills',
    keywords: [
      'tien dien',
      'dien luc',
      'evn',
      'tien nuoc',
      'cap nuoc',
      'internet',
      'wifi',
      'mang',
      'vnpt',
      'fpt',
      'viettel',
      'truyen hinh',
      'hoa don',
      'phi quan ly',
      'chung cu',
      'tien rac',
      'cuoc dien thoai',
      'nap card',
      'nap dien thoai',
    ],
  },
  {
    categoryId: 'transport',
    keywords: [
      'do xang',
      'xang',
      'petrolimex',
      'pvoil',
      'gui xe',
      'bai xe',
      'grab',
      'taxi',
      'xanh sm',
      'be ',
      'rua xe',
      'sua xe',
      'bao duong',
      'thay nhot',
      've xe',
      've tau',
      've may bay',
      'cau duong',
      'etc',
    ],
  },
  {
    categoryId: 'kids',
    keywords: [
      'hoc phi',
      'ban tru',
      'hoc them',
      'sach vo',
      'nha sach',
      'fahasa',
      'but viet',
      'dung cu hoc',
      'hoc sinh',
      'lop ve',
      'tieng anh',
      'nang khieu',
      'dong phuc',
      'hoc tap',
      'mua sach',
      'truyen tranh',
      'bim sua',
    ],
  },
  {
    categoryId: 'health',
    keywords: [
      'nha thuoc',
      'mua thuoc',
      'thuoc',
      'long chau',
      'pharmacity',
      'an khang',
      'vitamin',
      'kham benh',
      'benh vien',
      'phong kham',
      'nha khoa',
      'xet nghiem',
      'bao hiem',
      'y te',
      'suc khoe',
    ],
  },
  {
    categoryId: 'shopping',
    keywords: [
      'quan ao',
      'ao khoac',
      'giay dep',
      'my pham',
      'shopee',
      'lazada',
      'tiki',
      'tiktok shop',
      'uniqlo',
      'zara',
      'mua sam',
      'phu kien',
      'tui xach',
      'dong ho',
      'dien thoai',
    ],
  },
  {
    categoryId: 'invest_expense',
    keywords: [
      'dau tu',
      'mua vang',
      'gui tiet kiem',
      'tiet kiem',
      'chung khoan',
      'co phieu',
      'quy etf',
      'chung chi quy',
      'trai phieu',
      'tich luy',
      'tich tru',
      'bat dong san',
    ],
  },
  {
    categoryId: 'entertainment',
    keywords: [
      'xem phim',
      'cgv',
      'lotte cinema',
      'galaxy',
      'du lich',
      'di choi',
      'cong vien',
      'khu vui choi',
      'karaoke',
      'da ngoai',
      'khach san',
      'homestay',
      'giai tri',
    ],
  },
  {
    categoryId: 'gifts',
    keywords: [
      'bieu ong ba',
      'bieu',
      'mung cuoi',
      'qua sinh nhat',
      'tang qua',
      'hieu hi',
      'tham hoi',
      'tu thien',
      'li xi',
    ],
  },
  {
    categoryId: 'business_expense',
    keywords: [
      'kinh doanh',
      'nhap hang',
      'von hang',
      'van chuyen',
      'quang cao',
      'chay ads',
      'ban hang',
      'cua hang',
      'ship hang',
      'dong goi',
      'vat tu',
      'in an',
    ],
  },
];

const INCOME_KEYWORDS: Array<{ categoryId: string; keywords: string[] }> = [
  { categoryId: 'salary', keywords: ['luong', 'tien luong', 'nhan luong', 'phu cap'] },
  { categoryId: 'bonus', keywords: ['thuong', 'hoa hong', 'kpi', 'du an'] },
  { categoryId: 'business', keywords: ['ban hang', 'kinh doanh', 'khach tra', 'lam them'] },
  { categoryId: 'invest', keywords: ['lai tiet kiem', 'co tuc', 'dau tu', 'chung khoan', 'gui tiet kiem'] },
];

export function detectTransactionType(rawText: string): TransactionType {
  const norm = normalizeVietnamese(rawText);
  const incomeCues = [
    'nhan luong',
    'luong thang',
    'tien luong',
    'tien thuong',
    'duoc thuong',
    'thu nhap',
    'thu tien',
    'lai tiet kiem',
    'co tuc',
    'hoan tien',
    'duoc tang tien',
  ];
  if (incomeCues.some((cue) => norm.includes(cue))) return 'income';
  return 'expense';
}

export function detectCategoryFromText(
  rawText: string,
  type: TransactionType,
  categories: Category[],
): string {
  const norm = normalizeVietnamese(rawText);
  const list = type === 'income' ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;

  for (const rule of list) {
    if (rule.keywords.some((kw) => norm.includes(kw))) {
      if (categories.some((c) => c.id === rule.categoryId && c.type === type)) {
        return rule.categoryId;
      }
    }
  }

  // Fallback: match against user custom category names
  for (const cat of categories) {
    if (cat.type !== type) continue;
    const catNorm = normalizeVietnamese(cat.name);
    if (catNorm.length >= 3 && norm.includes(catNorm)) {
      return cat.id;
    }
  }

  return type === 'income' ? 'other_income' : 'other_expense';
}

export function detectMemberFromText(
  rawText: string,
  members: FamilyMember[],
  fallbackMemberId: string,
): { memberId: string; matchedName?: string } {
  const norm = normalizeVietnamese(rawText);

  // Check exact full names first
  for (const m of members) {
    const full = normalizeVietnamese(m.name);
    if (full && norm.includes(full)) {
      return { memberId: m.id, matchedName: m.name };
    }
  }

  // Check Vietnamese family member aliases (Cha Bình, Mẹ Trang, Minh Phát, Mai Anh)
  const aliases: Array<{ tokens: string[]; matchName: string[] }> = [
    { tokens: ['cha binh', 'bo binh', 'ba binh', 'cha ', 'bo '], matchName: ['binh', 'cha', 'bo'] },
    { tokens: ['me trang', 'ma trang', 'me ', 'ma '], matchName: ['trang', 'me'] },
    { tokens: ['minh phat', 'be phat', 'anh phat', 'phat'], matchName: ['phat'] },
    { tokens: ['mai anh', 'be anh', 'chi anh', 'em anh'], matchName: ['mai anh'] },
  ];

  for (const alias of aliases) {
    if (alias.tokens.some((tok) => norm.includes(tok))) {
      const found = members.find((m) => {
        const mn = normalizeVietnamese(m.name);
        return alias.matchName.some((key) => mn.includes(key));
      });
      if (found) return { memberId: found.id, matchedName: found.name };
    }
  }

  // Fallback: match last word of member name if >= 4 chars (e.g., "binh", "trang", "phat")
  for (const m of members) {
    const parts = normalizeVietnamese(m.name).split(' ');
    const last = parts[parts.length - 1];
    if (last && last.length >= 4 && new RegExp(`\\b${last}\\b`).test(norm)) {
      return { memberId: m.id, matchedName: m.name };
    }
  }

  return { memberId: fallbackMemberId };
}

export function detectPaymentMethodFromText(rawText: string): PaymentMethod | undefined {
  const norm = normalizeVietnamese(rawText);
  if (norm.includes('tien mat') || norm.includes('tra mat')) return 'cash';
  if (norm.includes('chuyen khoan') || norm.includes('ck ') || norm.includes('banking') || norm.includes('vietqr'))
    return 'bank';
  if (norm.includes('momo') || norm.includes('zalopay') || norm.includes('vnpay') || norm.includes('vi dien tu'))
    return 'ewallet';
  if (norm.includes('the tin dung') || norm.includes('quet the') || norm.includes('visa') || norm.includes('mastercard'))
    return 'card';
  return undefined;
}
