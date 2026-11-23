import type { Category, FamilyMember, FamilySettings, Transaction } from '../types/finance';
import { addDays, toDateKey } from '../utils/format';

export const DEFAULT_CATEGORIES: Category[] = [
  // Chi tiêu
  {
    id: 'food',
    name: 'Ăn uống',
    shortName: 'Ăn uống',
    type: 'expense',
    icon: 'UtensilsCrossed',
    color: '#F97316',
    budget: 4500000,
    quickNotes: ['Ăn sáng cả nhà', 'Cơm trưa văn phòng', 'Cà phê cuối tuần', 'Trà sữa & ăn vặt'],
  },
  {
    id: 'grocery',
    name: 'Đi chợ & Siêu thị',
    shortName: 'Đi chợ',
    type: 'expense',
    icon: 'ShoppingBasket',
    color: '#10B981',
    budget: 5500000,
    quickNotes: ['Đi chợ thực phẩm tươi', 'Siêu thị WinMart', 'Trái cây & rau sạch', 'Sữa & đồ khô'],
  },
  {
    id: 'bills',
    name: 'Điện nước & Hóa đơn',
    shortName: 'Hóa đơn',
    type: 'expense',
    icon: 'Zap',
    color: '#0EA5E9',
    budget: 2500000,
    quickNotes: ['Tiền điện tháng', 'Tiền nước sinh hoạt', 'Internet & Wifi', 'Phí quản lý nhà'],
  },
  {
    id: 'housing',
    name: 'Nhà cửa',
    shortName: 'Nhà cửa',
    type: 'expense',
    icon: 'Home',
    color: '#14B8A6',
    budget: 3500000,
    quickNotes: ['Đồ gia dụng mới', 'Sửa chữa vật dụng', 'Chăm sóc nhà cửa', 'Đồ dùng phòng bếp'],
  },
  {
    id: 'transport',
    name: 'Đi lại & Xăng xe',
    shortName: 'Đi lại',
    type: 'expense',
    icon: 'Car',
    color: '#6366F1',
    budget: 2200000,
    quickNotes: ['Đổ xăng xe máy', 'Đổ xăng ô tô', 'Phí gửi xe tháng', 'Bảo dưỡng & rửa xe'],
  },
  {
    id: 'kids',
    name: 'Học tập & Con cái',
    shortName: 'Học tập',
    type: 'expense',
    icon: 'GraduationCap',
    color: '#8B5CF6',
    budget: 5000000,
    quickNotes: ['Học phí tháng', 'Sách vở & dụng cụ học', 'Học thêm tiếng Anh', 'Lớp năng khiếu'],
  },
  {
    id: 'health',
    name: 'Sức khỏe',
    shortName: 'Sức khỏe',
    type: 'expense',
    icon: 'HeartPulse',
    color: '#F43F5E',
    budget: 1500000,
    quickNotes: ['Mua thuốc & vitamin', 'Khám sức khỏe định kỳ', 'Khám nha khoa', 'Nhà thuốc Long Châu'],
  },
  {
    id: 'shopping',
    name: 'Mua sắm',
    shortName: 'Mua sắm',
    type: 'expense',
    icon: 'ShoppingBag',
    color: '#EC4899',
    budget: 2500000,
    quickNotes: ['Quần áo gia đình', 'Đồ dùng cá nhân', 'Mua sắm online', 'Giày dép & phụ kiện'],
  },
  {
    id: 'entertainment',
    name: 'Giải trí & Du lịch',
    shortName: 'Giải trí',
    type: 'expense',
    icon: 'Sparkles',
    color: '#D946EF',
    budget: 2000000,
    quickNotes: ['Xem phim cuối tuần', 'Đi chơi cả nhà', 'Tiệc gia đình', 'Dã ngoại'],
  },
  {
    id: 'gifts',
    name: 'Biếu tặng & Hiếu hỉ',
    shortName: 'Biếu tặng',
    type: 'expense',
    icon: 'Gift',
    color: '#EF4444',
    budget: 1500000,
    quickNotes: ['Biếu ông bà nội ngoại', 'Quà sinh nhật', 'Mừng cưới', 'Thăm hỏi người thân'],
  },
  {
    id: 'pets',
    name: 'Thú cưng',
    shortName: 'Thú cưng',
    type: 'expense',
    icon: 'PawPrint',
    color: '#84CC16',
    budget: 800000,
    quickNotes: ['Hạt & pate thú cưng', 'Tắm & cắt tỉa lông', 'Khám thú y'],
  },
  {
    id: 'other_expense',
    name: 'Chi khác',
    shortName: 'Khác',
    type: 'expense',
    icon: 'MoreHorizontal',
    color: '#64748B',
    quickNotes: ['Chi phí phát sinh', 'Lặt vặt trong ngày'],
  },

  // Thu nhập
  {
    id: 'salary',
    name: 'Lương hàng tháng',
    shortName: 'Lương',
    type: 'income',
    icon: 'Briefcase',
    color: '#10B981',
    quickNotes: ['Lương tháng Cha Bình', 'Lương tháng Mẹ Trang', 'Phụ cấp công ty'],
  },
  {
    id: 'bonus',
    name: 'Thưởng & Phụ cấp',
    shortName: 'Thưởng',
    type: 'income',
    icon: 'Award',
    color: '#F59E0B',
    quickNotes: ['Thưởng dự án', 'Thưởng hiệu suất', 'Hoa hồng'],
  },
  {
    id: 'business',
    name: 'Kinh doanh thêm',
    shortName: 'Kinh doanh',
    type: 'income',
    icon: 'Store',
    color: '#3B82F6',
    quickNotes: ['Thu nhập bán hàng', 'Việc làm thêm'],
  },
  {
    id: 'invest',
    name: 'Đầu tư & Tiết kiệm',
    shortName: 'Đầu tư',
    type: 'income',
    icon: 'TrendingUp',
    color: '#8B5CF6',
    quickNotes: ['Lãi tiết kiệm ngân hàng', 'Cổ tức', 'Lợi nhuận quỹ'],
  },
  {
    id: 'other_income',
    name: 'Thu nhập khác',
    shortName: 'Thu khác',
    type: 'income',
    icon: 'Wallet',
    color: '#14B8A6',
    quickNotes: ['Hoàn tiền thanh toán', 'Quà tặng tiền mặt'],
  },
];

export const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: 'cha_binh',
    name: 'Cha Bình',
    role: 'Cha • Chủ hộ',
    icon: 'UserRound',
    color: '#2563EB',
  },
  {
    id: 'me_trang',
    name: 'Mẹ Trang',
    role: 'Mẹ • Thủ quỹ',
    icon: 'Heart',
    color: '#EC4899',
  },
  {
    id: 'minh_phat',
    name: 'Minh Phát',
    role: 'Con trai',
    icon: 'GraduationCap',
    color: '#8B5CF6',
  },
  {
    id: 'mai_anh',
    name: 'Mai Anh',
    role: 'Con gái',
    icon: 'Sparkles',
    color: '#F59E0B',
  },
];

export const DEFAULT_SETTINGS: FamilySettings = {
  familyName: 'Gia Đình Bình • Trang',
  monthlyBudget: 26000000,
  theme: 'light',
  activeMemberId: 'cha_binh',
};

export const PAYMENT_METHODS = [
  { id: 'bank', label: 'Chuyển khoản', shortLabel: 'Bank' },
  { id: 'cash', label: 'Tiền mặt', shortLabel: 'Tiền mặt' },
  { id: 'ewallet', label: 'Ví điện tử', shortLabel: 'Ví ĐT' },
  { id: 'card', label: 'Thẻ tín dụng', shortLabel: 'Thẻ' },
] as const;

export const COLOR_PALETTE = [
  '#2563EB',
  '#EC4899',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#6366F1',
  '#F43F5E',
  '#F97316',
  '#14B8A6',
  '#84CC16',
  '#64748B',
];

/**
 * Generates realistic Vietnamese family transactions for all 4 members:
 * Cha Bình, Mẹ Trang, Minh Phát, Mai Anh — anchored to the current local date.
 */
export function generateSampleTransactions(referenceDate = new Date()): Transaction[] {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const nowTs = Date.now();
  let seq = 1;

  const make = (
    offsetDays: number,
    time: string,
    type: 'expense' | 'income',
    amount: number,
    categoryId: string,
    memberId: string,
    note: string,
    paymentMethod: Transaction['paymentMethod'] = 'bank',
    source: Transaction['source'] = 'manual',
  ): Transaction => {
    const d = addDays(today, offsetDays);
    const id = `sample_${seq++}`;
    return {
      id,
      type,
      amount,
      categoryId,
      memberId,
      date: toDateKey(d),
      time,
      note,
      paymentMethod,
      source,
      createdAt: nowTs - seq * 60000,
    };
  };

  const makeDate = (
    monthsAgo: number,
    dayOfMonth: number,
    time: string,
    type: 'expense' | 'income',
    amount: number,
    categoryId: string,
    memberId: string,
    note: string,
    paymentMethod: Transaction['paymentMethod'] = 'bank',
  ): Transaction => {
    const target = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(dayOfMonth, maxDay));
    const id = `sample_${seq++}`;
    return {
      id,
      type,
      amount,
      categoryId,
      memberId,
      date: toDateKey(target),
      time,
      note,
      paymentMethod,
      source: 'manual',
      createdAt: nowTs - seq * 60000,
    };
  };

  const txs: Transaction[] = [
    // Today (0) — all 4 family members clearly categorized
    make(0, '07:15', 'expense', 140000, 'food', 'cha_binh', 'Phở bò ăn sáng cả gia đình', 'cash', 'voice'),
    make(0, '09:10', 'expense', 385000, 'grocery', 'me_trang', 'Đi chợ sáng mua thịt cá, rau xanh & trái cây', 'ewallet', 'receipt'),
    make(0, '11:45', 'expense', 85000, 'kids', 'minh_phat', 'Mua sách bài tập & bút viết Fahasa', 'cash', 'manual'),
    make(0, '15:20', 'expense', 65000, 'food', 'mai_anh', 'Trà sữa & bánh ngọt sau giờ học', 'ewallet', 'voice'),
    make(0, '17:05', 'expense', 120000, 'transport', 'cha_binh', 'Đổ xăng xe máy & gửi xe', 'cash', 'manual'),

    // Yesterday (-1)
    make(-1, '09:30', 'expense', 690000, 'grocery', 'me_trang', 'Siêu thị WinMart đồ ăn cuối tuần', 'card', 'receipt'),
    make(-1, '14:15', 'expense', 320000, 'shopping', 'mai_anh', 'Mua áo khoác & phụ kiện học sinh', 'card', 'manual'),
    make(-1, '19:30', 'expense', 540000, 'entertainment', 'cha_binh', 'Xem phim CGV & ăn tối cả 4 người', 'card', 'receipt'),

    // -2 days
    make(-2, '10:00', 'expense', 1420000, 'bills', 'cha_binh', 'Thanh toán hóa đơn tiền điện EVN', 'bank', 'receipt'),
    make(-2, '14:20', 'expense', 265000, 'health', 'me_trang', 'Nhà thuốc Long Châu mua vitamin cho cả nhà', 'ewallet', 'receipt'),
    make(-2, '16:40', 'expense', 150000, 'food', 'minh_phat', 'Ăn vặt & cà phê nhóm bạn học', 'ewallet', 'manual'),

    // -3 days
    make(-3, '08:00', 'expense', 210000, 'grocery', 'me_trang', 'Sữa tươi, trứng gà & bánh mì sáng', 'cash', 'voice'),
    make(-3, '17:30', 'expense', 480000, 'kids', 'minh_phat', 'Đóng tiền học thêm Toán & Lý', 'bank', 'manual'),
    make(-3, '18:00', 'expense', 420000, 'kids', 'mai_anh', 'Học lớp vẽ & năng khiếu tiếng Anh', 'bank', 'manual'),

    // -4 days
    make(-4, '09:30', 'expense', 330000, 'bills', 'cha_binh', 'Tiền nước & cước Internet cáp quang', 'bank', 'manual'),
    make(-4, '12:40', 'expense', 95000, 'food', 'cha_binh', 'Cơm trưa văn phòng & cà phê', 'ewallet', 'voice'),
    make(-4, '20:00', 'expense', 790000, 'shopping', 'me_trang', 'Mua quần áo thu đông cho cả nhà', 'card', 'manual'),

    // -5 days
    make(-5, '11:20', 'expense', 450000, 'grocery', 'me_trang', 'Thực phẩm tươi sống cho tuần mới', 'ewallet', 'manual'),
    make(-5, '15:00', 'expense', 240000, 'pets', 'mai_anh', 'Mua hạt thức ăn & đồ chơi thú cưng', 'ewallet', 'manual'),

    // -6 days
    make(-6, '10:15', 'expense', 1200000, 'gifts', 'cha_binh', 'Biếu ông bà nội ngoại cuối tuần', 'bank', 'manual'),
    make(-6, '18:45', 'expense', 660000, 'food', 'me_trang', 'Lẩu nướng sum họp 4 thành viên', 'card', 'receipt'),

    // -8 to -15 days
    make(-8, '09:00', 'expense', 1850000, 'kids', 'minh_phat', 'Học phí & tiền bán trú Minh Phát', 'bank', 'manual'),
    make(-8, '09:10', 'expense', 1550000, 'kids', 'mai_anh', 'Học phí & tiền bán trú Mai Anh', 'bank', 'manual'),
    make(-9, '13:15', 'expense', 780000, 'housing', 'me_trang', 'Mua đồ dùng nhà bếp & vệ sinh nhà', 'card', 'manual'),
    make(-10, '10:30', 'expense', 540000, 'grocery', 'me_trang', 'Đi chợ hải sản & trái cây nhập', 'ewallet', 'manual'),
    make(-11, '16:40', 'expense', 450000, 'transport', 'cha_binh', 'Đổ xăng ô tô & bảo dưỡng định kỳ', 'bank', 'manual'),
    make(-13, '08:30', 'expense', 480000, 'health', 'cha_binh', 'Khám nha khoa định kỳ', 'card', 'manual'),

    // Monthly Income (current month)
    makeDate(0, 5, '09:00', 'income', 23500000, 'salary', 'cha_binh', 'Lương tháng Cha Bình', 'bank'),
    makeDate(0, 5, '09:30', 'income', 17500000, 'salary', 'me_trang', 'Lương tháng Mẹ Trang', 'bank'),
    makeDate(0, 12, '15:00', 'income', 3500000, 'bonus', 'cha_binh', 'Thưởng hoàn thành dự án', 'bank'),

    // Previous month (-1 month)
    makeDate(1, 5, '09:00', 'income', 23500000, 'salary', 'cha_binh', 'Lương tháng Cha Bình', 'bank'),
    makeDate(1, 5, '09:30', 'income', 17500000, 'salary', 'me_trang', 'Lương tháng Mẹ Trang', 'bank'),
    makeDate(1, 18, '14:00', 'income', 2100000, 'invest', 'me_trang', 'Lãi tiết kiệm ngân hàng', 'bank'),
    makeDate(1, 3, '10:00', 'expense', 4250000, 'grocery', 'me_trang', 'Đi chợ & siêu thị cả tháng', 'ewallet'),
    makeDate(1, 7, '09:30', 'expense', 2100000, 'kids', 'minh_phat', 'Học phí & học thêm Minh Phát', 'bank'),
    makeDate(1, 7, '09:45', 'expense', 1750000, 'kids', 'mai_anh', 'Học phí & năng khiếu Mai Anh', 'bank'),
    makeDate(1, 10, '11:00', 'expense', 1890000, 'bills', 'cha_binh', 'Điện, nước, internet, phí quản lý', 'bank'),
    makeDate(1, 14, '19:20', 'expense', 2550000, 'food', 'me_trang', 'Ăn uống gia đình trong tháng', 'card'),
    makeDate(1, 17, '16:00', 'expense', 1650000, 'shopping', 'mai_anh', 'Mua sắm quần áo & đồ dùng', 'card'),
    makeDate(1, 21, '10:40', 'expense', 1250000, 'transport', 'cha_binh', 'Xăng xe & gửi xe cả tháng', 'bank'),
    makeDate(1, 24, '15:10', 'expense', 1420000, 'housing', 'cha_binh', 'Sửa chữa & thay thiết bị nhà', 'bank'),
    makeDate(1, 27, '18:30', 'expense', 1180000, 'entertainment', 'cha_binh', 'Đi chơi công viên & ăn tối', 'ewallet'),

    // -2 months
    makeDate(2, 5, '09:00', 'income', 41000000, 'salary', 'cha_binh', 'Tổng lương Cha Bình & Mẹ Trang', 'bank'),
    makeDate(2, 8, '10:00', 'expense', 4500000, 'grocery', 'me_trang', 'Thực phẩm & siêu thị tháng', 'ewallet'),
    makeDate(2, 11, '14:00', 'expense', 3100000, 'food', 'cha_binh', 'Ăn uống & cà phê gia đình', 'card'),
    makeDate(2, 14, '09:00', 'expense', 2100000, 'kids', 'minh_phat', 'Học phí & sách vở Minh Phát', 'bank'),
    makeDate(2, 14, '09:15', 'expense', 1750000, 'kids', 'mai_anh', 'Học phí & đồng phục Mai Anh', 'bank'),
    makeDate(2, 18, '11:30', 'expense', 1750000, 'bills', 'cha_binh', 'Hóa đơn điện nước tháng', 'bank'),
    makeDate(2, 22, '17:00', 'expense', 2100000, 'housing', 'me_trang', 'Mua đồ gia dụng bếp', 'card'),
    makeDate(2, 26, '12:00', 'expense', 1350000, 'transport', 'cha_binh', 'Đi lại & xăng xe', 'bank'),

    // -3 months
    makeDate(3, 5, '09:00', 'income', 41500000, 'salary', 'me_trang', 'Tổng lương & phụ cấp gia đình', 'bank'),
    makeDate(3, 9, '10:00', 'expense', 4600000, 'grocery', 'me_trang', 'Đi chợ & nhu yếu phẩm', 'ewallet'),
    makeDate(3, 13, '19:00', 'expense', 3800000, 'entertainment', 'cha_binh', 'Chuyến du lịch biển 4 người', 'card'),
    makeDate(3, 16, '09:30', 'expense', 1950000, 'kids', 'minh_phat', 'Học thêm & lớp bơi Minh Phát', 'bank'),
    makeDate(3, 16, '09:40', 'expense', 1650000, 'kids', 'mai_anh', 'Học thêm & lớp vẽ Mai Anh', 'bank'),
    makeDate(3, 20, '10:15', 'expense', 1980000, 'bills', 'cha_binh', 'Hóa đơn điện nước mùa nóng', 'bank'),
    makeDate(3, 25, '16:00', 'expense', 2400000, 'food', 'me_trang', 'Ăn uống ngoài gia đình', 'ewallet'),

    // -4 months
    makeDate(4, 5, '09:00', 'income', 40500000, 'salary', 'cha_binh', 'Tổng lương gia đình', 'bank'),
    makeDate(4, 10, '10:00', 'expense', 4200000, 'grocery', 'me_trang', 'Siêu thị & chợ tháng', 'ewallet'),
    makeDate(4, 14, '09:00', 'expense', 3400000, 'kids', 'minh_phat', 'Học phí đầu kỳ 2 con', 'bank'),
    makeDate(4, 18, '14:00', 'expense', 2950000, 'food', 'cha_binh', 'Ăn uống & tiệc gia đình', 'card'),
    makeDate(4, 21, '11:00', 'expense', 1820000, 'bills', 'cha_binh', 'Điện nước & sinh hoạt', 'bank'),
    makeDate(4, 26, '15:00', 'expense', 1650000, 'health', 'me_trang', 'Khám sức khỏe tổng quát 4 người', 'card'),

    // -5 months
    makeDate(5, 5, '09:00', 'income', 40000000, 'salary', 'cha_binh', 'Tổng lương gia đình', 'bank'),
    makeDate(5, 9, '10:00', 'expense', 3950000, 'grocery', 'me_trang', 'Đi chợ & đồ ăn gia đình', 'ewallet'),
    makeDate(5, 13, '18:00', 'expense', 2600000, 'food', 'cha_binh', 'Ăn uống gia đình', 'card'),
    makeDate(5, 17, '09:00', 'expense', 3300000, 'kids', 'mai_anh', 'Học phí 2 con', 'bank'),
    makeDate(5, 22, '10:00', 'expense', 1680000, 'bills', 'cha_binh', 'Hóa đơn tiện ích', 'bank'),
    makeDate(5, 25, '14:00', 'expense', 1900000, 'gifts', 'me_trang', 'Biếu quà hai bên gia đình', 'bank'),
  ];

  const todayKey = toDateKey(today);
  return txs.filter((tx) => tx.date <= todayKey);
}
