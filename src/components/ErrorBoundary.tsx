import React from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi giao diện không mong muốn.',
    };
  }

  handleEmergencyExport = () => {
    try {
      const raw = localStorage.getItem('tikgop_family_finance_v2') || '{}';
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TichGop-Emergency-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore export errors
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[#f4f6fa] dark:bg-[#0b0e14]">
        <div className="w-full max-w-md card-surface rounded-3xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/12 text-rose-500 mx-auto flex items-center justify-center">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              TíchGóp gặp sự cố tạm thời
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Dữ liệu gia đình của bạn vẫn được bảo toàn an toàn trên thiết bị. Hãy tải lại ứng dụng hoặc tải bản sao lưu dự phòng.
            </p>
            {this.state.errorMessage && (
              <p className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-500 truncate">
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleEmergencyExport}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              <Download size={15} />
              <span>Sao lưu JSON</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-500/25 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Tải lại app</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
