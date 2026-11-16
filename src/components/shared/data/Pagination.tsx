import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
}

type PageSlot = number | 'gap-start' | 'gap-end';

const NAV_BUTTON_CLASS_NAME = [
  'pagination__nav inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
  'text-text-secondary ring-1 ring-border-soft/50 transition duration-fast',
  'hover:bg-primary/10 hover:text-text-accent hover:ring-primary/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
  'disabled:pointer-events-none disabled:opacity-40',
].join(' ');

const PAGE_BUTTON_CLASS_NAME = [
  'pagination__page relative inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums',
  'transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
].join(' ');

/** Compact page list: 1 … 4 5 6 … 12 */
function buildPageSlots(currentPage: number, totalPages: number): PageSlot[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const slots: PageSlot[] = [1];
  const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, Math.max(currentPage + 1, 5));

  if (start > 2) {
    slots.push('gap-start');
  }
  for (let page = start; page <= end; page += 1) {
    slots.push(page);
  }
  if (end < totalPages - 1) {
    slots.push('gap-end');
  }
  slots.push(totalPages);

  return slots;
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation();
  const safeTotalPages = Math.max(totalPages, 1);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < safeTotalPages;
  const slots = buildPageSlots(currentPage, safeTotalPages);

  return (
    <nav
      className="pagination flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card px-3 py-2.5 shadow-sm ring-1 ring-border-soft/40"
      aria-label="Pagination"
    >
      <div className="pagination__summary flex flex-wrap items-center gap-2 text-[13px] font-medium text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-sun shadow-[0_0_8px_rgb(var(--color-sun)/0.8)]" aria-hidden="true" />
          {t('shared.pagination.page')}{' '}
          <span className="font-semibold tabular-nums text-text-primary">{currentPage}</span>{' '}
          / <span className="tabular-nums">{safeTotalPages}</span>
        </span>
        {typeof totalItems === 'number' ? (
          <span className="inline-flex min-h-6 items-center rounded-pill bg-primary/10 px-2.5 text-[12px] font-semibold text-text-accent">
            <span className="tabular-nums">{totalItems.toLocaleString()}</span>&nbsp;{t('shared.pagination.totalItems')}
          </span>
        ) : null}
      </div>

      <div className="pagination__actions flex items-center gap-1.5 max-[640px]:w-full max-[640px]:justify-between">
        <button
          type="button"
          className={NAV_BUTTON_CLASS_NAME}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          aria-label={t('shared.pagination.previous')}
        >
          <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="max-[480px]:hidden">{t('shared.pagination.previous')}</span>
        </button>

        <ol className="m-0 flex list-none items-center gap-1 p-0">
          {slots.map((slot) =>
            typeof slot === 'number' ? (
              <li key={slot}>
                <button
                  type="button"
                  className={[
                    PAGE_BUTTON_CLASS_NAME,
                    slot === currentPage
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'text-text-secondary hover:bg-primary/10 hover:text-text-accent',
                  ].join(' ')}
                  onClick={() => onPageChange(slot)}
                  aria-current={slot === currentPage ? 'page' : undefined}
                  disabled={slot === currentPage}
                >
                  {slot}
                </button>
              </li>
            ) : (
              <li key={slot} className="px-0.5 text-sm text-text-muted" aria-hidden="true">
                …
              </li>
            ),
          )}
        </ol>

        <button
          type="button"
          className={NAV_BUTTON_CLASS_NAME}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label={t('shared.pagination.next')}
        >
          <span className="max-[480px]:hidden">{t('shared.pagination.next')}</span>
          <FiChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
