import { useEffect, useMemo, useState } from 'react';
import { FiEye } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  EntityCell,
  FilterBar,
  Pagination,
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
import { usePersistentState } from '../../../lib/persistent-state';
import OperatorKpiDetailPanel from '../../../features/operator-kpi/components/OperatorKpiDetailPanel';
import { services } from '../../../services';
import type { OperatorStatisticsSummary } from '../../../types/domain';
import { Calendar } from '../../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { ru, uz } from 'date-fns/locale';

const PAGE_SIZE = 12;

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const actionButtonClassName =
  'table-action';

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultDateFrom(): string {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - 29);
  return toIsoDate(dateFrom);
}

function defaultDateTo(): string {
  return toIsoDate(new Date());
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const clampedPage = Math.min(safePage, totalPages);
  const start = (clampedPage - 1) * safeSize;

  return {
    items: items.slice(start, start + safeSize),
    meta: {
      page: clampedPage,
      pageSize: safeSize,
      totalItems,
      totalPages,
    },
  };
}

function DatePickerField(props: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  locale: string;
  language: string;
}) {
  const { label, value, onChange, disabled, locale, language } = props;
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => fromIsoDate(value), [value]);
  const dayPickerLocale = language.toLowerCase().startsWith('ru') ? ru : uz;

  const displayValue = selected
    ? formatLocalizedDate(`${value}T00:00:00`, language, {
        locale,
        withYear: true,
        withTime: false,
        shortMonth: true,
        fallback: value,
      })
    : value;

  return (
    <label className="grid min-w-[min(220px,100%)] flex-[1_1_220px] gap-1.5 min-[640px]:flex-[0_1_240px]">
      <span className={labelClassName}>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={[
              'inline-flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-left',
              'text-sm font-medium text-text-primary shadow-sm outline-none transition duration-fast',
              'hover:bg-surface-subtle/90 focus-visible:ring-2 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
            ].join(' ')}
            disabled={disabled}
            aria-label={label}
          >
            <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
              {displayValue || 'YYYY-MM-DD'}
            </span>
            <AppIcon
              name="calendar"
              className="h-4 w-4 shrink-0 text-text-muted"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="p-3">
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={(next) => {
              if (!next) {
                return;
              }
              onChange(toIsoDate(next));
              setOpen(false);
            }}
            locale={dayPickerLocale}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

function OperatorKpiPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  const [dateFrom, setDateFrom] = usePersistentState('operator-kpi:date-from', defaultDateFrom());
  const [dateTo, setDateTo] = usePersistentState('operator-kpi:date-to', defaultDateTo());
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<OperatorStatisticsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setHasError(false);

      try {
        const result = await services.operatorStatistics.listOperatorStatistics({
          date_from: dateFrom,
          date_to: dateTo,
        });

        if (!active) {
          return;
        }

        setItems(Array.isArray(result) ? result : []);
      } catch {
        if (!active) {
          return;
        }

        setHasError(true);
        setItems([]);
      } finally {
        if (active) {
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const paginated = useMemo(() => paginate(items, currentPage, PAGE_SIZE), [items, currentPage]);

  const columns = useMemo<DataTableColumn<OperatorStatisticsSummary>[]>(() => {
    return [
      {
        key: 'operator',
        label: t('operatorKpi.columns.operator', { defaultValue: 'Operator' }),
        render: (item) => (
          <EntityCell
            name={item.full_name || item.username}
            seed={item.username}
            subtitle={`@${item.username}`}
          />
        ),
      },
      {
        key: 'contacted_clients',
        label: t('operatorKpi.columns.contactedClients', { defaultValue: 'Clients' }),
        align: 'right',
        render: (item) => (
          <span className="block text-right text-sm font-semibold text-text-primary">
            {item.contacted_clients}
          </span>
        ),
      },
      {
        key: 'messages_sent',
        label: t('operatorKpi.columns.messagesSent', { defaultValue: 'Messages' }),
        align: 'right',
        render: (item) => (
          <span className="block text-right text-sm font-semibold text-text-primary">
            {item.messages_sent}
          </span>
        ),
      },
      {
        key: 'contract_clients',
        label: t('operatorKpi.columns.contractClients', { defaultValue: 'Contracts' }),
        align: 'right',
        render: (item) => (
          <span className="block text-right text-sm font-semibold text-text-primary">
            {item.contract_clients}
          </span>
        ),
      },
      {
        key: 'lost_clients',
        label: t('operatorKpi.columns.lostClients', { defaultValue: 'Lost' }),
        align: 'right',
        render: (item) => (
          <span className="block text-right text-sm font-semibold text-text-primary">
            {item.lost_clients}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('operatorKpi.columns.actions', { defaultValue: 'Actions' }),
        align: 'right',
        render: (item) => (
          <div className="flex justify-end">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedOperatorId(item.operator_id);
              }}
              aria-label={t('operatorKpi.actions.view', { defaultValue: 'View KPI' })}
            >
              <FiEye className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ];
  }, [t]);

  const header = (
    <PageHeader
      eyebrow={t('operatorKpi.eyebrow', { defaultValue: 'Performance' })}
      title={t('operatorKpi.title', { defaultValue: 'Operator KPI' })}
      subtitle={t('operatorKpi.subtitle', { defaultValue: 'Operator performance metrics for selected date range.' })}
      actions={
        <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
          <AppIcon name="activity" className="h-3.5 w-3.5" aria-hidden="true" />
          {paginated.meta.totalItems} {t('operatorKpi.records', { defaultValue: 'operators' })}
        </span>
      }
    />
  );

  if (!hasLoadedOnce && isLoading) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <LoadingState
              title={t('operatorKpi.loadingTitle', { defaultValue: 'Loading operator statistics' })}
              description={t('operatorKpi.loadingDescription', { defaultValue: 'Fetching KPI data…' })}
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
              title={t('operatorKpi.errorTitle', { defaultValue: 'Unable to load KPI' })}
              description={t('operatorKpi.errorDescription', { defaultValue: 'You may not have access or the service is unavailable.' })}
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
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
            <DatePickerField
              label={t('operatorKpi.filters.dateFrom', { defaultValue: 'Date from' })}
              value={dateFrom}
              onChange={setDateFrom}
              disabled={isLoading}
              locale={locale}
              language={i18n.language}
            />
            <DatePickerField
              label={t('operatorKpi.filters.dateTo', { defaultValue: 'Date to' })}
              value={dateTo}
              onChange={setDateTo}
              disabled={isLoading}
              locale={locale}
              language={i18n.language}
            />
          </div>
        </FilterBar>

        <PageCard>
          <DataTable
            data={paginated.items}
            columns={columns}
            rowKey="operator_id"
            selectedRowKey={selectedOperatorId}
            loading={isLoading}
            emptyTitle={t('operatorKpi.emptyTitle', { defaultValue: 'No operators found' })}
            emptyDescription={t('operatorKpi.emptyDescription', { defaultValue: 'Try adjusting the date range.' })}
            onRowClick={(row) => setSelectedOperatorId(row.operator_id)}
          />
        </PageCard>

        {!isLoading && paginated.meta.totalItems > 0 ? (
          <Pagination
            currentPage={Math.min(currentPage, paginated.meta.totalPages)}
            totalPages={paginated.meta.totalPages}
            totalItems={paginated.meta.totalItems}
            onPageChange={setCurrentPage}
          />
        ) : null}
      </PageSection>

      {selectedOperatorId ? (
        <OperatorKpiDetailPanel
          operatorId={selectedOperatorId}
          params={{ date_from: dateFrom, date_to: dateTo }}
          onClose={() => setSelectedOperatorId(null)}
        />
      ) : null}
    </PageLayout>
  );
}

export default OperatorKpiPage;
