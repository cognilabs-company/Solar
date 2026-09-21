import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  FilterBar,
  FilterSelect,
  Pagination,
  SearchInput,
  StatusBadge,
  Switch,
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
import IntegrationConfigDeleteDialog from '../../../features/integrations/components/IntegrationConfigDeleteDialog';
import IntegrationConfigDetailPanel from '../../../features/integrations/components/IntegrationConfigDetailPanel';
import IntegrationConfigFormPanel from '../../../features/integrations/components/IntegrationConfigFormPanel';
import { formatLocalizedDate } from '../../../i18n/date-format';
import {
  getIntegrationProviderClassName,
  getIntegrationProviderLabel,
  maskSecretValue,
} from '../../../features/integrations/utils/integration-format';
import { usePersistentState } from '../../../lib/persistent-state';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { services } from '../../../services';
import type {
  IntegrationConfig,
  IntegrationConfigListParams,
  IntegrationConfigMutationInput,
  IntegrationProvider,
  PaginationMeta,
  SelectOption,
} from '../../../types/domain';

type ProviderFilter = 'all' | IntegrationProvider;
type ActiveFilter = 'all' | 'active' | 'inactive';
type SecretFilter = 'all' | 'secret' | 'public';
type ConfigOrdering =
  | '-updated_at'
  | 'updated_at'
  | '-created_at'
  | 'created_at'
  | 'provider'
  | '-provider'
  | 'key'
  | '-key';

const PAGE_SIZE = 8;
const DEFAULT_ORDERING: ConfigOrdering = '-updated_at';

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

function ProviderIcon({ provider }: { provider: IntegrationProvider }) {
  if (provider === 'telegram') {
    return <FaTelegramPlane className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (provider === 'instagram') {
    return <FaInstagram className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <AppIcon name="sparkles" className="h-3.5 w-3.5" aria-hidden="true" />;
}

function parseConfigOrdering(ordering: ConfigOrdering): Pick<
  IntegrationConfigListParams,
  'sortBy' | 'sortDirection'
> {
  return {
    sortBy: ordering.replace('-', ''),
    sortDirection: ordering.startsWith('-') ? 'desc' : 'asc',
  };
}

function toBooleanActiveFilter(value: ActiveFilter): boolean | undefined {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return undefined;
}

function toBooleanSecretFilter(value: SecretFilter): boolean | undefined {
  if (value === 'secret') return true;
  if (value === 'public') return false;
  return undefined;
}

function IntegrationsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission, hasRole } = useAuth();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const canManageIntegrations = hasRole('developer') || hasPermission('can_manage_integrations');

  const [configSearch, setConfigSearch] = usePersistentState('integrations:config-search', '');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [secretFilter, setSecretFilter] = useState<SecretFilter>('all');
  const [ordering, setOrdering] = useState<ConfigOrdering>(DEFAULT_ORDERING);
  const [currentPage, setCurrentPage] = useState(1);
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('edit');
  const [editingConfig, setEditingConfig] = useState<IntegrationConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [configToDelete, setConfigToDelete] = useState<IntegrationConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [configSearch, providerFilter, activeFilter, secretFilter, ordering]);

  useEffect(() => {
    let isActive = true;

    async function loadConfigs() {
      setIsLoading(true);
      setHasError(false);

      try {
        const result = await services.integrations.listConfigs({
          page: currentPage,
          pageSize: PAGE_SIZE,
          search: configSearch.trim() || undefined,
          provider: providerFilter === 'all' ? undefined : providerFilter,
          is_active: toBooleanActiveFilter(activeFilter),
          is_secret: toBooleanSecretFilter(secretFilter),
          ordering,
          ...parseConfigOrdering(ordering),
        });

        if (!isActive) return;

        if (currentPage > result.meta.totalPages) {
          setCurrentPage(result.meta.totalPages);
          return;
        }

        setConfigs(result.items);
        setPaginationMeta(result.meta);
      } catch {
        if (!isActive) return;
        setHasError(true);
        setConfigs([]);
        setPaginationMeta(DEFAULT_PAGINATION_META);
      } finally {
        if (isActive) {
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      }
    }

    void loadConfigs();

    return () => {
      isActive = false;
    };
  }, [activeFilter, configSearch, currentPage, ordering, providerFilter, secretFilter, refreshToken]);

  async function handleToggleConfigActive(config: IntegrationConfig, nextIsActive: boolean) {
    if (!canManageIntegrations) {
      return;
    }

    try {
      const updated = await services.integrations.patchConfig(config.id, {
        is_active: nextIsActive,
      });

      if (!updated) {
        return;
      }

      setConfigs((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch {
      // No-op: keep current UI state.
    }
  }

  function openDetail(config: IntegrationConfig) {
    setSelectedConfigId(config.id);
  }

  function closeDetail() {
    setSelectedConfigId(null);
  }

  function openEditForm(config: IntegrationConfig) {
    setFormMode('edit');
    setEditingConfig(config);
    setFormErrorMessage(null);
    setIsFormOpen(true);
    setSelectedConfigId(null);
  }

  function openCreateForm() {
    if (!canManageIntegrations) {
      return;
    }

    setFormMode('create');
    setEditingConfig(null);
    setFormErrorMessage(null);
    setIsFormOpen(true);
    setSelectedConfigId(null);
  }

  function requestDelete(config: IntegrationConfig) {
    setConfigToDelete(config);
    setSelectedConfigId(null);
  }

  async function handleSaveConfig(payload: IntegrationConfigMutationInput) {
    setIsSaving(true);
    setFormErrorMessage(null);

    try {
      if (formMode === 'create') {
        await services.integrations.createConfig(payload);
        setCurrentPage(1);
      } else if (editingConfig?.id) {
        const updated = await services.integrations.patchConfig(editingConfig.id, payload);
        if (updated) {
          setConfigs((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        }
      }

      setIsFormOpen(false);
      setEditingConfig(null);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setFormErrorMessage(
        error instanceof Error ? error.message : t('integrations.configForm.saveError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!configToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await services.integrations.deleteConfig(configToDelete.id);
      setConfigToDelete(null);
      setConfigs((current) => current.filter((item) => item.id !== configToDelete.id));
      setRefreshToken((current) => current + 1);
    } catch (error) {
      // Previously an unhandled rejection: dialog stayed open with no feedback.
      setDeleteError(
        extractApiErrorMessage(error, t('integrations.deleteDialog.error')),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const providerOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: t('integrations.filters.allProviders') },
      { value: 'telegram', label: t('integrations.providers.telegram') },
      { value: 'instagram', label: t('integrations.providers.instagram') },
      { value: 'openai', label: t('integrations.providers.openai') },
    ],
    [t],
  );

  const activeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: t('integrations.filters.allStatuses') },
      { value: 'active', label: t('common.active') },
      { value: 'inactive', label: t('common.inactive') },
    ],
    [t],
  );

  const secretOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: t('integrations.filters.allTypes') },
      { value: 'secret', label: t('integrations.secret') },
      { value: 'public', label: t('integrations.public') },
    ],
    [t],
  );

  const orderingOptions = useMemo<SelectOption[]>(
    () => [
      { value: '-updated_at', label: t('integrations.ordering.updatedNewest') },
      { value: 'updated_at', label: t('integrations.ordering.updatedOldest') },
      { value: '-created_at', label: t('integrations.ordering.createdNewest') },
      { value: 'created_at', label: t('integrations.ordering.createdOldest') },
      { value: 'provider', label: t('integrations.ordering.providerAsc') },
      { value: '-provider', label: t('integrations.ordering.providerDesc') },
      { value: 'key', label: t('integrations.ordering.keyAsc') },
      { value: '-key', label: t('integrations.ordering.keyDesc') },
    ],
    [t],
  );

  const columns = useMemo<DataTableColumn<IntegrationConfig>[]>(() => {
    return [
      {
        key: 'provider',
        label: t('integrations.configColumns.provider'),
        render: (config) => (
          <span
            className={[
              'inline-flex min-h-7 items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
              getIntegrationProviderClassName(config.provider),
            ].join(' ')}
          >
            <ProviderIcon provider={config.provider} />
            {getIntegrationProviderLabel(config.provider)}
          </span>
        ),
      },
      {
        key: 'key',
        label: t('integrations.configColumns.key'),
        render: (config) => (
          <div className="grid gap-0.5">
            <span className={tablePrimaryTextClassName}>{config.key}</span>
            <span className={tableSecondaryTextClassName}>{config.label}</span>
          </div>
        ),
      },
      {
        key: 'value',
        label: t('integrations.configColumns.value'),
        render: (config) => (
          <span className={tablePrimaryTextClassName}>
            {config.is_secret ? maskSecretValue(config.value) : config.value}
          </span>
        ),
      },
      {
        key: 'visibility',
        label: t('integrations.configColumns.visibility'),
        render: (config) => (
          <StatusBadge
            status={config.is_secret ? 'secret' : 'public'}
            tone={config.is_secret ? 'warning' : 'info'}
            label={config.is_secret ? t('integrations.secret') : t('integrations.public')}
          />
        ),
      },
      {
        key: 'active',
        label: t('integrations.configColumns.active'),
        render: (config) =>
          canManageIntegrations ? (
            <Switch
              checked={config.is_active}
              onChange={(nextValue) => {
                void handleToggleConfigActive(config, nextValue);
              }}
              stopPropagation
            />
          ) : (
            <StatusBadge
              status={config.is_active ? 'active' : 'inactive'}
              tone={config.is_active ? 'success' : 'neutral'}
              label={config.is_active ? t('common.active') : t('common.inactive')}
            />
          ),
      },
      {
        key: 'updatedAt',
        label: t('integrations.configColumns.updatedAt'),
        render: (config) => (
          <span className={tablePrimaryTextClassName}>
            {formatLocalizedDate(config.updated_at, i18n.language, {
              locale,
              withYear: true,
              shortMonth: true,
              fallback: t('common.na'),
            })}
          </span>
        ),
      },
      ...(canManageIntegrations
        ? [
            {
              key: 'actions',
              label: t('integrations.configColumns.actions'),
              align: 'right' as const,
              render: (config: IntegrationConfig) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditForm(config);
                    }}
                    aria-label={t('integrations.actions.edit')}
                  >
                    <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-danger-bg text-danger shadow-sm ring-1 ring-danger/30 transition duration-fast hover:brightness-95"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete(config);
                    }}
                    aria-label={t('integrations.actions.delete')}
                  >
                    <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ),
            },
          ]
        : []),
    ];
  }, [canManageIntegrations, i18n.language, locale, t]);

  const header = (
    <PageHeader
      eyebrow={t('integrations.eyebrow')}
      title={t('integrations.title')}
      subtitle={t('integrations.subtitle')}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto">
          {canManageIntegrations ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              onClick={openCreateForm}
            >
              <AppIcon name="plus" className="h-4 w-4" aria-hidden="true" />
              {t('integrations.configForm.createSubmit')}
            </button>
          ) : null}
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
            <AppIcon name="integrations" className="h-3.5 w-3.5" aria-hidden="true" />
            {paginationMeta.totalItems} {t('integrations.configRecords')}
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
            <LoadingState
              title={t('integrations.loadingTitle')}
              description={t('integrations.loadingDescription')}
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
              title={t('integrations.errorTitle')}
              description={t('integrations.errorDescription')}
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
            value={configSearch}
            onChange={setConfigSearch}
            placeholder={t('integrations.configSearchPlaceholder')}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
            <label className="grid min-w-[min(160px,100%)] flex-[1_1_160px] gap-1.5 min-[640px]:flex-[0_1_170px]">
              <span className={labelClassName}>{t('integrations.filters.provider')}</span>
              <FilterSelect
                value={providerFilter}
                options={providerOptions}
                onChange={(value) => setProviderFilter(value as ProviderFilter)}
                disabled={isLoading}
              />
            </label>
            <label className="grid min-w-[min(150px,100%)] flex-[1_1_150px] gap-1.5 min-[640px]:flex-[0_1_160px]">
              <span className={labelClassName}>{t('integrations.filters.status')}</span>
              <FilterSelect
                value={activeFilter}
                options={activeOptions}
                onChange={(value) => setActiveFilter(value as ActiveFilter)}
                disabled={isLoading}
              />
            </label>
            <label className="grid min-w-[min(150px,100%)] flex-[1_1_150px] gap-1.5 min-[640px]:flex-[0_1_160px]">
              <span className={labelClassName}>{t('integrations.filters.visibility')}</span>
              <FilterSelect
                value={secretFilter}
                options={secretOptions}
                onChange={(value) => setSecretFilter(value as SecretFilter)}
                disabled={isLoading}
              />
            </label>
            <label className="grid min-w-[min(220px,100%)] flex-[1_1_220px] gap-1.5 min-[640px]:flex-[0_1_240px]">
              <span className={labelClassName}>{t('integrations.filters.ordering')}</span>
              <FilterSelect
                value={ordering}
                options={orderingOptions}
                onChange={(value) => setOrdering(value as ConfigOrdering)}
                disabled={isLoading}
              />
            </label>
          </div>
        </FilterBar>

        <PageCard>
          <DataTable
            data={configs}
            columns={columns}
            rowKey="id"
            selectedRowKey={selectedConfigId}
            loading={isLoading}
            emptyTitle={t('integrations.configEmptyTitle')}
            emptyDescription={t('integrations.configEmptyDescription')}
            onRowClick={openDetail}
          />
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

      {selectedConfigId ? (
        <IntegrationConfigDetailPanel
          configId={selectedConfigId}
          refreshToken={refreshToken}
          canManage={canManageIntegrations}
          onClose={closeDetail}
          onEdit={openEditForm}
          onDelete={requestDelete}
        />
      ) : null}

      {isFormOpen ? (
        <IntegrationConfigFormPanel
          mode={formMode}
          config={editingConfig}
          isSubmitting={isSaving}
          errorMessage={formErrorMessage}
          onClose={() => {
            if (!isSaving) {
              setIsFormOpen(false);
              setEditingConfig(null);
              setFormErrorMessage(null);
            }
          }}
          onSubmit={(payload) => {
            void handleSaveConfig(payload);
          }}
        />
      ) : null}

      {configToDelete ? (
        <IntegrationConfigDeleteDialog
          config={configToDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onCancel={() => {
            if (!isDeleting) {
              setConfigToDelete(null);
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

export default IntegrationsPage;
