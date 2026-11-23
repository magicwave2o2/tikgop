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
      'mua rau',
      'trai cay',
      'hoa qua',
      'thit ca',
      'mua thit',
      'mua ca',
      'thit heo',
      'thit bo',
      'thit ga',
      'hai san',
      'trung ga',
      'mua trung',
      'sua tuoi',
      'sua chua',
      'mua sua',
      'dau an',
      'nuoc mam',
      'gia vi',
      'gao',
      'mua gao',
      'tap hoa',
      'banh keo',
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
      'quan nhau',
      'pho',
      'bun',
      'hu tieu',
      'mi quang',
      'com',
      'xoi',
      'chao',
      'banh mi',
      'banh cuon',
      'banh xeo',
      'tra sua',
      'tra chanh',
      'tra dao',
      'matcha',
      'ca phe',
      'cafe',
      'coffee',
      'highlands',
      'phuc long',
      'starbucks',
      'katinat',
      'gong cha',
      'mixue',
      'pizza',
      'kfc',
      'lotteria',
      'jollibee',
      'grabfood',
      'shopeefood',
      'lau',
      'nuong',
      'bbq',
      'buffet',
      'kem',
      'che',
      'banh ngot',
      'tiem banh',
      'nuoc ep',
      'sinh to',
      'uong nuoc',
      'nhau',
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
      'tien gas',
      'doi gas',
      'binh gas',
      'internet',
      'wifi',
      'tien mang',
      'mang',
      'vnpt',
      'fpt',
      'viettel',
      'truyen hinh',
      'hoa don',
      'phi quan ly',
      'phi dich vu',
      'chung cu',
      'tien rac',
      'cuoc dien thoai',
      'tien dien thoai',
      'nap card',
      'nap dien thoai',
      'netflix',
      'icloud',
      'youtube',
      'spotify',
    ],
  },
  {
    categoryId: 'transport',
    keywords: [
      'do xang',
      'tien xang',
      'xang',
      'petrolimex',
      'pvoil',
      'gui xe',
      'bai xe',
      'grab',
      'taxi',
      'xanh sm',
      'be',
      'gojek',
      'xe om',
      'rua xe',
      'sua xe',
      'va xe',
      'thay lop',
      'bom xe',
      'bao duong',
      'thay nhot',
      'do nhot',
      've xe',
      've tau',
      've may bay',
      'cau duong',
      'cao toc',
      'etc',
    ],
  },
  {
    categoryId: 'kids',
    keywords: [
      'hoc phi',
      'ban tru',
      'hoc them',
      'gia su',
      'quy lop',
      'dong tien lop',
      'hoc dan',
      'hoc boi',
      'hoc vo',
      'sach vo',
      'nha sach',
      'fahasa',
      'but viet',
      'but chi',
      'vo viet',
      'balo',
      'cap sach',
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
      'do choi',
      'tieu vat',
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
      'kham mat',
      'cat kinh',
      'tiem phong',
      'vac xin',
      'xet nghiem',
      'sieu am',
      'bao hiem',
      'y te',
      'suc khoe',
      'khau trang',
      'dau gio',
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
      'cat toc',
      'lam toc',
      'goi dau',
      'lam nail',
      'spa',
      'nuoc hoa',
      'sua rua mat',
      'kem chong nang',
      'do gia dung',
      'sua nha',
      'ong nuoc',
    ],
  },
  {
    categoryId: 'invest_expense',
    keywords: [
      'dau tu',
      'mua vang',
      'chi vang',
      'vang sjc',
      'vang nhan',
      'gui tiet kiem',
      'so tiet kiem',
      'tiet kiem',
      'chung khoan',
      'co phieu',
      'quy etf',
      'chung chi quy',
      'quy mo',
      'trai phieu',
      'tich luy',
      'tich tru',
      'bat dong san',
      'crypto',
      'bitcoin',
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
      'bowling',
      'bida',
    ],
  },
  {
    categoryId: 'gifts',
    keywords: [
      'bieu ong ba',
      'bieu',
      'mung cuoi',
      'dam cuoi',
      'day thang',
      'thoi noi',
      'mung tho',
      'dam gio',
      'qua sinh nhat',
      'tang qua',
      'tang co giao',
      'mua hoa',
      'bo hoa',
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
      'nhap si',
      'lay hang',
      'von hang',
      'van chuyen',
      'tien ship',
      'phi ship',
      'ship hang',
      'dong hang',
      'dong goi',
      'bao bi',
      'hop carton',
      'quang cao',
      'chay ads',
      'facebook ads',
      'tiktok ads',
      'ban hang',
      'cua hang',
      'vat tu',
      'nguyen lieu',
      'in an',
    ],
  },
];

const INCOME_KEYWORDS: Array<{ categoryId: string; keywords: string[] }> = [
  { categoryId: 'salary', keywords: ['luong', 'tien luong', 'nhan luong', 'phu cap'] },
  { categoryId: 'bonus', keywords: ['thuong', 'hoa hong', 'kpi', 'du an'] },
  {
    categoryId: 'business',
    keywords: ['ban hang', 'kinh doanh', 'khach tra', 'thu tien hang', 'lam them', 'chot don'],
  },
  {
    categoryId: 'invest',
    keywords: ['lai tiet kiem', 'co tuc', 'dau tu', 'chung khoan', 'loi nhuan'],
  },
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
    'ban hang duoc',
    'ban hang thu',
    'khach tra',
    'khach chuyen khoan',
    'lai tiet kiem',
    'co tuc',
    'hoan tien',
    'duoc tang tien',
    'duoc cho',
    'duoc li xi',
  ];
  if (incomeCues.some((cue) => norm.includes(cue))) return 'income';
  return 'expense';
}

function matchesKeyword(normText: string, keyword: string): boolean {
  const kw = keyword.trim();
  if (!kw) return false;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(normText);
}

export function detectCategoryFromText(
  rawText: string,
  type: TransactionType,
  categories: Category[],
): string {
  const norm = normalizeVietnamese(rawText);
  const list = type === 'income' ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;

  for (const rule of list) {
    if (rule.keywords.some((kw) => matchesKeyword(norm, kw))) {
      if (categories.some((c) => c.id === rule.categoryId && c.type === type)) {
        return rule.categoryId;
      }
    }
  }

  for (const cat of categories) {
    if (cat.type !== type) continue;
    const catNorm = normalizeVietnamese(cat.name);
    if (catNorm.length >= 3 && matchesKeyword(norm, catNorm)) {
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

  for (const m of members) {
    const full = normalizeVietnamese(m.name);
    if (full && norm.includes(full)) {
      return { memberId: m.id, matchedName: m.name };
    }
  }

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
  if (
    norm.includes('chuyen khoan') ||
    norm.includes('ck ') ||
    norm.includes('banking') ||
    norm.includes('vietqr')
  )
    return 'bank';
  if (
    norm.includes('momo') ||
    norm.includes('zalopay') ||
    norm.includes('vnpay') ||
    norm.includes('vi dien tu')
  )
    return 'ewallet';
  if (
    norm.includes('the tin dung') ||
    norm.includes('quet the') ||
    norm.includes('visa') ||
    norm.includes('mastercard')
  )
    return 'card';
  return undefined;
}
