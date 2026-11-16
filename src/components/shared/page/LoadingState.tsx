import { useTranslation } from 'react-i18next';

interface LoadingStateProps {
  title?: string;
  description?: string;
}

function LoadingState({
  title,
  description,
}: LoadingStateProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-[208px] place-items-center gap-4 rounded-xl border border-border-accent/70 bg-surface-card p-7 text-center text-text-secondary shadow-[0_0_0_1px_rgb(var(--color-primary)/0.04),0_18px_38px_-28px_rgb(15_23_42/0.32)]">
      <div className="grid max-w-[52ch] gap-3">
        <div
          className="relative mx-auto grid h-14 w-14 place-items-center rounded-lg border border-primary/25 bg-primary/12 shadow-[0_0_0_8px_rgb(var(--color-primary)/0.08)]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/12 to-transparent" />
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
        <h3 className="m-0 text-[1.1rem] font-semibold text-text-primary">
          {title ?? t('shared.loadingState.title')}
        </h3>
        <p className="m-0 leading-[1.55] text-text-secondary">
          {description ?? t('shared.loadingState.description')}
        </p>
      </div>
    </div>
  );
}

export default LoadingState;
