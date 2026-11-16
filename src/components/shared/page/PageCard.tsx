import type { PropsWithChildren } from 'react';

interface PageCardProps extends PropsWithChildren {
  muted?: boolean;
  allowOverflow?: boolean;
  className?: string;
}

function PageCard({
  muted = false,
  allowOverflow = false,
  className,
  children,
}: PageCardProps) {
  return (
    <div
      className={[
        'relative rounded-[20px] p-5 shadow-md ring-1 ring-border-soft/50 transition duration-base max-[640px]:p-4 hover:shadow-lg hover:ring-primary/20',
        allowOverflow ? 'overflow-visible' : 'overflow-hidden',
        muted
          ? 'bg-surface-subtle/75'
          : 'bg-surface-card',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

export default PageCard;
