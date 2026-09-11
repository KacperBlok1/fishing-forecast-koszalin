import { IconAlert, IconInfo, IconOffline, IconRefresh } from './Icons';

export type NoticeKind = 'offline' | 'stale' | 'error' | 'info';

interface StatusNoticeProps {
  kind: NoticeKind;
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ICONS = {
  offline: IconOffline,
  stale: IconInfo,
  error: IconAlert,
  info: IconInfo,
};

export default function StatusNotice({ kind, title, message, onRetry, retryLabel = 'Spróbuj ponownie' }: StatusNoticeProps) {
  const Icon = ICONS[kind];
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="btn btn-small" onClick={onRetry}>
            <IconRefresh size={15} /> {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
