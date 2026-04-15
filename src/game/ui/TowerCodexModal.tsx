import { X } from 'lucide-react';
import { getLocale } from '../i18n';
import { TOWER_STATS, TowerType } from '../types';
import { TowerIcon } from './icons';

type TowerCodexModalProps = {
  tower: TowerType;
  labels: {
    towerName: Partial<Record<TowerType, string>>;
    towerDesc: Partial<Record<TowerType, string>>;
    towerCodex: Partial<Record<TowerType, string>>;
  };
  onClose: () => void;
};

export const TowerCodexModal = ({ tower, labels, onClose }: TowerCodexModalProps) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-sm"
    onClick={onClose}
    role="presentation"
  >
    <div
      className="max-w-md w-full bg-gray-900/98 border border-gray-700 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden"
      onClick={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-title"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-gray-300 shrink-0 p-2 rounded-lg bg-gray-800/80 border border-gray-700">
            <TowerIcon type={tower} size={26} />
          </div>
          <h2 id="codex-title" className="text-lg font-bold text-white leading-tight truncate">
            {labels.towerName[tower] ?? tower}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label={getLocale() === 'zh' ? '关闭' : 'Close'}
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-4 max-h-[min(70vh,28rem)] overflow-y-auto">
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
          {labels.towerCodex[tower] ?? labels.towerDesc[tower] ?? TOWER_STATS[tower].description}
        </p>
      </div>
    </div>
  </div>
);
