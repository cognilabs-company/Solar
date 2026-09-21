import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '../../../auth';
import { formatLocalizedDate } from '../../../i18n/date-format';
import AISettingDeleteDialog from '../../../features/ai-settings/components/AISettingDeleteDialog';
import AISettingDetailPanel from '../../../features/ai-settings/components/AISettingDetailPanel';
import AISettingFormPanel from '../../../features/ai-settings/components/AISettingFormPanel';
import { usePersistentState } from '../../../lib/persistent-state';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { services } from '../../../services';
import type {
  AISetting,
  AISettingMutationInput,
  AISettingsListParams,
  EntityId,
  PaginationMeta,
  SelectOption,
} from '../../../types/domain';

type ActiveFilter = 'all' | 'active' | 'inactive';
type AISettingsOrdering =
  | '-updated_at'
  | 'updated_at'
  | '-created_at'
  | 'created_at'
  | 'name'
  | '-name'
  | '-temperature'
  | 'temperature';

const PAGE_SIZE = 8;
const DEFAULT_ORDERING: AISettingsOrdering = '-updated_at';

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
  'inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60';

function parseOrdering(ordering: AISettingsOrdering): Pick<
  AISettingsListParams,
  'sortBy' | 'sortDirection'
> {
  const direction = ordering.startsWith('-') ? 'desc' : 'asc';
  const sortBy = ordering.replace('-', '');
  return {
    sortBy,
    sortDirection: direction,
  };
}

function toBooleanActiveFilter(value: ActiveFilter): boolean | undefined {
  if (value === 'active') {
    return true;
  }

  if (value === 'inactive') {
    return false;
  }

  return undefined;
}

function AiSettingsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission, hasRole } = useAuth();
  const canManageAISettings =
    hasRole('developer') || hasPermission('can_manage_ai_settings');
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  const [search, setSearch] = usePersistentState('ai-settings:search', '');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [ordering, setOrdering] = useState<AISettingsOrdering>(DEFAULT_ORDERING);
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [activeSettingId, setActiveSettingId] = useState<EntityId | null>(null);
  const [activeSettingName, setActiveSettingName] = useState<string | null>(null);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(
    DEFAULT_PAGINATION_META,
  );
  const [selectedSettingId, setSelectedSettingId] = useState<EntityId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [reloadCursor, setReloadCursor] = useState(0);
  const [detailRefreshToken, setDetailRefreshToken] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingSetting, setEditingSetting] = useState<AISetting | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  const [settingToDelete, setSettingToDelete] = useState<AISetting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, ordering]);

  useEffect(() => {
    let isActive = true;

    async function loadAISettings() {
      setIsLoading(true);
      setHasError(false);

      try {
        const [result, activeSetting] = await Promise.all([
          services.aiSettings.listSettings({
            page: currentPage,
            pageSize: PAGE_SIZE,
            search: search.trim() || undefined,
            is_active: toBooleanActiveFilter(activeFilter),
            ordering,
            ...parseOrdering(ordering),
          }),
          services.aiSettings.getActiveSetting().catch(() => null),
        ]);

        if (!isActive) {
          return;
        }

        if (currentPage > result.meta.totalPages) {
          setCurrentPage(result.meta.totalPages);
          return;
        }

        setSettings(result.items);
        setPaginationMeta(result.meta);
        setActiveSettingId(activeSetting?.id ?? null);
        setActiveSettingName(activeSetting?.name ?? null);
      } catch {
        if (!isActive) {
          return;
        }

        setHasError(true);
        setSettings([]);
        setPaginationMeta(DEFAULT_PAGINATION_META);
        setActiveSettingId(null);
        setActiveSettingName(null);
      } finally {
        if (isActive) {
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      }
    }

    void loadAISettings();

    return () => {
      isActive = false;
    };
  }, [activeFilter, currentPage, ordering, reloadCursor, search]);

  const activeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: t('aiSettings.filters.allStatuses') },
      { value: 'active', label: t('common.active') },
      { value: 'inactive', label: t('common.inactive') },
    ],
    [t],
  );

  const orderingOptions = useMemo<SelectOption[]>(
    () => [
      { value: '-updated_at', label: t('aiSettings.ordering.updatedNewest') },
      { value: 'updated_at', label: t('aiSettings.ordering.updatedOldest') },
      { value: '-created_at', label: t('aiSettings.ordering.createdNewest') },
      { value: 'created_at', label: t('aiSettings.ordering.createdOldest') },
      { value: 'name', label: t('aiSettings.ordering.nameAsc') },
      { value: '-name', label: t('aiSettings.ordering.nameDesc') },
      { value: '-temperature', label: t('aiSettings.ordering.temperatureHighLow') },
      { value: 'temperature', label: t('aiSettings.ordering.temperatureLowHigh') },
    ],
    [t],
  );

  const columns = useMemo<DataTableColumn<AISetting>[]>(() => {
    const baseColumns: DataTableColumn<AISetting>[] = [
      {
        key: 'name',
        label: t('aiSettings.columns.name'),
        render: (setting) => (
          <div className="grid gap-0.5">
            <div className="flex items-center gap-2">
              <span className={tablePrimaryTextClassName}>{setting.name}</span>
              {activeSettingId === setting.id || setting.is_active ? (
                <span className="inline-flex min-h-5 items-center rounded-pill bg-success-bg px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-success">
                  {t('common.active')}
                </span>
              ) : null}
            </div>
            <span className={tableSecondaryTextClassName}>{setting.model_name}</span>
          </div>
        ),
      },
      {
        key: 'model',
        label: t('aiSettings.columns.model'),
        render: (setting) => (
          <span className={tablePrimaryTextClassName}>{setting.model_name}</span>
        ),
      },
      {
        key: 'temperature',
        label: t('aiSettings.columns.temperature'),
        render: (setting) => (
          <span className={tablePrimaryTextClassName}>
            {setting.temperature.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'autoOrder',
        label: t('aiSettings.columns.autoOrder'),
        render: (setting) => (
          <StatusBadge
            status={setting.auto_order_enabled ? 'enabled' : 'disabled'}
            tone={setting.auto_order_enabled ? 'info' : 'neutral'}
            label={
              setting.auto_order_enabled
                ? t('aiSettings.autoOrderOn')
                : t('aiSettings.autoOrderOff')
            }
          />
        ),
      },
      {
        key: 'followUp',
        label: t('aiSettings.columns.followUp'),
        render: (setting) => (
          <StatusBadge
            status={setting.resume_after_operator_minutes > 0 ? 'enabled' : 'disabled'}
            tone={setting.resume_after_operator_minutes > 0 ? 'info' : 'neutral'}
            label={
              setting.resume_after_operator_minutes > 0
                ? `${t('aiSettings.followUpOn')} (${setting.resume_after_operator_minutes}m)`
                : t('aiSettings.followUpOff')
            }
          />
        ),
      },
      {
        key: 'active',
        label: t('aiSettings.columns.active'),
        render: (setting) => (
          <StatusBadge
            status={activeSettingId === setting.id || setting.is_active ? 'active' : 'inactive'}
            tone={activeSettingId === setting.id || setting.is_active ? 'success' : 'neutral'}
            label={
              activeSettingId === setting.id || setting.is_active
                ? t('common.active')
                : t('common.inactive')
            }
          />
        ),
      },
      {
        key: 'updatedAt',
        label: t('aiSettings.columns.updatedAt'),
        render: (setting) => (
          <span className={tablePrimaryTextClassName}>
            {formatLocalizedDate(setting.updated_at, i18n.language, {
              locale,
              withYear: true,
              shortMonth: true,
              fallback: t('common.na'),
            })}
          </span>
        ),
      },
    ];

    if (!canManageAISettings) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        key: 'actions',
        label: t('aiSettings.columns.actions'),
        align: 'right',
        render: (setting) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                openEditForm(setting);
              }}
              aria-label={`${t('aiSettings.actions.edit')} ${setting.name}`}
            >
              <FiEdit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                requestDelete(setting);
              }}
              disabled={activeSettingId === setting.id || setting.is_active}
              aria-label={`${t('aiSettings.actions.delete')} ${setting.name}`}
            >
              <FiTrash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ];
  }, [activeSettingId, canManageAISettings, i18n.language, locale, t]);

  function openCreateForm() {
    if (!canManageAISettings) {
      return;
    }

    setFormMode('create');
    setEditingSetting(null);
    setFormErrorMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(setting: AISetting) {
    if (!canManageAISettings) {
      return;
    }

    setFormMode('edit');
    setEditingSetting(setting);
    setFormErrorMessage(null);
    setIsFormOpen(true);
  }

  function requestDelete(setting: AISetting) {
    if (!canManageAISettings) {
      return;
    }

    setSettingToDelete(setting);
  }

  async function handleSaveSetting(payload: AISettingMutationInput) {
    setIsSaving(true);
    setFormErrorMessage(null);

    try {
      if (formMode === 'create') {
        await services.aiSettings.createSetting(payload);
        setCurrentPage(1);
      } else {
        const editId = editingSetting?.id;
        if (!editId) {
          throw new Error(t('aiSettings.form.saveError'));
        }

        const updated = await services.aiSettings.updateSetting(editId, payload);
        if (!updated) {
          throw new Error(t('aiSettings.form.saveError'));
        }

        setDetailRefreshToken((current) => current + 1);
      }

      setIsFormOpen(false);
      setEditingSetting(null);
      setReloadCursor((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('aiSettings.form.saveError');
      setFormErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!settingToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const deleted = await services.aiSettings.deleteSetting(settingToDelete.id);
      if (!deleted) {
        throw new Error();
      }

      if (selectedSettingId === settingToDelete.id) {
        setSelectedSettingId(null);
      }

      setSettingToDelete(null);
      setReloadCursor((current) => current + 1);
    } catch (error) {
      // Dialog remains open on failure, with the reason (e.g. active config).
      setDeleteError(extractApiErrorMessage(error, t('aiSettings.deleteDialog.error')));
    } finally {
      setIsDeleting(false);
    }
  }

  const activeFilterCount =
    Number(search.trim().length > 0) +
    Number(activeFilter !== 'all') +
    Number(ordering !== DEFAULT_ORDERING);

  const header = (
    <PageHeader
      eyebrow={t('aiSettings.eyebrow')}
      title={t('aiSettings.title')}
      subtitle={t('aiSettings.subtitle')}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto">
          {canManageAISettings ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              onClick={openCreateForm}
            >
              <AppIcon name="plus" className="h-4 w-4" aria-hidden="true" />
              {t('aiSettings.newSetting')}
            </button>
          ) : null}
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
            <AppIcon name="ai-settings" className="h-3.5 w-3.5" aria-hidden="true" />
            {paginationMeta.totalItems} {t('aiSettings.records')}
          </span>
          {activeSettingName ? (
            <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success">
              <AppIcon name="sparkles" className="h-3.5 w-3.5" aria-hidden="true" />
              {activeSettingName}
            </span>
          ) : null}
        </div>
      }
    />
  );

  if (!hasLoadedOnce && isLoading) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <LoadingState
              title={t('aiSettings.loadingTitle')}
              description={t('aiSettings.loadingDescription')}
            />
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
              title={t('aiSettings.errorTitle')}
              description={t('aiSettings.errorDescription')}
            />
          </PageCard>
        </PageSection>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <PageSection>
        <FilterBar
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 max-[820px]:justify-start min-[820px]:w-auto">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-subtle px-3 text-sm font-semibold text-text-primary">
                <AppIcon
                  name="activity"
                  className="h-4 w-4 text-text-muted"
                  aria-hidden="true"
                />
                {paginationMeta.totalItems} {t('aiSettings.records')}
              </span>
              {activeFilterCount > 0 ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary/12 px-3 text-sm font-semibold text-text-accent">
                  <AppIcon name="filter" className="h-4 w-4" aria-hidden="true" />
                  {activeFilterCount} {t('aiSettings.activeFilters')}
                </span>
              ) : null}
            </div>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('aiSettings.searchPlaceholder')}
          />

          <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]">
            <span className={labelClassName}>{t('aiSettings.filters.status')}</span>
            <FilterSelect
              value={activeFilter}
              options={activeOptions}
              onChange={(value) => setActiveFilter(value as ActiveFilter)}
              disabled={isLoading}
            />
          </label>

          <label className="grid min-w-[min(220px,100%)] flex-[1_1_220px] gap-1.5 min-[640px]:flex-[0_1_240px]">
            <span className={labelClassName}>{t('aiSettings.filters.ordering')}</span>
            <FilterSelect
              value={ordering}
              options={orderingOptions}
              onChange={(value) => setOrdering(value as AISettingsOrdering)}
              disabled={isLoading}
            />
          </label>
        </FilterBar>

        <PageCard>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="m-0 text-[1rem] font-semibold text-text-primary">
                {t('aiSettings.listTitle')}
              </h2>
              <span className="text-[12px] font-medium text-text-muted">
                {t('aiSettings.listHint')}
              </span>
            </div>

            <DataTable
              data={settings}
              columns={columns}
              rowKey="id"
              selectedRowKey={selectedSettingId}
              loading={isLoading}
              onRowClick={(setting) => setSelectedSettingId(setting.id)}
              emptyTitle={t('aiSettings.emptyTitle')}
              emptyDescription={t('aiSettings.emptyDescription')}
            />
          </div>
        </PageCard>

        {!isLoading && paginationMeta.totalItems > 0 ? (
          <Pagination
            currentPage={Math.min(currentPage, paginationMeta.totalPages)}
            totalPages={paginationMeta.totalPages}
            totalItems={paginationMeta.totalItems}
            onPageChange={setCurrentPage}
          />
        ) : null}
      </PageSection>

      {selectedSettingId ? (
        <AISettingDetailPanel
          settingId={selectedSettingId}
          refreshToken={detailRefreshToken}
          canManage={canManageAISettings}
          onClose={() => setSelectedSettingId(null)}
          onEdit={(setting) => {
            openEditForm(setting);
            setSelectedSettingId(null);
          }}
          onDelete={(setting) => {
            requestDelete(setting);
            setSelectedSettingId(null);
          }}
        />
      ) : null}

      {isFormOpen ? (
        <AISettingFormPanel
          mode={formMode}
          setting={editingSetting}
          isSubmitting={isSaving}
          errorMessage={formErrorMessage}
          onClose={() => {
            if (!isSaving) {
              setIsFormOpen(false);
              setEditingSetting(null);
              setFormErrorMessage(null);
            }
          }}
          onSubmit={handleSaveSetting}
        />
      ) : null}

      {settingToDelete ? (
        <AISettingDeleteDialog
          setting={settingToDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onCancel={() => {
            if (!isDeleting) {
              setSettingToDelete(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      ) : null}
    </PageLayout>
  );
}

export default AiSettingsPage;


