import type { ReactNode } from 'react';

type StatTrendDirection = 'up' | 'down' | 'neutral';

interface StatCardProps {
  title: string;
  value: ReactNode;
  subtitle?: string;
  trend?: {
    direction: StatTrendDirection;
    label: string;
  };
}

const CARD_CLASS_NAME = [
  'stat-card relative flex min-h-[148px] items-start justify-between gap-3 overflow-hidden rounded-[20px]',
  'bg-surface-card p-5 shadow-md ring-1 ring-border-soft/50 backdrop-blur-[12px] transition duration-base hover:-translate-y-0.5 hover:shadow-lg max-[640px]:p-4',
].join(' ');

const TREND_CLASS_NAMES: Record<StatTrendDirection, string> = {
  up: 'border-success/10 bg-success-bg text-success',
  down: 'border-danger/10 bg-danger-bg text-danger',
  neutral: 'border-neutral/10 bg-neutral-bg text-neutral',
};

function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <article className={CARD_CLASS_NAME}>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary-accent to-sun opacity-80"
      />
      <div className="grid gap-2.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {title}
        </p>
        <p className="m-0 text-[clamp(1.7rem,3vw,2.35rem)] font-bold leading-none tracking-[-0.05em] text-text-primary">
          {value}
        </p>
        {subtitle ? (
          <p className="m-0 max-w-[26ch] text-[13px] leading-5 text-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trend ? (
        <p
          className={[
            'inline-flex min-h-7 items-center self-start whitespace-nowrap rounded-pill border px-2.5 text-[11px] font-semibold',
            TREND_CLASS_NAMES[trend.direction],
          ].join(' ')}
        >
          {trend.label}
        </p>
      ) : null}
    </article>
  );
}

export default StatCard;
