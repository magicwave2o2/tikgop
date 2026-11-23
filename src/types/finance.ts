export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'ewallet';

export type Timeframe = 'day' | 'week' | 'month' | 'year';

export type AppTab = 'overview' | 'history' | 'analytics' | 'settings';

export type ThemeMode = 'light' | 'dark' | 'system';

export type IconName =
  | 'UtensilsCrossed'
  | 'ShoppingBasket'
  | 'Zap'
  | 'Home'
  | 'Car'
  | 'GraduationCap'
  | 'HeartPulse'
  | 'ShoppingBag'
  | 'Sparkles'
  | 'Gift'
  | 'PawPrint'
  | 'MoreHorizontal'
  | 'Briefcase'
  | 'Award'
  | 'Store'
  | 'TrendingUp'
  | 'Wallet'
  | 'UserRound'
  | 'Heart'
  | 'Baby'
  | 'Users'
  | 'Coffee'
  | 'Gamepad2'
  | 'Plane'
  | 'Smartphone'
  | 'Wrench'
  | 'BookOpen'
  | 'Music'
  | 'Dumbbell'
  | 'Pill'
  | 'PiggyBank'
  | 'Coins'
  | 'Landmark';

export interface Category {
  id: string;
  name: string;
  shortName: string;
  type: TransactionType;
  icon: IconName;
  color: string;
  budget?: number;
  quickNotes?: string[];
  isCustom?: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  icon: IconName;
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  memberId: string;
  /** Local date string YYYY-MM-DD */
  date: string;
  /** Local time string HH:mm */
  time: string;
  note: string;
  paymentMethod: PaymentMethod;
  /** Optional compressed receipt thumbnail (data URL) from receipt scan */
  receiptImage?: string;
  /** How this entry was recorded */
  source?: 'manual' | 'receipt' | 'voice';
  createdAt: number;
}

export interface FamilySettings {
  familyName: string;
  monthlyBudget: number;
  theme: ThemeMode;
  activeMemberId: string;
}

export interface TransactionDraft {
  type?: TransactionType;
  amount?: number;
  categoryId?: string;
  memberId?: string;
  date?: string;
  time?: string;
  note?: string;
  paymentMethod?: PaymentMethod;
  receiptImage?: string;
  source?: 'manual' | 'receipt' | 'voice';
}

export interface FinanceState {
  version: number;
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
  settings: FamilySettings;
  hasSampleData: boolean;
}

export interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  shortLabel: string;
  subLabel: string;
  daysCount: number;
}

export interface CategoryBreakdownItem {
  category: Category;
  amount: number;
  count: number;
  percentage: number;
  avgAmount: number;
  budgetRatio: number | null;
}

export interface MemberBreakdownItem {
  member: FamilyMember;
  amount: number;
  count: number;
  percentage: number;
}

export interface TrendBucket {
  key: string;
  label: string;
  subLabel: string;
  expense: number;
  income: number;
  count: number;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
}

export interface DateGroup {
  dateKey: string;
  title: string;
  subtitle: string;
  totalExpense: number;
  totalIncome: number;
  items: Transaction[];
}

export interface SmartInsight {
  id: string;
  icon: IconName;
  tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
  title: string;
  detail: string;
}
