export type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: StatusBadgeTone;
}

const BADGE_BASE_CLASS_NAME = [
  'status-badge inline-flex min-h-7 max-w-full items-center gap-1.5 whitespace-nowrap rounded-pill py-0.5 pl-2 pr-2.5',
  'text-[12px] font-semibold leading-none transition-[transform,box-shadow] duration-fast',
].join(' ');

const BADGE_TONE_CLASS_NAMES: Record<StatusBadgeTone, string> = {
  success: 'status-badge--success bg-success-bg/80 text-success',
  warning: 'status-badge--warning bg-warning-bg/80 text-warning',
  danger: 'status-badge--danger bg-danger-bg/80 text-danger',
  info: 'status-badge--info bg-info-bg/80 text-info',
  neutral: 'status-badge--neutral bg-neutral-bg/80 text-neutral',
  accent: 'status-badge--accent bg-primary/12 text-text-accent',
};

const SUCCESS_STATUSES = new Set([
  'active',
  'approved',
  'paid',
  'verified',
  'completed',
  'delivered',
  'converted',
  'success',
  'read',
  'in-stock',
]);

const WARNING_STATUSES = new Set([
  'pending',
  'waiting_payment',
  'negotiating',
  'packed',
  'warning',
  'unpaid',
  'partially-refunded',
]);

const DANGER_STATUSES = new Set([
  'failed',
  'rejected',
  'cancelled',
  'lost',
  'out-of-stock',
  'low-stock',
  'danger',
  'refunded',
  'returned',
]);

const INFO_STATUSES = new Set([
  'new',
  'contacted',
  'confirmed',
  'info',
  'sent',
  'delivered',
  'draft',
]);

function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getStatusBadgeTone(status: string): StatusBadgeTone {
  const normalizedStatus = status.toLowerCase().replace(/_/g, '-');

  if (SUCCESS_STATUSES.has(normalizedStatus)) {
    return 'success';
  }

  if (WARNING_STATUSES.has(normalizedStatus)) {
    return 'warning';
  }

  if (DANGER_STATUSES.has(normalizedStatus)) {
    return 'danger';
  }

  if (INFO_STATUSES.has(normalizedStatus)) {
    return 'info';
  }

  return 'neutral';
}

function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? getStatusBadgeTone(status);

  return (
    <span
      className={`${BADGE_BASE_CLASS_NAME} ${BADGE_TONE_CLASS_NAMES[resolvedTone]}`}
    >
      <span className="status-badge__dot relative inline-flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {resolvedTone === 'warning' || resolvedTone === 'info' ? (
          <span className="status-badge__ping absolute inset-0 rounded-full bg-current opacity-60" />
        ) : null}
        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      <span className="truncate">{label ?? formatStatusLabel(status)}</span>
    </span>
  );
}

export default StatusBadge;
