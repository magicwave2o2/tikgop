import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Share,
  ShieldCheck,
  Smartphone,
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

export const SettingsView: React.FC = () => {
  const {
    state,
    activeMember,
    setActiveMember,
    updateSettings,
    addMember,
    deleteMember,
    addCategory,
    deleteCategory,
    exportJSON,
    exportCSV,
    importJSON,
    loadSampleData,
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

  // Add Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catIcon, setCatIcon] = useState<IconName>('Coffee');
  const [catColor, setCatColor] = useState('#F97316');

  // Safe inline confirm for clearing data
  const [confirmClear, setConfirmClear] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Gia đình & Cài đặt PWA
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Tùy chỉnh ngân sách, thành viên, danh mục và sao lưu ngoại tuyến an toàn
        </p>
      </div>

      {/* PWA App Install & Offline Readiness Card */}
      <section className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-xl">
        <div className="pointer-events-none absolute -top-12 -right-10 w-44 h-44 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Smartphone size={24} className="text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold">Ứng dụng PWA TíchGóp</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isOnline
                      ? 'bg-emerald-500/25 text-emerald-200'
                      : 'bg-amber-500/30 text-amber-200'
                  }`}
                >
                  {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {isOnline ? 'Sẵn sàng ngoại tuyến' : 'Đang dùng ngoại tuyến'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                {isInstalled
                  ? 'Tuyệt vời! TíchGóp đang chạy ở chế độ ứng dụng độc lập toàn màn hình. Mọi dữ liệu lưu ngay trên thiết bị, không cần mạng vẫn ghi chi tiêu mượt mà.'
                  : 'Cài đặt TíchGóp lên màn hình chính điện thoại hoặc máy tính để mở siêu nhanh, dùng toàn màn hình và hoạt động 100% không cần Internet.'}
              </p>
              {!isInstalled && isIOS && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-[11px] font-medium text-emerald-100">
                  <Share size={13} />
                  <span>iOS Safari: Nhấn nút Chia sẻ → chọn &quot;Thêm vào MH chính&quot;</span>
                </div>
              )}
            </div>
          </div>

          {canInstall && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => void promptInstall()}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/30 transition-colors cursor-pointer"
            >
              <Download size={16} />
              <span>Cài đặt ứng dụng</span>
            </motion.button>
          )}
          {isInstalled && (
            <div className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/20 text-emerald-200 text-xs font-bold">
              <CheckCircle2 size={16} />
              <span>Đã cài PWA</span>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Family Budget & Theme */}
        <div className="lg:col-span-6 space-y-5">
          {/* Family Profile & Monthly Budget */}
          <section className="card-surface rounded-3xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Hồ sơ gia đình & Hạn mức tháng
            </h3>

            <form onSubmit={handleSaveFamilySettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Tên gia đình
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Ngân sách chi tiêu hàng tháng (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetText}
                  onChange={(e) => setBudgetText(formatRawAmount(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-base font-extrabold tabular-nums bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {BUDGET_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBudgetText(formatRawAmount(String(val)))}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 cursor-pointer"
                    >
                      {formatCompactVND(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {savedNotice ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={15} />
                    Đã lưu thay đổi
                  </span>
                ) : (
                  <span />
                )}

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  Lưu thiết lập
                </motion.button>
              </div>
            </form>
          </section>

          {/* Theme Switcher */}
          <section className="card-surface rounded-3xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Giao diện hiển thị
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light', label: 'Sáng', icon: Sun },
                  { id: 'dark', label: 'Tối', icon: Moon },
                  { id: 'system', label: 'Theo máy', icon: Monitor },
                ] as Array<{ id: ThemeMode; label: string; icon: typeof Sun }>
              ).map((item) => {
                const active = state.settings.theme === item.id;
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => updateSettings({ theme: item.id })}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/12 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon size={19} />
                    <span>{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Backup, Export & Data Controls */}
          <section className="card-surface rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/12 text-sky-500 flex items-center justify-center">
                <Database size={17} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sao lưu & Dữ liệu ({state.transactions.length} giao dịch)
                </h3>
                <p className="text-xs text-slate-400">
                  Dữ liệu lưu cục bộ bảo mật 100% trên thiết bị của bạn
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  triggerDownload(
                    exportCSV(),
                    `TichGop-ChiTieu-${new Date().toISOString().slice(0, 10)}.csv`,
                    'text/csv;charset=utf-8',
                  )
                }
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={16} />
                <span>Xuất Excel (CSV)</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  triggerDownload(
                    exportJSON(),
                    `TichGop-Backup-${new Date().toISOString().slice(0, 10)}.json`,
                    'application/json',
                  )
                }
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-500/20 transition-colors cursor-pointer"
              >
                <Download size={16} />
                <span>Sao lưu JSON</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <Upload size={16} />
                <span>Khôi phục JSON</span>
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={loadSampleData}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-violet-500/12 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-colors cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Nạp dữ liệu mẫu</span>
              </motion.button>
            </div>

            {importError && (
              <p className="text-xs font-semibold text-rose-500">{importError}</p>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Không gửi dữ liệu ra máy chủ ngoài</span>
              </div>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Xóa hết giao dịch
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearAllTransactions();
                      setConfirmClear(false);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500 text-white cursor-pointer"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Family Members & Custom Categories */}
        <div className="lg:col-span-6 space-y-5">
          {/* Family Members */}
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center">
                  <Users size={17} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Thành viên gia đình
                  </h3>
                  <p className="text-xs text-slate-400">{state.members.length} thành viên</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMemberForm((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>Thêm</span>
              </button>
            </div>

            {showMemberForm && (
              <form
                onSubmit={handleCreateMember}
                className="mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Tên (vd: Ông nội)"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Vai trò"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SELECTABLE_MEMBER_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setMemberIcon(ic)}
                      className={`p-2 rounded-xl border cursor-pointer ${
                        memberIcon === ic
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <DynamicIcon name={ic} size={15} />
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMemberColor(c)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
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
                    Thêm thành viên
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {state.members.map((m) => {
                const isCurrent = m.id === activeMember.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-colors ${
                      isCurrent
                        ? 'bg-emerald-500/8 border-emerald-500/30'
                        : 'bg-slate-50/80 dark:bg-slate-800/45 border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveMember(m.id)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${m.color}1E`, color: m.color }}
                      >
                        <DynamicIcon name={m.icon} size={19} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {m.name}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                              Đang dùng
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{m.role}</div>
                      </div>
                    </button>
                    {state.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteMember(m.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer shrink-0"
                        aria-label={`Xóa ${m.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Categories Manager */}
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/12 text-amber-500 flex items-center justify-center">
                  <Tag size={17} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Danh mục phân loại
                  </h3>
                  <p className="text-xs text-slate-400">
                    {state.categories.length} danh mục sẵn có & tùy chỉnh
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCatForm((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>Tạo mới</span>
              </button>
            </div>

            {showCatForm && (
              <form
                onSubmit={handleCreateCategory}
                className="mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tên danh mục (vd: Thể thao)"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as TransactionType)}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                      className={`p-2 rounded-xl border cursor-pointer ${
                        catIcon === ic
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <DynamicIcon name={ic} size={15} />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
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
                    Tạo danh mục
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {state.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/45"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIconBadge icon={cat.icon} color={cat.color} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {cat.shortName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {cat.type === 'expense' ? 'Chi' : 'Thu'}
                      </div>
                    </div>
                  </div>
                  {cat.isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 shrink-0 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
