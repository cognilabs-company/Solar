import { useTranslation } from 'react-i18next';
import type { Lead } from '../../../services/contracts';

interface LeadDeleteDialogProps {
  lead: Lead;
  isDeleting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function LeadDeleteDialog({
  lead,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: LeadDeleteDialogProps) {
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
        className="w-full max-w-[420px] rounded-2xl bg-surface-card p-5 shadow-xl ring-1 ring-border-soft/45"
        onClick={(event) => event.stopPropagation()}
        aria-label={t('leads.deleteDialog.title', { name: lead.full_name })}
      >
        <div className="grid gap-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">
            {t('leads.deleteDialog.eyebrow')}
          </p>
          <h2 className="m-0 font-display text-[1.24rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-text-primary">
            {t('leads.deleteDialog.title', { name: lead.full_name })}
          </h2>
          <p className="m-0 text-sm leading-6 text-text-secondary">
            {t('leads.deleteDialog.description')}
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
              ? t('leads.deleteDialog.deleting')
              : t('leads.deleteDialog.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default LeadDeleteDialog;
