import React from 'react';
import {
  Award,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  MoreHorizontal,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IconName, PaymentMethod } from '../types/finance';

const ICON_MAP: Record<IconName, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBasket,
  Zap,
  Home,
  Car,
  GraduationCap,
  HeartPulse,
  ShoppingBag,
  Sparkles,
  Gift,
  PawPrint,
  MoreHorizontal,
  Briefcase,
  Award,
  Store,
  TrendingUp,
  Wallet,
  UserRound,
  Heart,
  Baby,
  Users,
  Coffee,
  Gamepad2,
  Plane,
  Smartphone,
  Wrench,
  BookOpen,
  Music,
  Dumbbell,
  Pill,
  PiggyBank,
  Coins,
  Landmark,
};

export const SELECTABLE_CATEGORY_ICONS: IconName[] = [
  'UtensilsCrossed',
  'Coffee',
  'ShoppingBasket',
  'ShoppingBag',
  'Zap',
  'Home',
  'Car',
  'GraduationCap',
  'BookOpen',
  'HeartPulse',
  'Pill',
  'Sparkles',
  'Gamepad2',
  'Plane',
  'Gift',
  'PawPrint',
  'Smartphone',
  'Wrench',
  'Music',
  'Dumbbell',
  'Briefcase',
  'Award',
  'Store',
  'TrendingUp',
  'PiggyBank',
  'Coins',
  'Wallet',
  'Landmark',
];

export const SELECTABLE_MEMBER_ICONS: IconName[] = [
  'Home',
  'UserRound',
  'Heart',
  'Baby',
  'Users',
  'Sparkles',
  'Briefcase',
  'GraduationCap',
];

export const DynamicIcon: React.FC<{
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}> = ({ name, className, size = 20, strokeWidth = 2, style }) => {
  const Component = ICON_MAP[name] || MoreHorizontal;
  return <Component className={className} size={size} strokeWidth={strokeWidth} style={style} />;
};

export const CategoryIconBadge: React.FC<{
  icon: IconName;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  className?: string;
}> = ({ icon, color, size = 'md', active = false, className = '' }) => {
  const dims =
    size === 'sm'
      ? 'w-8 h-8 rounded-xl'
      : size === 'lg'
        ? 'w-12 h-12 rounded-2xl'
        : 'w-10 h-10 rounded-2xl';

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 19;

  return (
    <div
      className={`shrink-0 flex items-center justify-center transition-all duration-200 ${dims} ${className}`}
      style={{
        backgroundColor: active ? color : `${color}1A`,
        color: active ? '#ffffff' : color,
        boxShadow: active ? `0 8px 18px -6px ${color}99` : undefined,
      }}
    >
      <DynamicIcon name={icon} size={iconSize} strokeWidth={2.1} />
    </div>
  );
};

export const PaymentMethodIcon: React.FC<{
  method: PaymentMethod;
  size?: number;
  className?: string;
}> = ({ method, size = 14, className }) => {
  switch (method) {
    case 'bank':
      return <Landmark size={size} className={className} />;
    case 'cash':
      return <Banknote size={size} className={className} />;
    case 'ewallet':
      return <Smartphone size={size} className={className} />;
    case 'card':
      return <CreditCard size={size} className={className} />;
  }
};
