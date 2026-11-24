import React, { memo, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Monitor,
  Moon,
  Plus,
  Share,
  Sun,
  Tag,
  Trash2,
  Upload,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  CategoryIconBadge,
  DynamicIcon,
  SELECTABLE_CATEGORY_ICONS,
  SELECTABLE_MEMBER_ICONS,
} from '../components/IconRenderer';
import { COLOR_PALETTE } from '../data/defaults';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useFinance } from '../store/useFinanceStore';
import type { IconName, ThemeMode, TransactionType } from '../types/finance';
import { formatCompactVND, formatRawAmount, parseRawAmount } from '../utils/format';

const BUDGET_PRESETS = [15_000_000, 20_000_000, 25_000_000, 30_000_000, 40_000_000];

export const SettingsView: React.FC = memo(() => {
  const {
    state,
    activeMember,
    setActiveMember,
    updateSettings,
    addMember,
    deleteMember,
    addCategory,
    updateCategoryBudget,
    deleteCategory,
    exportJSON,
    exportCSV,
    importJSON,
    clearAllTransactions,
  } = useFinance();

  const { canInstall, isInstalled, isIOS, isOnline, promptInstall } = usePWAInstall();

  const [familyName, setFamilyName] = useState(state.settings.familyName);
  const [budgetText, setBudgetText] = useState(
    formatRawAmount(String(state.settings.monthlyBudget)),
  );
  const [savedNotice, setSavedNotice] = useState(false);

  // Add Member form
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Thành viên');
  const [memberIcon, setMemberIcon] = useState<IconName>('UserRound');
  const [memberColor, setMemberColor] = useState('#3B82F6');

  // Add Category form & filter
  const [catTab, setCatTab] = useState<TransactionType>('expense');
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catIcon, setCatIcon] = useState<IconName>('Coffee');
  const [catColor, setCatColor] = useState('#F97316');
  const [editingBudgetCatId, setEditingBudgetCatId] = useState<string | null>(null);
  const [catBudgetDraft, setCatBudgetDraft] = useState('');

  // Safe inline confirm for clearing data
  const [confirmClear, setConfirmClear] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleCategories = useMemo(
    () => state.categories.filter((c) => c.type === catTab),
    [state.categories, catTab],
  );

  const handleSaveFamilySettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      familyName: familyName.trim() || 'Gia Đình Nhỏ',
      monthlyBudget: parseRawAmount(budgetText),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    addMember({
      name: memberName.trim(),
      role: memberRole.trim() || 'Thành viên',
      icon: memberIcon,
      color: memberColor,
    });
    setMemberName('');
    setShowMemberForm(false);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    addCategory({
      name: catName.trim(),
      shortName: catName.trim().slice(0, 12),
      type: catType,
      icon: catIcon,
      color: catColor,
    });
    setCatName('');
    setShowCatForm(false);
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = () => {
      const res = importJSON(String(reader.result || ''));
      if (!res.ok && res.error) setImportError(res.error);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Compact Header + Slim PWA Status Pill */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
          Gia đình & Cài đặt
        </h2>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            isOnline
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
          }`}
        >
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isInstalled ? 'Đã cài PWA' : isOnline ? 'Ngoại tuyến sẵn sàng' : 'Ngoại tuyến'}</span>
        </span>
      </div>

      {/* Slim Single-Row Dark Banner (install CTA / iOS tip) */}
      {(canInstall || (!isInstalled && isIOS)) && (
        <section className="relative overflow-hidden rounded-2xl px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-md">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.png"
                alt="TíchGóp"
                className="w-9 h-9 rounded-xl bg-white object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold truncate">Ứng dụng TíchGóp</div>
                {!isInstalled && isIOS && (
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-200">
                    <Share size={11} />
                    <span>Chia sẻ → Thêm vào MH chính</span>
                  </div>
                )}
              </div>
            </div>

            {canInstall && (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <Download size={14} />
                <span>Cài app</span>
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Family Budget, Theme & Backup */}
        <div className="lg:col-span-6 space-y-4">
          {/* Family Profile & Monthly Budget */}
          <section className="card-surface rounded-3xl p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-3.5">
              Hồ sơ & Hạn mức tháng
            </h3>

            <form onSubmit={handleSaveFamilySettings} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Tên gia đình
                  </label>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-[#0b1019] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/70"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Hạn mức tháng (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={budgetText}
                    onChange={(e) => setBudgetText(formatRawAmount(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-sm font-extrabold tabular-nums bg-slate-50 dark:bg-[#0b1019] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/70"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex flex-wrap gap-1">
                  {BUDGET_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBudgetText(formatRawAmount(String(val)))}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer"
                    >
                      {formatCompactVND(val)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {savedNotice && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} />
                      Đã lưu
                    </span>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm shadow-emerald-500/25 active:scale-95 transition-transform duration-100 cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Sleek Single-Row Theme Segmented Control */}
          <section className="card-surface rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Giao diện
            </h3>
            <div className="inline-grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-[#0b1019] dark:border dark:border-white/[0.06]">
              {(
                [
                  { id: 'light', label: 'Sáng', icon: Sun },
                  { id: 'dark', label: 'Tối', icon: Moon },
                  { id: 'system', label: 'Máy', icon: Monitor },
                ] as Array<{ id: ThemeMode; label: string; icon: typeof Sun }>
              ).map((item) => {
                const active = state.settings.theme === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateSettings({ theme: item.id })}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-[#1a2335] text-emerald-600 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Compact Backup, Export & Data Controls */}
          <section className="card-surface rounded-3xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-sky-500/12 text-sky-500 flex items-center justify-center">
                  <Database size={15} />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Dữ liệu
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {state.transactions.length} GD
                </span>
              </div>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Xóa hết
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearAllTransactions();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-500 text-white cursor-pointer"
                  >
                    Xác nhận
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    exportCSV(),
                    `TichGop-ChiTieu-${new Date().toISOString().slice(0, 10)}.csv`,
                    'text/csv;charset=utf-8',
                  )
                }
                className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>Excel CSV</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    exportJSON(),
                    `TichGop-Backup-${new Date().toISOString().slice(0, 10)}.json`,
                    'application/json',
                  )
                }
                className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300 text-[11px] sm:text-xs font-bold hover:bg-sky-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <Download size={15} />
                <span>Sao lưu</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-slate-100 dark:bg-white/[0.05] dark:border dark:border-white/[0.07] text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/[0.09] active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <Upload size={15} />
                <span>Khôi phục</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            {importError && (
              <p className="text-xs font-semibold text-rose-500">{importError}</p>
            )}
          </section>
        </div>

        {/* Right Column: Family Members & Custom Categories */}
        <div className="lg:col-span-6 space-y-4">
          {/* Family Members */}
          <section className="card-surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center">
                  <Users size={15} />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Thành viên ({state.members.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowMemberForm((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
              >
                <Plus size={13} />
                <span>Thêm</span>
              </button>
            </div>

            {showMemberForm && (
              <form
                onSubmit={handleCreateMember}
                className="mb-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b1019] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Tên (vd: Ông nội)"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#141b29] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Vai trò"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#141b29] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SELECTABLE_MEMBER_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setMemberIcon(ic)}
                      className={`p-1.5 rounded-xl border cursor-pointer ${
                        memberIcon === ic
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-[#141b29] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <DynamicIcon name={ic} size={14} />
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMemberColor(c)}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                        memberColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMemberForm(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {state.members.map((m) => {
                const isCurrent = m.id === activeMember.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-colors ${
                      isCurrent
                        ? 'bg-emerald-500/8 dark:bg-emerald-500/12 border-emerald-500/35 dark:border-emerald-400/35'
                        : 'bg-slate-50/80 dark:bg-white/[0.03] border-transparent dark:border-white/[0.05]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveMember(m.id)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isCurrent ? m.color : `${m.color}20`,
                          color: isCurrent ? '#ffffff' : m.color,
                        }}
                      >
                        <DynamicIcon name={m.icon} size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {m.name}
                          </span>
                          {isCurrent && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {isCurrent ? 'Đang dùng trên máy' : m.role}
                        </div>
                      </div>
                    </button>
                    {state.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteMember(m.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer shrink-0"
                        aria-label={`Xóa ${m.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Categories Manager with Clean Chi/Thu Filter Tabs */}
          <section className="card-surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/12 text-amber-500 flex items-center justify-center">
                  <Tag size={15} />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Danh mục
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-[#0b1019] dark:border dark:border-white/[0.06]">
                  {(['expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCatTab(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        catTab === t
                          ? 'bg-white dark:bg-[#1a2335] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {t === 'expense' ? 'Chi' : 'Thu'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCatType(catTab);
                    setShowCatForm((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Mới</span>
                </button>
              </div>
            </div>

            {showCatForm && (
              <form
                onSubmit={handleCreateCategory}
                className="mb-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b1019] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tên danh mục (vd: Thể thao)"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#141b29] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as TransactionType)}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#141b29] border border-slate-200 dark:border-white/[0.08]"
                  >
                    <option value="expense">Chi tiêu</option>
                    <option value="income">Thu nhập</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {SELECTABLE_CATEGORY_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setCatIcon(ic)}
                      className={`p-1.5 rounded-xl border cursor-pointer ${
                        catIcon === ic
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-[#141b29] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <DynamicIcon name={ic} size={14} />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                        catColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatForm(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white cursor-pointer"
                  >
                    Tạo
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
              {visibleCategories.map((cat) => {
                const isEditingBudget = editingBudgetCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-transparent dark:border-white/[0.05] hover:border-slate-200 dark:hover:border-white/12 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIconBadge icon={cat.icon} color={cat.color} size="sm" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {cat.shortName}
                          </div>
                          {cat.type === 'expense' && (
                            <div className="text-[10px] text-slate-400 tabular-nums">
                              {cat.budget ? `${formatCompactVND(cat.budget)}/tháng` : 'Chưa đặt hạn mức'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {cat.type === 'expense' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingBudget) {
                                setEditingBudgetCatId(null);
                              } else {
                                setEditingBudgetCatId(cat.id);
                                setCatBudgetDraft(
                                  cat.budget ? formatRawAmount(String(cat.budget)) : '',
                                );
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-[#0b1019] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer"
                          >
                            {isEditingBudget ? 'Đóng' : 'Hạn mức'}
                          </button>
                        )}
                        {cat.isCustom && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            aria-label={`Xóa ${cat.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingBudget && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.07] flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="VD: 3.000.000"
                          value={catBudgetDraft}
                          onChange={(e) => setCatBudgetDraft(formatRawAmount(e.target.value))}
                          className="flex-1 min-w-0 px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums bg-white dark:bg-[#0b1019] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseRawAmount(catBudgetDraft);
                            updateCategoryBudget(cat.id, val > 0 ? val : undefined);
                            setEditingBudgetCatId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Lưu
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});
