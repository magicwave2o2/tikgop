import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Receipt, Trash2 } from 'lucide-react';
import type { Category, FamilyMember, Transaction } from '../types/finance';
import { formatVND } from '../utils/format';
import { CategoryIconBadge, DynamicIcon, PaymentMethodIcon } from './IconRenderer';

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category;
  member?: FamilyMember;
  onEdit: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
  showDate?: boolean;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  category,
  member,
  onEdit,
  onDelete,
  showDate = false,
}) => {
  const isIncome = transaction.type === 'income';
  const catColor = category?.color || '#64748B';
  const catIcon = category?.icon || 'MoreHorizontal';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onEdit(transaction)}
      className="group relative flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
    >
      <CategoryIconBadge icon={catIcon} color={catColor} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {transaction.note.trim() || category?.name || 'Giao dịch'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: `${catColor}14`, color: catColor }}
          >
            {category?.shortName || 'Khác'}
          </span>

          {member && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
              <DynamicIcon name={member.icon} size={11} style={{ color: member.color }} />
              {member.name}
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <PaymentMethodIcon method={transaction.paymentMethod} size={11} />
            <span className="tabular-nums">
              {showDate
                ? `${transaction.date.slice(8, 10)}/${transaction.date.slice(5, 7)} • ${transaction.time}`
                : transaction.time}
            </span>
          </span>

          {(transaction.receiptImage || transaction.source === 'receipt') && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 font-semibold"
              title="Nhập từ quét hóa đơn"
            >
              <Receipt size={10} />
              <span>Bill</span>
            </span>
          )}

          {transaction.source === 'voice' && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-500/12 text-violet-600 dark:text-violet-400 font-semibold"
              title="Nhập bằng giọng nói"
            >
              <Mic size={10} />
              <span>Voice</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div
            className={`text-sm font-extrabold tabular-nums ${
              isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {isIncome ? '+' : '-'}
            {formatVND(transaction.amount)}
          </div>
        </div>

        {onDelete && (
          <button
            type="button"
            aria-label="Xóa giao dịch"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(transaction.id);
            }}
            className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </motion.div>
  );
};
