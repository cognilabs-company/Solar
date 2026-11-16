import type { ReactNode } from 'react';
import AppIcon, { type AppIconName } from '../icons/AppIcon';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: AppIconName;
}

// Same visual language as the DataTable empty state (round icon, dashed orbit, sun dot)
function EmptyState({ title, description, action, icon = 'archive' }: EmptyStateProps) {
  return (
    <div className="grid min-h-[208px] place-items-center gap-4 rounded-xl border border-border-subtle bg-surface-card px-6 py-10 text-center text-text-secondary shadow-sm">
      <div className="grid max-w-[52ch] justify-items-center gap-3">
        <div className="table-empty__icon relative grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-text-accent">
          <span className="absolute inset-[-10px] rounded-full border border-dashed border-primary/25" aria-hidden="true" />
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-sun shadow-[0_0_12px_rgb(var(--color-sun)/0.8)]" aria-hidden="true" />
          <AppIcon name={icon} className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="m-0 mt-2 text-base font-semibold text-text-primary">{title}</h3>
        <p className="m-0 text-sm leading-[1.55] text-text-secondary">{description}</p>
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
