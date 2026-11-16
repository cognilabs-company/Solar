import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { FilterSelect, Switch } from '../../../components/shared/data';
import { services } from '../../../services';
import type { Product, ProductMutationInput, SelectOption } from '../../../types/domain';

interface ProductFormSubmitPayload {
  product: ProductMutationInput;
  primaryImageFile: File | null;
  galleryImageFiles: File[];
}

interface ProductFormPanelProps {
  mode: 'create' | 'edit';
  product?: Product | null;
  categoryOptions: SelectOption[];
  isCategoryOptionsLoading?: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (payload: ProductFormSubmitPayload) => void;
}

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  stockQuantity: string;
  minimalStock: string;
  isActive: boolean;
  isRecommended: boolean;
  subsidyEnabled: boolean;
  categoryId: string;
}

interface ExistingImageState {
  id: string | null;
  imageUrl: string;
  slot: 'primary' | 'gallery';
}

const MAX_TOTAL_IMAGES = 3;
const MAX_GALLERY_IMAGES = 2;

const inputClassName = [
  'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
  'placeholder:text-text-muted outline-none transition duration-fast',
  'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

function createInitialState(
  mode: 'create' | 'edit',
  product: Product | null | undefined,
): ProductFormState {
  if (mode === 'edit' && product) {
    return {
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),
      stockQuantity: String(product.stockQuantity ?? 0),
      minimalStock: String(product.minimalStock ?? 0),
      isActive: product.isActive,
      isRecommended: product.isRecommended,
      subsidyEnabled: product.subsidyEnabled,
      categoryId: product.categoryId ?? '',
    };
  }

  return {
    name: '',
    description: '',
    price: '',
    stockQuantity: '0',
    minimalStock: '0',
    isActive: true,
    isRecommended: false,
    subsidyEnabled: true,
    categoryId: '',
  };
}

function getExistingImages(product: Product | null | undefined): ExistingImageState[] {
  if (!product) {
    return [];
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .filter((image) => image?.imageUrl)
      .map((image, index) => ({
        id: image.id || null,
        imageUrl: image.imageUrl,
        slot: index === 0 ? 'primary' : 'gallery',
      }));
  }

  if (product.imageUrl) {
    return [{ id: null, imageUrl: product.imageUrl, slot: 'primary' }];
  }

  return [];
}

function ProductFormPanel({
  mode,
  product,
  categoryOptions,
  isCategoryOptionsLoading = false,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: ProductFormPanelProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ProductFormState>(() =>
    createInitialState(mode, product),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<ExistingImageState[]>(() =>
    getExistingImages(product),
  );
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageAlt, setPreviewImageAlt] = useState<string>('');
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  useEffect(() => {
    setForm(createInitialState(mode, product));
    setFieldError(null);
    setExistingImages(getExistingImages(product));
    setPrimaryImageFile(null);
    setGalleryImageFiles([]);
    setPreviewImageUrl(null);
    setPreviewImageAlt('');
  }, [mode, product]);

  const categorySelectOptions = useMemo<SelectOption[]>(
    () => [{ value: '', label: t('shared.filterSelect.select') }, ...categoryOptions],
    [categoryOptions, t],
  );

  const primaryPreviewUrl = useMemo(
    () => (primaryImageFile ? URL.createObjectURL(primaryImageFile) : null),
    [primaryImageFile],
  );

  const galleryPreviewUrls = useMemo(
    () => galleryImageFiles.map((file) => URL.createObjectURL(file)),
    [galleryImageFiles],
  );

  useEffect(() => {
    return () => {
      if (primaryPreviewUrl) {
        URL.revokeObjectURL(primaryPreviewUrl);
      }
      galleryPreviewUrls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [galleryPreviewUrls, primaryPreviewUrl]);

  const existingPrimary = useMemo(
    () => existingImages.find((image) => image.slot === 'primary') ?? null,
    [existingImages],
  );

  const existingGallery = useMemo(
    () => existingImages.filter((image) => image.slot === 'gallery'),
    [existingImages],
  );

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.description.trim().length > 0 &&
      form.categoryId.trim().length > 0 &&
      Number(form.price) >= 0 &&
      Number(form.stockQuantity) >= 0 &&
      Number(form.minimalStock) >= 0
    );
  }, [form]);

  function handlePrimaryImageSelect(file: File | null) {
    if (!file) {
      return;
    }

    setFieldError(null);
    setPrimaryImageFile(file);
  }

  function handleRemoveSelectedPrimary() {
    setFieldError(null);
    setPrimaryImageFile(null);
  }

  function handleSelectGalleryImages(files: FileList | null) {
    if (!files) {
      return;
    }

    setFieldError(null);
    const availableSlots = Math.max(
      0,
      MAX_GALLERY_IMAGES - existingGallery.length - galleryImageFiles.length,
    );
    if (availableSlots <= 0) {
      setFieldError(t('products.form.imagesMaxError'));
      return;
    }

    const pickedFiles = Array.from(files).slice(0, availableSlots);
    if (pickedFiles.length === 0) {
      return;
    }

    setGalleryImageFiles((current) => [...current, ...pickedFiles]);
  }

  function handleRemoveSelectedGallery(index: number) {
    setFieldError(null);
    setGalleryImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function handleDeleteExistingImage(image: ExistingImageState) {
    if (mode !== 'edit' || !product?.id || !image.id || isSubmitting) {
      return;
    }

    setFieldError(null);
    setDeletingImageId(image.id);

    try {
      await (services.products as any).deleteProductImage(product.id, image.id);
      const refreshed = await services.products.getProductById(product.id);
      setExistingImages(getExistingImages(refreshed ?? product));
    } catch {
      setFieldError(t('products.form.imageDeleteError'));
    } finally {
      setDeletingImageId(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);

    const normalizedName = form.name.trim();
    const normalizedDescription = form.description.trim();
    const normalizedCategoryId = form.categoryId.trim();
    const parsedPrice = Number(form.price);
    const parsedStock = Number(form.stockQuantity);
    const parsedMinimalStock = Number(form.minimalStock);

    if (!normalizedName || !normalizedDescription || !normalizedCategoryId) {
      setFieldError(t('products.form.requiredError'));
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFieldError(t('products.form.priceError'));
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setFieldError(t('products.form.stockError'));
      return;
    }

    if (!Number.isFinite(parsedMinimalStock) || parsedMinimalStock < 0) {
      setFieldError(t('products.form.stockError'));
      return;
    }

    const totalImagesCount =
      (existingPrimary ? 1 : 0) +
      existingGallery.length +
      (primaryImageFile ? 1 : 0) +
      galleryImageFiles.length;

    if (totalImagesCount > MAX_TOTAL_IMAGES) {
      setFieldError(t('products.form.imagesMaxError'));
      return;
    }

    onSubmit({
      product: {
        name: normalizedName,
        description: normalizedDescription,
        categoryId: normalizedCategoryId,
        price: parsedPrice,
        stockQuantity: Math.floor(parsedStock),
        minimalStock: Math.floor(parsedMinimalStock),
        isActive: form.isActive,
        isRecommended: form.isRecommended,
        subsidyEnabled: form.subsidyEnabled,
      },
      primaryImageFile,
      galleryImageFiles,
    });
  }

  function openImagePreview(imageUrl: string, alt: string) {
    setPreviewImageUrl(imageUrl);
    setPreviewImageAlt(alt);
  }

  function closeImagePreview() {
    setPreviewImageUrl(null);
    setPreviewImageAlt('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <aside
        className="h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[520px] min-[641px]:p-5"
        onClick={(event) => event.stopPropagation()}
        aria-label={mode === 'create' ? t('products.form.createTitle') : t('products.form.editTitle')}
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {t('products.form.eyebrow')}
              </p>
              <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary">
                {mode === 'create' ? t('products.form.createTitle') : t('products.form.editTitle')}
              </h2>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label={t('products.form.close')}
            >
              <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-1.5">
            <label className={labelClassName} htmlFor="product-form-name">{t('products.form.name')}</label>
            <input
              id="product-form-name"
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClassName}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label className={labelClassName} htmlFor="product-form-description">{t('products.form.description')}</label>
            <textarea
              id="product-form-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className={`${inputClassName} min-h-[110px] resize-y`}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="product-form-price">{t('products.form.price')}</label>
              <input
                id="product-form-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className={inputClassName}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="product-form-stock">{t('products.form.stockQuantity')}</label>
              <input
                id="product-form-stock"
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))}
                className={inputClassName}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="product-form-minimal-stock">{t('products.columns.stock')}</label>
              <input
                id="product-form-minimal-stock"
                type="number"
                min="0"
                step="1"
                value={form.minimalStock}
                onChange={(event) => setForm((current) => ({ ...current, minimalStock: event.target.value }))}
                className={inputClassName}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className={labelClassName}>{t('products.form.category')}</label>
            <FilterSelect
              value={form.categoryId}
              options={categorySelectOptions}
              onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
              disabled={isSubmitting || isCategoryOptionsLoading}
            />
          </div>

          <div className="grid gap-2 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35">
            <p className="m-0 text-sm font-semibold text-text-primary">{t('products.form.images')}</p>

            <div className="grid gap-1.5">
              <label className={labelClassName}>{t('products.form.primaryImage')}</label>
              <input
                id="product-form-primary-image"
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isSubmitting}
                onChange={(event) => {
                  handlePrimaryImageSelect(event.target.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
              <label
                htmlFor="product-form-primary-image"
                className={[
                  'group flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 transition duration-fast',
                  'hover:border-primary/45 hover:bg-surface-subtle/50',
                  'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
                  isSubmitting ? 'pointer-events-none opacity-60' : '',
                ].join(' ')}
              >
                <span className="min-w-0 truncate text-sm font-medium text-text-primary">
                  {primaryImageFile?.name || (existingPrimary ? t('products.form.currentImages') : t('products.form.noImages'))}
                </span>
                <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle px-3 text-xs font-semibold text-text-primary transition duration-fast group-hover:bg-surface-muted">
                  {t('shared.filterSelect.select')}
                </span>
              </label>

              {existingPrimary || primaryPreviewUrl ? (
                <div className="flex flex-wrap gap-2">
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-border-soft/45">
                    <img
                      src={primaryPreviewUrl || existingPrimary?.imageUrl}
                      alt={t('products.form.primaryImage')}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() =>
                        openImagePreview(
                          primaryPreviewUrl || existingPrimary?.imageUrl || '',
                          t('products.form.primaryImage'),
                        )
                      }
                    />
                    {primaryImageFile ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm"
                        onClick={handleRemoveSelectedPrimary}
                        disabled={isSubmitting}
                        aria-label={t('products.form.removeImage')}
                      >
                        <AppIcon name="trash" className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : existingPrimary?.id ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm"
                        onClick={() => handleDeleteExistingImage(existingPrimary)}
                        disabled={isSubmitting || deletingImageId === existingPrimary.id}
                        aria-label={t('products.form.removeImage')}
                      >
                        <AppIcon name="trash" className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className={labelClassName}>{t('products.form.otherImages')}</label>
              <input
                id="product-form-gallery-images"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={isSubmitting}
                onChange={(event) => {
                  handleSelectGalleryImages(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <label
                htmlFor="product-form-gallery-images"
                className={[
                  'group flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 transition duration-fast',
                  'hover:border-primary/45 hover:bg-surface-subtle/50',
                  'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
                  isSubmitting ? 'pointer-events-none opacity-60' : '',
                ].join(' ')}
              >
                <span className="min-w-0 truncate text-sm font-medium text-text-primary">
                  {galleryImageFiles.length > 0
                    ? `${galleryImageFiles.length} ${t('products.form.selectedImages')}`
                    : existingGallery.length > 0
                      ? `${existingGallery.length} ${t('products.form.currentImages').toLowerCase()}`
                      : t('products.form.noImages')}
                </span>
                <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle px-3 text-xs font-semibold text-text-primary transition duration-fast group-hover:bg-surface-muted">
                  {t('shared.filterSelect.select')}
                </span>
              </label>
              {galleryImageFiles.length > 0 || existingGallery.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {existingGallery.map((image, index) => (
                    <div key={image.id ?? image.imageUrl} className="relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-border-soft/45">
                      <img
                        src={image.imageUrl}
                        alt={`${t('products.form.otherImages')} ${index + 1}`}
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() =>
                          openImagePreview(
                            image.imageUrl,
                            `${t('products.form.otherImages')} ${index + 1}`,
                          )
                        }
                      />
                      {image.id ? (
                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm"
                          onClick={() => handleDeleteExistingImage(image)}
                          disabled={isSubmitting || deletingImageId === image.id}
                          aria-label={t('products.form.removeImage')}
                        >
                          <AppIcon name="trash" className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  ))}

                  {galleryImageFiles.map((file, index) => (
                    <div key={`selected-gallery-${file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-border-soft/45">
                      <img
                        src={galleryPreviewUrls[index] ?? ''}
                        alt={`${t('products.form.otherImages')} ${index + 1}`}
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() =>
                          openImagePreview(
                            galleryPreviewUrls[index] ?? '',
                            `${t('products.form.otherImages')} ${index + 1}`,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow-sm"
                        onClick={() => handleRemoveSelectedGallery(index)}
                        disabled={isSubmitting}
                        aria-label={t('products.form.removeImage')}
                      >
                        <AppIcon name="trash" className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35">
            <div className="grid gap-0.5">
              <p className="m-0 text-sm font-semibold text-text-primary">{t('products.form.recommendedProduct')}</p>
              <p className="m-0 text-[12px] text-text-secondary">{t('products.form.recommendedProductHint')}</p>
            </div>
            <Switch
              checked={form.isRecommended}
              onChange={(nextValue) => setForm((current) => ({ ...current, isRecommended: nextValue }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35">
            <div className="grid gap-0.5">
              <p className="m-0 text-sm font-semibold text-text-primary">{t('products.form.subsidyEnabled')}</p>
              <p className="m-0 text-[12px] text-text-secondary">{t('products.form.subsidyEnabledHint')}</p>
            </div>
            <Switch
              checked={form.subsidyEnabled}
              onChange={(nextValue) => setForm((current) => ({ ...current, subsidyEnabled: nextValue }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35">
            <div className="grid gap-0.5">
              <p className="m-0 text-sm font-semibold text-text-primary">{t('products.form.activeProduct')}</p>
              <p className="m-0 text-[12px] text-text-secondary">{t('products.form.activeProductHint')}</p>
            </div>
            <Switch
              checked={form.isActive}
              onChange={(nextValue) => setForm((current) => ({ ...current, isActive: nextValue }))}
              disabled={isSubmitting}
            />
          </div>

          {fieldError ? (
            <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">{fieldError}</p>
          ) : null}

          {errorMessage ? (
            <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">{errorMessage}</p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-card px-4 text-sm font-semibold text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting
                ? mode === 'create'
                  ? t('products.form.creating')
                  : t('products.form.saving')
                : mode === 'create'
                  ? t('products.form.createSubmit')
                  : t('products.form.editSubmit')}
            </button>
          </div>
        </form>
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
            aria-label={previewImageAlt || t('products.form.images')}
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
              className="max-h-[92vh] w-full object-contain bg-background-subtle"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProductFormPanel;
