import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
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
    <div className="min-h-dvh w-full flex items-center justify-center p-4 sm:p-6 bg-[#f5f7fb] dark:bg-[#070a10] relative overflow-hidden">
      {/* Zero-cost pure radial gradient aura (no GPU blur-3xl filter on iOS) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle 280px at 12% 10%, rgba(16,185,129,0.16), transparent 70%), radial-gradient(circle 300px at 88% 92%, rgba(20,184,166,0.14), transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md card-surface rounded-[2.25rem] p-6 sm:p-8 shadow-2xl animate-ios-sheet">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="TíchGóp"
            className="w-20 h-20 rounded-3xl bg-white border border-slate-200/80 dark:border-white/15 object-cover shadow-xl shadow-emerald-500/20 mb-4"
          />
          <span className="px-3 py-1 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            {state.settings.familyName}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-3">
            Bạn là thành viên nào?
          </h1>
        </div>

        {/* 4 Family Member Cards */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {state.members.map((m) => {
            const active = selectedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-3xl border-2 active:scale-[0.95] transition-transform duration-100 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#172031] shadow-lg'
                    : 'bg-slate-50/80 dark:bg-white/[0.03] border-transparent hover:border-slate-200 dark:hover:border-white/12'
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
                  <span
                    className="absolute top-3 right-3 w-6 h-6 rounded-full text-white flex items-center justify-center"
                    style={{ backgroundColor: m.color }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}

                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: active ? m.color : `${m.color}20`,
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
              </button>
            );
          })}
        </div>

        {/* Confirm CTA */}
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleConfirm}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/30 disabled:opacity-40 disabled:shadow-none active:scale-[0.97] transition-transform duration-100 cursor-pointer"
        >
          <span>Bắt đầu</span>
          <ArrowRight size={17} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
