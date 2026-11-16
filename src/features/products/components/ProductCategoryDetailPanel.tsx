import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  EmptyState,
  LoadingState,
  PageCard,
} from '../../../components/shared/page';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { services } from '../../../services';
import type { EntityId, ProductCategory } from '../../../types/domain';

interface ProductCategoryDetailPanelProps {
  categoryId: EntityId;
  onClose: () => void;
  onEdit: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
}

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const valueClassName =
  'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]';

function ProductCategoryDetailPanel({
  categoryId,
  onClose,
  onEdit,
  onDelete,
}: ProductCategoryDetailPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadCategory() {
      setIsLoading(true);
      setHasError(false);

      try {
        const nextCategory = await services.products.getProductCategoryById(categoryId);
        if (!isActive) {
          return;
        }

        setCategory(nextCategory);
      } catch {
        if (!isActive) {
          return;
        }

        setHasError(true);
        setCategory(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCategory();

    return () => {
      isActive = false;
    };
  }, [categoryId]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[460px] min-[641px]:p-5"
        onClick={(event) => event.stopPropagation()}
        aria-label={t('products.categoryColumns.name')}
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40 transition duration-base hover:shadow-md hover:ring-border-soft/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {t('products.categoryColumns.name')}
              </p>
              <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]">
                {category?.name ?? t('products.categoryColumns.name')}
              </h2>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={onClose}
              aria-label={t('common.cancel')}
            >
              <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="grid gap-3">
          {isLoading ? (
            <LoadingState title={t('common.loading')} description={t('products.loadingDescription')} />
          ) : null}

          {!isLoading && (hasError || !category) ? (
            <EmptyState title={t('products.categoriesErrorTitle')} description={t('products.categoriesErrorDescription')} />
          ) : null}

          {!isLoading && category ? (
            <>
              <PageCard>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.categoryColumns.name')}</p>
                    <p className={`mt-1 ${valueClassName}`}>{category.name}</p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.categoryColumns.code')}</p>
                    <p className={`mt-1 ${valueClassName}`}>{category.code || '-'}</p>
                  </div>
                </div>
              </PageCard>

              <PageCard>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
                    <p className={labelClassName}>{t('products.detail.created')}</p>
                    <p className={`mt-1 ${valueClassName}`}>
                      {formatLocalizedDate(category.createdAt, locale, {
                        locale,
                        withYear: true,
                        withTime: true,
                        shortMonth: true,
                        fallback: '-',
                      })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
                    <p className={labelClassName}>{t('products.categoryColumns.updated')}</p>
                    <p className={`mt-1 ${valueClassName}`}>
                      {formatLocalizedDate(category.updatedAt, locale, {
                        locale,
                        withYear: true,
                        withTime: true,
                        shortMonth: true,
                        fallback: '-',
                      })}
                    </p>
                  </div>
                </div>
              </PageCard>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  onClick={() => onEdit(category)}
                >
                  <FiEdit2 className="h-4 w-4" />
                  {t('products.categoryActions.edit')}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 text-sm font-semibold text-danger shadow-sm ring-1 ring-danger/25 transition duration-fast hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/25"
                  onClick={() => onDelete(category)}
                >
                  <FiTrash2 className="h-4 w-4" />
                  {t('products.categoryActions.delete')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export default ProductCategoryDetailPanel;
