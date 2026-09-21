import { useTranslation } from 'react-i18next';
import type { IntegrationConfig } from '../../../types/domain';

interface IntegrationConfigDeleteDialogProps {
  config: IntegrationConfig;
  isDeleting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function IntegrationConfigDeleteDialog({
  config,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: IntegrationConfigDeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background-overlay/64 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isDeleting) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <section
        className="w-full max-w-[440px] rounded-2xl bg-surface-card p-5 shadow-xl ring-1 ring-border-soft/45"
        onClick={(event) => event.stopPropagation()}
        aria-label={t('integrations.deleteDialog.title', { label: config.label })}
      >
        <div className="grid gap-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">
            {t('integrations.deleteDialog.eyebrow')}
          </p>
          <h2 className="m-0 font-display text-[1.24rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-text-primary">
            {t('integrations.deleteDialog.title', { label: config.label })}
          </h2>
          <p className="m-0 text-sm leading-6 text-text-secondary">
            {t('integrations.deleteDialog.description')}
          </p>
          {errorMessage ? (
            <p
              className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ml-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-white transition duration-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting
              ? t('integrations.deleteDialog.deleting')
              : t('integrations.deleteDialog.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default IntegrationConfigDeleteDialog;
