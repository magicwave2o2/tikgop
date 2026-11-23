import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useFinance } from '../store/useFinanceStore';
import { DynamicIcon } from './IconRenderer';

export const MemberOnboarding: React.FC = () => {
  const { state, setActiveMember } = useFinance();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedId) return;
    setActiveMember(selectedId, false);
  };

  return (
    <div className="min-h-dvh w-full flex items-center justify-center p-4 sm:p-6 bg-[#f4f6fa] dark:bg-[#0b0e14] relative overflow-hidden">
      {/* Soft ambient background orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-teal-400/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-md card-surface rounded-[2.25rem] p-6 sm:p-8 shadow-2xl"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <motion.img
            initial={{ scale: 0.85, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            src="/favicon.svg"
            alt="TíchGóp"
            className="w-16 h-16 rounded-3xl shadow-xl shadow-emerald-500/25 mb-4"
          />
          <span className="px-3 py-1 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            {state.settings.familyName}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-3">
            Bạn là thành viên nào?
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs">
            Chọn một lần duy nhất — thiết bị này sẽ tự động ghi nhớ cho các lần mở ứng dụng tiếp theo.
          </p>
        </div>

        {/* 4 Family Member Cards */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {state.members.map((m, idx) => {
            const active = selectedId === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.05 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedId(m.id)}
                className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 shadow-lg'
                    : 'bg-slate-50/80 dark:bg-slate-800/45 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                }`}
                style={
                  active
                    ? {
                        borderColor: m.color,
                        boxShadow: `0 12px 28px -10px ${m.color}55`,
                      }
                    : undefined
                }
              >
                {active && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full text-white flex items-center justify-center"
                    style={{ backgroundColor: m.color }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.span>
                )}

                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: active ? m.color : `${m.color}1C`,
                    color: active ? '#ffffff' : m.color,
                  }}
                >
                  <DynamicIcon name={m.icon} size={27} strokeWidth={2.1} />
                </div>

                <div className="text-center">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {m.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                    {m.role}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Confirm CTA */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={!selectedId}
          onClick={handleConfirm}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 disabled:shadow-none transition-all cursor-pointer"
        >
          <span>Bắt đầu sử dụng</span>
          <ArrowRight size={17} strokeWidth={2.5} />
        </motion.button>

        <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px] text-slate-400">
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
          <span>Có thể đổi lại sau trong mục Gia đình</span>
        </div>
      </motion.div>
    </div>
  );
};
