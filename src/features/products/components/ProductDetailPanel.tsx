import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  EmptyState,
  LoadingState,
  PageCard,
} from '../../../components/shared/page';
import { formatCurrencyAmount } from '../../../constants';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { services } from '../../../services';
import type { EntityId, Product } from '../../../types/domain';

interface ProductDetailPanelProps {
  productId: EntityId;
  onClose: () => void;
  onProductChanged?: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  isDeleteDisabled?: boolean;
  deleteDisabledReason?: string | null;
}

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const valueClassName =
  'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]';

function ProductDetailPanel({
  productId,
  onClose,
  onEdit,
  onDelete,
  isDeleteDisabled = false,
  deleteDisabledReason = null,
}: ProductDetailPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageAlt, setPreviewImageAlt] = useState<string>('');

  useEffect(() => {
    let isActive = true;

    async function loadProduct() {
      setIsLoading(true);
      setHasError(false);

      try {
        const nextProduct = await services.products.getProductById(productId);

        if (!isActive) {
          return;
        }

        setProduct(nextProduct);
      } catch {
        if (!isActive) {
          return;
        }

        setHasError(true);
        setProduct(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isActive = false;
    };
  }, [productId]);

  function openImagePreview(imageUrl: string, alt: string) {
    setPreviewImageUrl(imageUrl);
    setPreviewImageAlt(alt);
  }

  function closeImagePreview() {
    setPreviewImageUrl(null);
    setPreviewImageAlt('');
  }

  const resolvedStockStatus = product
    ? (product.stockStatus ?? (
        (product.stockQuantity ?? 0) <= 0
          ? 'out_of_stock'
          : (product.stockQuantity ?? 0) <= (product.minimalStock ?? 0)
            ? 'low_stock'
            : 'in_stock'
      ))
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[460px] min-[641px]:p-5"
        onClick={(event) => event.stopPropagation()}
        aria-label={t('products.detail.titleFallback')}
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40 transition duration-base hover:shadow-md hover:ring-border-soft/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {t('products.detail.eyebrow')}
              </p>
              <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]">
                {product?.name ?? t('products.detail.titleFallback')}
              </h2>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={onClose}
              aria-label={t('products.detail.close')}
            >
              <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>

          {!isLoading && product ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge
                status={product.isActive ? 'active' : 'inactive'}
                label={product.isActive ? t('common.active') : t('common.inactive')}
                tone={product.isActive ? 'success' : 'neutral'}
              />
              {resolvedStockStatus ? (
                <StatusBadge
                  status={resolvedStockStatus}
                  label={t(`products.stockStatus.${resolvedStockStatus}`)}
                  tone={resolvedStockStatus === 'in_stock' ? 'success' : 'danger'}
                />
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="grid gap-3">
          {isLoading ? (
            <LoadingState title={t('products.detail.loadingTitle')} description={t('products.detail.loadingDescription')} />
          ) : null}

          {!isLoading && (hasError || !product) ? (
            <EmptyState title={t('products.detail.errorTitle')} description={t('products.detail.errorDescription')} />
          ) : null}

          {!isLoading && product ? (
            <>
              {product.imageUrl ? (
                <PageCard>
                  <div className="grid gap-3">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-44 w-full cursor-zoom-in rounded-xl object-cover ring-1 ring-border-soft/40"
                      onClick={() => openImagePreview(product.imageUrl ?? '', product.name)}
                    />
                    {product.images.length > 1 ? (
                      <div className="flex flex-wrap gap-2">
                        {product.images.map((image) => (
                          <img
                            key={image.id}
                            src={image.imageUrl}
                            alt={product.name}
                            className="h-16 w-16 cursor-zoom-in rounded-lg object-cover ring-1 ring-border-soft/35"
                            onClick={() =>
                              openImagePreview(image.imageUrl, `${product.name} (${t('products.detail.images')})`)
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </PageCard>
              ) : null}

              <PageCard>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.detail.price')}</p>
                    <p className={`mt-1 ${valueClassName}`}>
                      {formatCurrencyAmount(product.price, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.detail.subsidyEnabled')}</p>
                    <p className="mt-1">
                      <StatusBadge
                        status={product.subsidyEnabled ? 'active' : 'inactive'}
                        tone={product.subsidyEnabled ? 'success' : 'neutral'}
                        label={
                          product.subsidyEnabled
                            ? t('products.withSubsidy')
                            : t('common.no')
                        }
                      />
                    </p>
                  </div>
                  {/* Subsidy figures only exist while the backend keeps it enabled. */}
                  {product.subsidyEnabled ? (
                    <>
                      <div className="rounded-lg bg-success-bg/60 p-3 ring-1 ring-success/25">
                        <p className={labelClassName}>{t('products.detail.subsidyAmount')}</p>
                        <p className={`mt-1 ${valueClassName}`}>
                          {formatCurrencyAmount(product.subsidyAmount, locale)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-3 ring-1 ring-primary/20">
                        <p className={labelClassName}>{t('products.detail.priceAfterSubsidy')}</p>
                        <p className={`mt-1 ${valueClassName}`}>
                          {formatCurrencyAmount(product.priceAfterSubsidy, locale)}
                        </p>
                      </div>
                    </>
                  ) : null}
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.detail.stockQuantity')}</p>
                    <p className={`mt-1 ${valueClassName}`}>{product.stockQuantity ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.columns.stock')}</p>
                    <p className={`mt-1 ${valueClassName}`}>{product.minimalStock ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/80 p-3">
                    <p className={labelClassName}>{t('products.form.category')}</p>
                    <p className={`mt-1 ${valueClassName}`}>{product.categoryName || product.category?.name || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2">
                    <p className={labelClassName}>{t('products.detail.description')}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
                      {product.description || t('products.detail.noDescription')}
                    </p>
                  </div>
                </div>
              </PageCard>

              <PageCard>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
                    <p className={labelClassName}>{t('products.detail.created')}</p>
                    <p className={`mt-1 ${valueClassName}`}>
                      {formatLocalizedDate(product.createdAt, locale, {
                        locale,
                        withYear: true,
                        withTime: true,
                        shortMonth: true,
                        fallback: '-',
                      })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
                    <p className={labelClassName}>{t('products.detail.updated')}</p>
                    <p className={`mt-1 ${valueClassName}`}>
                      {formatLocalizedDate(product.updatedAt, locale, {
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
                  onClick={() => onEdit(product)}
                >
                  <FiEdit2 className="h-4 w-4" />
                  {t('products.detail.editProduct')}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 text-sm font-semibold text-danger shadow-sm ring-1 ring-danger/25 transition duration-fast hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDelete(product)}
                  disabled={isDeleteDisabled}
                  title={deleteDisabledReason ?? undefined}
                >
                  <FiTrash2 className="h-4 w-4" />
                  {t('products.detail.deleteProduct')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      {previewImageUrl ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-background-overlay/85 p-4"
          onClick={closeImagePreview}
          role="presentation"
        >
          <div
            className="relative max-h-[92vh] w-full max-w-[960px] overflow-hidden rounded-xl bg-surface-card shadow-xl ring-1 ring-border-soft/50"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={previewImageAlt || t('products.detail.images')}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card/90 text-text-primary shadow-sm ring-1 ring-border-soft/60 transition duration-fast hover:bg-surface-muted"
              onClick={closeImagePreview}
              aria-label={t('common.close')}
            >
              <AppIcon name="close" className="h-4 w-4" aria-hidden="true" />
            </button>
            <img
              src={previewImageUrl}
              alt={previewImageAlt}
              className="max-h-[92vh] w-full bg-background-subtle object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProductDetailPanel;
