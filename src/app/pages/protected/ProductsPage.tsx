import { useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DataTable,
  FilterBar,
  FilterSelect,
  Pagination,
  SearchInput,
  StatusBadge,
  type DataTableColumn,
} from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  EmptyState,
  LoadingState,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
} from '../../../components/shared/page';
import ProductCategoryDeleteDialog from '../../../features/products/components/ProductCategoryDeleteDialog';
import ProductCategoryDetailPanel from '../../../features/products/components/ProductCategoryDetailPanel';
import ProductCategoryFormDialog from '../../../features/products/components/ProductCategoryFormDialog';
import ProductDeleteDialog from '../../../features/products/components/ProductDeleteDialog';
import ProductDetailPanel from '../../../features/products/components/ProductDetailPanel';
import ProductFormPanel from '../../../features/products/components/ProductFormPanel';
import { formatCurrencyAmount } from '../../../constants';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { usePersistentState } from '../../../lib/persistent-state';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { services } from '../../../services';
import type {
  EntityId,
  PaginationMeta,
  Product,
  ProductCategory,
  ProductMutationInput,
  SelectOption,
  TableQueryParams,
} from '../../../types/domain';

type ActiveFilter = 'all' | 'active' | 'inactive';
type ProductOrdering = '-created_at' | 'created_at' | 'name' | '-name' | 'price' | '-price';
type CatalogView = 'products' | 'categories';
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const PAGE_SIZE = 10;
const CATEGORY_FETCH_SIZE = 500;
const DEFAULT_ORDERING: ProductOrdering = '-created_at';
const PRODUCTS_FILTER_FETCH_PAGE_SIZE = 200;
const PRODUCTS_FILTER_FETCH_MAX_PAGES = 20;

const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
};

const tablePrimaryTextClassName =
  'block max-w-[140px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[220px]';

const tableSecondaryTextClassName =
  'block max-w-[140px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[220px]';

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const actionButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

function parseOrdering(ordering: ProductOrdering): Pick<TableQueryParams, 'sortBy' | 'sortDirection'> {
  const direction = ordering.startsWith('-') ? 'desc' : 'asc';
  const sortBy = ordering.replace('-', '');

  return {
    sortBy,
    sortDirection: direction,
  };
}

function resolveStockStatus(product: Product): StockStatus {
  const raw = product.stockStatus;
  if (raw === 'in_stock' || raw === 'low_stock' || raw === 'out_of_stock') {
    return raw;
  }

  const stockQuantity = product.stockQuantity ?? 0;
  const minimalStock = product.minimalStock ?? 0;

  if (stockQuantity <= 0) {
    return 'out_of_stock';
  }

  if (stockQuantity <= minimalStock) {
    return 'low_stock';
  }

  return 'in_stock';
}

function stockSeverity(product: Product): number {
  const status = resolveStockStatus(product);
  // UX rule: show low-stock items first, then out-of-stock, then everything else.
  // We keep the backend ordering stable inside each group.
  if (status === 'low_stock' || product.isLowStock) {
    return 0;
  }
  if (status === 'out_of_stock') {
    return 1;
  }
  return 2;
}

function sortProductsByStockStatus(items: Product[]): Product[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const delta = stockSeverity(left.item) - stockSeverity(right.item);
      return delta !== 0 ? delta : left.index - right.index;
    })
    .map(({ item }) => item);
}

function ProductsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = usePersistentState('products:search', '');
  const productsCacheRef = useRef<{ key: string; items: Product[] } | null>(null);
  const [catalogView, setCatalogView] = usePersistentState<CatalogView>(
    'products:catalog-view',
    'products',
    {
      deserialize: (value) => {
        const parsed = JSON.parse(value);
        return parsed === 'categories' ? parsed : 'products';
      },
    },
  );
  const isCategoriesView = catalogView === 'categories';

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [ordering, setOrdering] = useState<ProductOrdering>(DEFAULT_ORDERING);
  const [currentPage, setCurrentPage] = useState(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
  const [isCategoryOptionsLoading, setIsCategoryOptionsLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [reloadCursor, setReloadCursor] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryFormMode, setCategoryFormMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [categoryFormErrorMessage, setCategoryFormErrorMessage] = useState<string | null>(null);
  const [isCategoryReordering, setIsCategoryReordering] = useState(false);
  const [categoryReorderErrorMessage, setCategoryReorderErrorMessage] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [isCategoryDeleting, setIsCategoryDeleting] = useState(false);

  const orderingOptions = useMemo<SelectOption[]>(
    () => [
      { value: '-created_at', label: t('products.createdNewest') },
      { value: 'created_at', label: t('products.createdOldest') },
      { value: 'name', label: t('products.nameAz') },
      { value: '-name', label: t('products.nameZa') },
      { value: '-price', label: t('products.priceHighLow') },
      { value: 'price', label: t('products.priceLowHigh') },
    ],
    [t],
  );

  const activeFilterOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: t('products.allStatuses') },
      { value: 'active', label: t('common.active') },
      { value: 'inactive', label: t('common.inactive') },
    ],
    [t],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, activeFilter, ordering, catalogView]);

  useEffect(() => {
    if (catalogView === 'categories') {
      setSelectedProductId(null);
    } else {
      setSelectedCategoryId(null);
    }
  }, [catalogView]);

  useEffect(() => {
    const state = location.state as { productId?: EntityId } | null;
    const requestedProductId = state?.productId;
    if (!requestedProductId || typeof requestedProductId !== 'string') {
      return;
    }

    setCatalogView('products');
    setSelectedProductId(requestedProductId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, setCatalogView]);

  useEffect(() => {
    let isActive = true;

    async function loadCategoryOptions() {
      setIsCategoryOptionsLoading(true);

      try {
        const result = await services.products.listProductCategories({
          page: 1,
          pageSize: CATEGORY_FETCH_SIZE,
        });

        if (!isActive) {
          return;
        }

        const options = result.items
          .map((category: ProductCategory): SelectOption => ({
            value: category.id,
            label: category.name,
            description: category.code,
          }))
          .sort((left: SelectOption, right: SelectOption) => left.label.localeCompare(right.label));

        setCategories(result.items);
        setCategoryOptions(options);
      } catch {
        if (!isActive) {
          return;
        }

        setCategories([]);
        setCategoryOptions([]);
      } finally {
        if (isActive) {
          setIsCategoryOptionsLoading(false);
        }
      }
    }

    void loadCategoryOptions();

    return () => {
      isActive = false;
    };
  }, [reloadCursor]);

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      if (isCategoriesView) {
        setIsLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      const sortConfig = parseOrdering(ordering);
      const normalizedSearch = search.trim() || undefined;
      const cacheKey = JSON.stringify({
        search: normalizedSearch ?? '',
        categoryFilter,
        activeFilter,
        ordering,
        reloadCursor,
      });

      const cached = productsCacheRef.current;
      if (cached?.key === cacheKey) {
        const totalItems = cached.items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        if (currentPage > totalPages) {
          setCurrentPage(totalPages);
          return;
        }

        const start = (page - 1) * PAGE_SIZE;
        const pageItems = cached.items.slice(start, start + PAGE_SIZE);

        setHasError(false);
        setProducts(pageItems);
        setPaginationMeta({
          page,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages,
        });
        setHasLoadedOnce(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const shouldClientFilter = categoryFilter !== 'all' || activeFilter !== 'all';

        // Backend schema doesn't expose category/is_active filters for products.
        // Also: we want low-stock products to bubble to the top of the full list (not only within the current page),
        // so we prefer fetching multiple pages and sorting client-side when the dataset size is reasonable.
        const firstPage = await services.products.listProducts({
          page: 1,
          pageSize: PRODUCTS_FILTER_FETCH_PAGE_SIZE,
          search: normalizedSearch,
          ordering,
          ...sortConfig,
        });

        if (!isActive) {
          return;
        }

        const totalPagesToFetch = Math.min(
          firstPage.meta.totalPages,
          PRODUCTS_FILTER_FETCH_MAX_PAGES,
        );
        const collected: Product[] = [...firstPage.items];

        for (let page = 2; page <= totalPagesToFetch; page += 1) {
          const next = await services.products.listProducts({
            page,
            pageSize: PRODUCTS_FILTER_FETCH_PAGE_SIZE,
            search: normalizedSearch,
            ordering,
            ...sortConfig,
          });

          if (!isActive) {
            return;
          }

          collected.push(...next.items);
        }

        // If the dataset is larger than our safety cap, we fall back to server pagination to avoid
        // issuing an unbounded number of requests. In that case, we still keep the "danger" styling,
        // and only promote low-stock items within the current page.
        if (!shouldClientFilter && firstPage.meta.totalPages > PRODUCTS_FILTER_FETCH_MAX_PAGES) {
          productsCacheRef.current = null;
          const result = await services.products.listProducts({
            page: currentPage,
            pageSize: PAGE_SIZE,
            search: normalizedSearch,
            ordering,
            ...sortConfig,
          });

          if (!isActive) {
            return;
          }

          if (currentPage > result.meta.totalPages) {
            setCurrentPage(result.meta.totalPages);
            return;
          }

          setProducts(sortProductsByStockStatus(result.items));
          setPaginationMeta(result.meta);
          return;
        }

        const filtered = sortProductsByStockStatus(collected.filter((product) => {
          if (categoryFilter !== 'all') {
            const productCategoryId = product.categoryId || product.category?.id;
            if (productCategoryId !== categoryFilter) {
              return false;
            }
          }

          if (activeFilter !== 'all') {
            const mustBeActive = activeFilter === 'active';
            if (Boolean(product.isActive) !== mustBeActive) {
              return false;
            }
          }

          return true;
        }));

        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        if (currentPage > totalPages) {
          setCurrentPage(totalPages);
          return;
        }

        const start = (page - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PAGE_SIZE);

        setProducts(pageItems);
        productsCacheRef.current = { key: cacheKey, items: filtered };
        setPaginationMeta({
          page,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages,
        });
      } catch {
        if (!isActive) {
          return;
        }

        setHasError(true);
        setProducts([]);
        setPaginationMeta(DEFAULT_PAGINATION_META);
      } finally {
        if (isActive) {
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isActive = false;
    };
  }, [activeFilter, categoryFilter, currentPage, isCategoriesView, ordering, reloadCursor, search, catalogView]);

  function openCreateForm() {
    setFormMode('create');
    setEditingProduct(null);
    setFormErrorMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(product: Product) {
    setFormMode('edit');
    setEditingProduct(product);
    setFormErrorMessage(null);
    setIsFormOpen(true);
  }

  function requestDelete(product: Product) {
    setProductToDelete(product);
  }

  async function handleSaveProduct(input: {
    product: ProductMutationInput;
    primaryImageFile: File | null;
    galleryImageFiles: File[];
  }) {
    setIsSaving(true);
    setFormErrorMessage(null);

    try {
      let savedProduct: Product;
      let productIdForImages: EntityId | null = null;

      if (formMode === 'create') {
        savedProduct = await services.products.createProduct({
          ...input.product,
          image: input.primaryImageFile,
          imageAltText: input.product.name,
          imageIsPrimary: true,
        });
        productIdForImages = savedProduct.id;
        setCurrentPage(1);
      } else {
        const editingId = editingProduct?.id;
        if (!editingId) {
          throw new Error(t('products.form.saveError'));
        }

        // When editing and primary image is selected, update it via PATCH /api/products/{id}/ multipart/form-data.
        const patchPayload =
          input.primaryImageFile
            ? {
                ...input.product,
                image: input.primaryImageFile,
                imageAltText: input.product.name,
                imageIsPrimary: true,
              }
            : input.product;

        savedProduct = await services.products.patchProduct(editingId, patchPayload);
        // Don't rely on response id for multipart PATCH; use the real editingId for subsequent image calls.
        productIdForImages = editingId;
      }

      const productId = productIdForImages ?? savedProduct.id;

      if (input.galleryImageFiles.length > 0) {
        if (formMode === 'edit') {
          // Use PATCH /api/products/{id}/ multipart/form-data for secondary images as well.
          for (const [index, file] of input.galleryImageFiles.entries()) {
            await services.products.patchProduct(productId, {
              image: file,
              imageAltText: `${input.product.name} ${index + 1}`,
              imageIsPrimary: false,
            });
          }
        } else {
          await Promise.all(
            input.galleryImageFiles.map((file, index) =>
              services.products.patchProduct(productId, {
                image: file,
                imageAltText: `${input.product.name} ${index + 1}`,
                imageIsPrimary: false,
              }),
            ),
          );
        }
      }

      setIsFormOpen(false);
      setEditingProduct(null);
      setReloadCursor((current) => current + 1);
    } catch (error) {
      setFormErrorMessage(error instanceof Error ? error.message : t('products.form.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!productToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await services.products.deleteProduct(productToDelete.id);
      if (selectedProductId === productToDelete.id) {
        setSelectedProductId(null);
      }
      setProductToDelete(null);
      setReloadCursor((current) => current + 1);
    } catch (error) {
      // Previously an unhandled rejection: dialog stayed open with no feedback.
      setDeleteError(extractApiErrorMessage(error, t('products.deleteDialog.deleteError')));
    } finally {
      setIsDeleting(false);
    }
  }

  function openCreateCategoryForm() {
    setCategoryFormMode('create');
    setEditingCategory(null);
    setCategoryFormErrorMessage(null);
    setIsCategoryFormOpen(true);
  }

  function openEditCategoryForm(category: ProductCategory) {
    setCategoryFormMode('edit');
    setEditingCategory(category);
    setCategoryFormErrorMessage(null);
    setSelectedCategoryId(null);
    setIsCategoryFormOpen(true);
  }

  async function handleSaveCategory(payload: { name: string; code: string; sortOrder: number }) {
    setIsCategorySaving(true);
    setCategoryFormErrorMessage(null);

    try {
      if (categoryFormMode === 'create') {
        await services.products.createProductCategory(payload);
      } else if (editingCategory?.id) {
        await services.products.patchProductCategory(editingCategory.id, payload);
      }

      setIsCategoryFormOpen(false);
      setEditingCategory(null);
      setReloadCursor((current) => current + 1);
    } catch {
      setCategoryFormErrorMessage(t('products.categoryForm.saveError'));
    } finally {
      setIsCategorySaving(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!categoryToDelete) {
      return;
    }

    setIsCategoryDeleting(true);
    setCategoryDeleteError(null);
    try {
      await services.products.deleteProductCategory(categoryToDelete.id);
      setCategoryToDelete(null);
      setReloadCursor((current) => current + 1);
    } catch (error) {
      // A category that still has products is refused by the backend - show it.
      setCategoryDeleteError(
        extractApiErrorMessage(error, t('products.categoryDeleteDialog.error')),
      );
    } finally {
      setIsCategoryDeleting(false);
    }
  }

  const productColumns = useMemo<DataTableColumn<Product>[]>(() => {
    return [
      {
        key: 'name',
        label: t('products.columns.product'),
        render: (product) => (
          <div className="flex items-center gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-9 w-9 rounded-full object-cover ring-1 ring-border-soft/50"
                loading="lazy"
              />
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold text-text-secondary ring-1 ring-border-soft/50">
                -
              </span>
            )}
            <div className="min-w-0 grid gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={tablePrimaryTextClassName}>{product.name}</span>
                {resolveStockStatus(product) !== 'in_stock' ? (
                  <StatusBadge
                    status={resolveStockStatus(product)}
                    tone="danger"
                    label={t(`products.stockStatus.${resolveStockStatus(product)}`)}
                  />
                ) : null}
                {product.subsidyEnabled ? (
                  <StatusBadge
                    status="subsidy"
                    tone="success"
                    label={t('products.withSubsidy')}
                  />
                ) : null}
              </div>
              <span className={tableSecondaryTextClassName}>
                {product.description || t('products.noDescription')}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        label: t('products.form.category'),
        render: (product) => (
          <span className={tablePrimaryTextClassName}>{product.categoryName || product.category?.name || '-'}</span>
        ),
      },
      {
        key: 'price',
        label: t('products.columns.price'),
        // Subsidy rules come from the backend: when it is on, the customer pays
        // `price_after_subsidy` and the subsidy is shown as its own line.
        render: (product) => (
          <div className="grid gap-0.5">
            <span className={tablePrimaryTextClassName}>
              {formatCurrencyAmount(
                product.subsidyEnabled ? product.priceAfterSubsidy : product.price,
                locale,
              )}
            </span>
            {product.subsidyEnabled ? (
              <span className={[tableSecondaryTextClassName, 'line-through'].join(' ')}>
                {formatCurrencyAmount(product.price, locale)}
              </span>
            ) : null}
            {product.subsidyEnabled && product.subsidyAmount > 0 ? (
              <span className={[tableSecondaryTextClassName, 'font-semibold text-success'].join(' ')}>
                {t('products.columns.subsidyAmount')}: {formatCurrencyAmount(product.subsidyAmount, locale)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'productCount',
        label: t('products.form.stockQuantity'),
        render: (product) => (
          <span className={tablePrimaryTextClassName}>{product.stockQuantity ?? 0}</span>
        ),
      },
      {
        key: 'stock',
        label: t('products.columns.stock'),
        render: (product) => (
          <span className={tablePrimaryTextClassName}>{product.minimalStock ?? 0}</span>
        ),
      },
      {
        key: 'status',
        label: t('products.columns.status'),
        render: (product) => (
          <StatusBadge
            status={product.isActive ? 'active' : 'inactive'}
            tone={product.isActive ? 'success' : 'neutral'}
            label={product.isActive ? t('common.active') : t('common.inactive')}
          />
        ),
      },
      {
        key: 'updatedAt',
        label: t('products.columns.updated'),
        render: (product) => (
          <span className={tablePrimaryTextClassName}>
            {formatLocalizedDate(product.updatedAt, locale, {
              locale,
              withYear: true,
              shortMonth: true,
              fallback: '-',
            })}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('products.columns.actions'),
        align: 'right',
        render: (product) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                openEditForm(product);
              }}
              aria-label={t('products.actions.edit')}
            >
              <FiEdit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                requestDelete(product);
              }}
              aria-label={t('products.actions.delete')}
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ];
  }, [locale, t]);

  const orderedCategories = useMemo(() => {
    return [...categories].sort((left, right) => {
      const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : 0;
      const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name, locale);
    });
  }, [categories, locale]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return orderedCategories;
    }

    return orderedCategories.filter((category) => {
      return (
        category.name.toLowerCase().includes(query) ||
        category.code.toLowerCase().includes(query)
      );
    });
  }, [orderedCategories, search]);

  const categoryDisplayOrderMap = useMemo(
    () => new Map(filteredCategories.map((category, index) => [category.id, index + 1])),
    [filteredCategories],
  );

  const categoryColumns = useMemo<DataTableColumn<ProductCategory>[]>(() => {
    return [
      {
        key: 'name',
        label: t('products.categoryColumns.name'),
        render: (category) => (
          <div className="flex items-center">
            <span className={tablePrimaryTextClassName}>{category.name}</span>
          </div>
        ),
      },
      {
        key: 'sortOrder',
        label: t('products.categoryColumns.sortOrder'),
        render: (category) => (
          <span className={tablePrimaryTextClassName}>{categoryDisplayOrderMap.get(category.id) ?? 1}</span>
        ),
      },
      {
        key: 'code',
        label: t('products.categoryColumns.code'),
        render: (category) => <span className={tablePrimaryTextClassName}>{category.code || '-'}</span>,
      },
      {
        key: 'updatedAt',
        label: t('products.categoryColumns.updated'),
        render: (category) => (
          <span className={tablePrimaryTextClassName}>
            {formatLocalizedDate(category.updatedAt, locale, {
              locale,
              withYear: true,
              shortMonth: true,
              fallback: '-',
            })}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('products.categoryColumns.actions'),
        align: 'right',
        render: (category) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                openEditCategoryForm(category);
              }}
              aria-label={t('products.categoryActions.edit')}
            >
              <FiEdit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                setCategoryToDelete(category);
              }}
              aria-label={t('products.categoryActions.delete')}
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ];
  }, [categoryDisplayOrderMap, locale, t]);

  async function handleReorderCategories(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || isCategoryReordering || isCategorySaving || isCategoryDeleting) {
      return;
    }

    const start = (categoryMeta.page - 1) * PAGE_SIZE;
    const visibleFromIndex = start + fromIndex;
    const visibleToIndex = start + toIndex;

    const dragged = filteredCategories[visibleFromIndex];
    const target = filteredCategories[visibleToIndex];

    if (!dragged || !target || dragged.id === target.id) {
      return;
    }

    setCategoryReorderErrorMessage(null);
    setIsCategoryReordering(true);

    const prevCategoriesSnapshot = categories;
    const prevSortOrderMap = new Map(prevCategoriesSnapshot.map((item) => [item.id, item.sortOrder]));

    const nextOrdered = (() => {
      const all = [...orderedCategories];
      const fromGlobalIndex = all.findIndex((item) => item.id === dragged.id);
      const toGlobalIndex = all.findIndex((item) => item.id === target.id);

      if (fromGlobalIndex < 0 || toGlobalIndex < 0) {
        return all;
      }

      const next = [...all];
      const [moved] = next.splice(fromGlobalIndex, 1);
      next.splice(toGlobalIndex, 0, moved);
      return next;
    })();

    const nextCategories = nextOrdered.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    setCategories(nextCategories);

    try {
      const updates = nextCategories
        .map((item, index) => ({
          id: item.id,
          desired: index,
          prev: prevSortOrderMap.get(item.id),
        }))
        .filter((item) => item.prev !== item.desired);

      await Promise.all(
        updates.map((item) =>
          services.products.patchProductCategory(item.id, { sortOrder: item.desired }),
        ),
      );

      setReloadCursor((current) => current + 1);
    } catch {
      setCategories(prevCategoriesSnapshot);
      setCategoryReorderErrorMessage(t('products.categoryReorderError'));
    } finally {
      setIsCategoryReordering(false);
    }
  }

  const categoryMeta = useMemo(() => {
    const totalItems = filteredCategories.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(currentPage, totalPages);
    return { page, totalItems, totalPages };
  }, [currentPage, filteredCategories.length]);

  const pagedCategories = useMemo(() => {
    const start = (categoryMeta.page - 1) * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [categoryMeta.page, filteredCategories]);

  const totalItemsCount = isCategoriesView ? categoryMeta.totalItems : paginationMeta.totalItems;

  const header = (
    <PageHeader
      eyebrow={t('products.title')}
      title={t('products.title')}
      subtitle={t('products.subtitle')}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            onClick={isCategoriesView ? openCreateCategoryForm : openCreateForm}
          >
            <AppIcon name="plus" className="h-4 w-4" aria-hidden="true" />
            {isCategoriesView ? t('products.newCategory') : t('products.newProduct')}
          </button>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
            <AppIcon name="products" className="h-3.5 w-3.5" aria-hidden="true" />
            {totalItemsCount} {isCategoriesView ? t('products.categoriesRecords') : t('products.records')}
          </span>
        </div>
      }
    />
  );

  if (!hasLoadedOnce && isLoading) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <LoadingState title={t('products.loadingTitle')} description={t('products.loadingDescription')} />
          </PageCard>
        </PageSection>
      </PageLayout>
    );
  }

  if (hasError) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <EmptyState
              title={t('products.errorTitle')}
              description={t('products.errorDescription')}
            />
          </PageCard>
        </PageSection>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <PageSection>
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={isCategoriesView ? t('products.categorySearchPlaceholder') : t('products.searchPlaceholder')}
          />

          {!isCategoriesView ? (
            <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]">
              <span className={labelClassName}>{t('products.status')}</span>
              <FilterSelect
                value={activeFilter}
                options={activeFilterOptions}
                onChange={(value) => setActiveFilter(value as ActiveFilter)}
                disabled={isLoading}
              />
            </label>
          ) : null}

          {!isCategoriesView ? (
            <label className="grid min-w-[min(220px,100%)] flex-[1_1_220px] gap-1.5 min-[640px]:flex-[0_1_240px]">
              <span className={labelClassName}>{t('products.orderBy')}</span>
              <FilterSelect
                value={ordering}
                options={orderingOptions}
                onChange={(value) => setOrdering(value as ProductOrdering)}
                disabled={isLoading}
              />
            </label>
          ) : null}

          {!isCategoriesView ? (
            <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_200px]">
              <span className={labelClassName}>{t('products.form.category')}</span>
              <FilterSelect
                value={categoryFilter}
                options={[{ value: 'all', label: t('common.all') }, ...categoryOptions]}
                onChange={setCategoryFilter}
                disabled={isLoading || isCategoryOptionsLoading}
              />
            </label>
          ) : null}
        </FilterBar>

        <PageCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-full overflow-x-auto">
              <div className="inline-flex min-w-max flex-nowrap items-center gap-1 rounded-pill bg-surface-subtle/85 p-1 ring-1 ring-border-soft/50">
              {[
                { id: 'products' as const, label: t('products.catalogTitle') },
                { id: 'categories' as const, label: t('products.categoriesCatalogTitle') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogView(tab.id)}
                  className={[
                    'shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-sm font-semibold transition duration-fast',
                    catalogView === tab.id
                      ? 'bg-background-subtle text-text-primary shadow-sm ring-1 ring-border-soft/55'
                      : 'text-text-secondary hover:bg-background-subtle/65 hover:text-text-primary',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
              </div>
            </div>
            <span className="text-sm text-text-secondary">{t('products.catalogHint')}</span>
          </div>

          {isCategoriesView ? (
            <div className="grid gap-2">
              {categoryReorderErrorMessage ? (
                <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
                  {categoryReorderErrorMessage}
                </p>
              ) : null}
              <DataTable
                data={pagedCategories}
                columns={categoryColumns}
                rowKey="id"
                selectedRowKey={selectedCategoryId}
                loading={isCategoryOptionsLoading}
                onRowClick={(category) => setSelectedCategoryId(category.id)}
                rowReorder={{
                  disabled: isCategoryOptionsLoading || isCategoryReordering,
                  onReorder: (fromIndex, toIndex) => {
                    void handleReorderCategories(fromIndex, toIndex);
                  },
                }}
                emptyTitle={t('products.categoriesEmptyTitle')}
                emptyDescription={t('products.categoriesEmptyDescription')}
              />
            </div>
          ) : (
            <DataTable
              data={products}
              columns={productColumns}
              rowKey="id"
              selectedRowKey={selectedProductId}
              loading={isLoading}
              getRowClassName={(product) => {
                const status = resolveStockStatus(product);
                if (status === 'in_stock') {
                  return '';
                }

                return [
                  'bg-danger-bg/55',
                  'shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.16)]',
                  'hover:bg-danger-bg/70',
                ].join(' ');
              }}
              onRowClick={(product) => setSelectedProductId(product.id)}
              emptyTitle={t('products.emptyTitle')}
              emptyDescription={t('products.emptyDescription')}
            />
          )}
        </PageCard>

        {isCategoriesView ? (
          !isCategoryOptionsLoading && categoryMeta.totalItems > 0 ? (
            <Pagination
              currentPage={categoryMeta.page}
              totalPages={categoryMeta.totalPages}
              totalItems={categoryMeta.totalItems}
              onPageChange={setCurrentPage}
            />
          ) : null
        ) : !isLoading && paginationMeta.totalItems > 0 ? (
          <Pagination
            currentPage={Math.min(currentPage, paginationMeta.totalPages)}
            totalPages={paginationMeta.totalPages}
            totalItems={paginationMeta.totalItems}
            onPageChange={setCurrentPage}
          />
        ) : null}
      </PageSection>

      {!isCategoriesView && selectedProductId ? (
        <ProductDetailPanel
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onProductChanged={() => setReloadCursor((current) => current + 1)}
          onEdit={(product) => {
            openEditForm(product);
            setSelectedProductId(null);
          }}
          onDelete={(product) => {
            requestDelete(product);
            setSelectedProductId(null);
          }}
        />
      ) : null}

      {isCategoriesView && selectedCategoryId ? (
        <ProductCategoryDetailPanel
          categoryId={selectedCategoryId}
          onClose={() => setSelectedCategoryId(null)}
          onEdit={(category) => {
            openEditCategoryForm(category);
            setSelectedCategoryId(null);
          }}
          onDelete={(category) => {
            setCategoryToDelete(category);
            setSelectedCategoryId(null);
          }}
        />
      ) : null}

      {isFormOpen ? (
        <ProductFormPanel
          mode={formMode}
          product={editingProduct}
          categoryOptions={categoryOptions}
          isCategoryOptionsLoading={isCategoryOptionsLoading}
          isSubmitting={isSaving}
          errorMessage={formErrorMessage}
          onClose={() => {
            if (!isSaving) {
              setIsFormOpen(false);
              setEditingProduct(null);
              setFormErrorMessage(null);
            }
          }}
          onSubmit={(payload) => {
            void handleSaveProduct(payload);
          }}
        />
      ) : null}

      {productToDelete ? (
        <ProductDeleteDialog
          product={productToDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onCancel={() => {
            if (!isDeleting) {
              setProductToDelete(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      ) : null}

      {isCategoryFormOpen ? (
        <ProductCategoryFormDialog
          mode={categoryFormMode}
          category={editingCategory}
          isSubmitting={isCategorySaving}
          errorMessage={categoryFormErrorMessage}
          onClose={() => {
            if (!isCategorySaving) {
              setIsCategoryFormOpen(false);
              setEditingCategory(null);
              setCategoryFormErrorMessage(null);
            }
          }}
          onSubmit={(payload) => {
            void handleSaveCategory(payload);
          }}
        />
      ) : null}

      {categoryToDelete ? (
        <ProductCategoryDeleteDialog
          category={categoryToDelete}
          isDeleting={isCategoryDeleting}
          errorMessage={categoryDeleteError}
          onCancel={() => {
            if (!isCategoryDeleting) {
              setCategoryToDelete(null);
              setCategoryDeleteError(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDeleteCategory();
          }}
        />
      ) : null}
    </PageLayout>
  );
}

export default ProductsPage;
