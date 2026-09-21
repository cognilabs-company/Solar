import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  isBusy?: boolean;
  errorMessage?: ReactNode;
  confirmTone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
  ariaLabel: string;
}

function ConfirmDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isBusy = false,
  errorMessage,
  confirmTone = 'danger',
  onCancel,
  onConfirm,
  ariaLabel,
}: ConfirmDialogProps) {
  const confirmButtonClassName =
    confirmTone === 'primary'
      ? 'ml-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60'
      : 'ml-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-white transition duration-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background-overlay/64 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isBusy) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <section
        className="w-full max-w-[420px] rounded-2xl bg-surface-card p-5 shadow-xl ring-1 ring-border-soft/45"
        onClick={(event) => event.stopPropagation()}
        aria-label={ariaLabel}
      >
        <div className="grid gap-2">
          {eyebrow ? (
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="m-0 font-display text-[1.24rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-text-primary">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-sm leading-6 text-text-secondary">{description}</p>
          ) : null}
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
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmButtonClassName}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;

