import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useDetail } from '../../../components/hooks';
import { useAuth } from '../../../auth';
import { EmptyState, LoadingState, PageCard } from '../../../components/shared/page';
import { StatusBadge, StatusSelect, type StatusSelectOption } from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { services } from '../../../services';
import { routePaths } from '../../../config/routes';
import type { Client, ClientRecentContract, ClientSelectedProduct } from '../../../services/contracts';
import {
  CONTRACT_STATUSES,
  DELIVERY_STATUSES,
  getContractStatusLabel,
  getContractStatusTone,
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
} from '../../contracts/statusLabels';
import {
  ClientRecallScheduleDisplay,
  readClientRecallAt,
} from './ClientRecallSchedule';

export interface ClientsDetailPanelProps {
  clientId: string;
  onClose?: () => void;
  onEdit?: (client: Client) => void;
  onDelete?: (client: Client) => void;
  onRequestDelete?: (client: Client) => void;
}

function isUuidLike(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function splitNotes(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n\s*\r?\n+/)
    .map(note => note.trim())
    .filter(Boolean);
}

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const valueClassName =
  'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]';

export function ClientsDetailPanel({
  clientId,
  onClose,
  onEdit,
  onDelete,
  onRequestDelete,
}: ClientsDetailPanelProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRu = i18n.language === 'ru';
  const locale = isRu ? 'ru-RU' : 'uz-UZ';
  const tx = isRu
    ? {
        title: 'Профиль клиента',
        loadingTitle: 'Загрузка...',
        loadingDescription: 'Получение данных клиента.',
        errorTitle: 'Клиент не найден',
        errorDescription: 'Клиент недоступен или был удален.',
        fields: {
          phone: 'Телефон',
          region: 'Регион',
          address: 'Адрес',
          electricity: 'Потребление электроэнергии',
          budget: 'Бюджет',
          source: 'Источник',
          manager: 'Менеджер',
          chatSession: 'В чат',
          notes: 'Заметки',
          aiSummary: 'AI сводка',
          created: 'Создан',
          updated: 'Обновлен',
          selectedProducts: 'Выбранные продукты',
          recentContracts: 'Недавние договоры',
        },
        edit: 'Редактировать',
        delete: 'Удалить',
      }
    : {
        title: 'Mijoz profili',
        loadingTitle: 'Yuklanmoqda...',
        loadingDescription: 'Mijoz ma\'lumotlari olinmoqda.',
        errorTitle: 'Mijoz topilmadi',
        errorDescription: 'Mijoz mavjud emas yoki o\'chirilgan.',
        fields: {
          phone: 'Telefon',
          region: 'Hudud',
          address: 'Manzil',
          electricity: 'Elektr iste\'moli',
          budget: 'Byudjet',
          source: 'Manba',
          manager: 'Menejer',
          chatSession: 'Chatga',
          notes: 'Izohlar',
          aiSummary: 'AI xulosa',
          created: 'Yaratilgan',
          updated: 'Yangilangan',
          selectedProducts: 'Tanlangan mahsulotlar',
          recentContracts: 'Yaqindagi shartnomalar',
        },
        edit: 'Tahrirlash',
        delete: 'O\'chirish',
      };

  const statusLabels = isRu
    ? {
        new: 'Новый',
        contacted: 'Связались',
        qualified: 'Квалифицирован',
        need_follow_up: 'Нужен фоллоу-ап',
        proposal_preparing: 'Подготовка предложения',
        proposal_sent: 'Предложение отправлено',
        negotiation: 'Переговоры',
        waiting_for_decision: 'Ожидает оплату',
        won: 'Выигран',
        lost: 'Потерян',
        postponed: 'Отложен',
      }
    : {
        new: 'Yangi',
        contacted: "Bog'lanildi",
        qualified: 'Saralangan',
        need_follow_up: 'Qayta aloqa kerak',
        proposal_preparing: 'Taklif tayyorlanmoqda',
        proposal_sent: 'Taklif yuborildi',
        negotiation: 'Muzokara',
        waiting_for_decision: "To'lov kutilmoqda",
        won: 'Yutildi',
        lost: "Yo'qotildi",
        postponed: 'Kechiktirildi',
      };

  const [state, detailActions] = useDetail(() => services.clients.getClient(clientId), { autoFetch: true });
  const { hasPermission } = useAuth();
  const canManageContracts = hasPermission('can_manage_contracts');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [orderStatusError, setOrderStatusError] = useState(false);

  const orderStatusOptions = useMemo<StatusSelectOption[]>(
    () =>
      CONTRACT_STATUSES.map(value => ({
        value,
        label: getContractStatusLabel(value, isRu),
        tone: getContractStatusTone(value),
      })),
    [isRu],
  );

  const deliveryStatusOptions = useMemo<StatusSelectOption[]>(
    () =>
      DELIVERY_STATUSES.map(value => ({
        value,
        label: getDeliveryStatusLabel(value, isRu),
        tone: getDeliveryStatusTone(value),
      })),
    [isRu],
  );

  async function patchOrder(contract: ClientRecentContract, patch: Partial<ClientRecentContract>) {
    if (!contract.id) {
      return;
    }

    const current = state.data as Client | null;
    setOrderStatusError(false);
    setSavingOrderId(contract.id);

    // Optimistically reflect the change in the order list.
    if (current?.recent_contracts) {
      detailActions.update({
        recent_contracts: current.recent_contracts.map(item =>
          item.id === contract.id ? { ...item, ...patch } : item,
        ),
      } as Partial<Client>);
    }

    try {
      await services.contracts.updateContract(contract.id, patch as any);
    } catch {
      setOrderStatusError(true);
      // Reload to restore the true state on failure.
      await detailActions.fetch();
    } finally {
      setSavingOrderId(null);
    }
  }

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'won':
        return 'success';
      case 'lost':
        return 'danger';
      case 'qualified':
        return 'accent';
      case 'new':
        return 'info';
      default:
        return 'warning';
    }
  };

  if (state.isLoading) {
    return <LoadingState title={tx.loadingTitle} description={tx.loadingDescription} />;
  }

  if (state.error || !state.data) {
    return <EmptyState title={tx.errorTitle} description={tx.errorDescription} />;
  }

  const client = state.data as Client;
  const recallAt = readClientRecallAt(client);
  const noteItems = splitNotes(client.notes);
  const statusKey = (client.status || 'new') as keyof typeof statusLabels;
  const localizedStatusLabel =
    statusLabels[statusKey] || client.status_label || client.status || 'new';

  return (
    <div className="grid gap-3">
      <header className="mb-1 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {tx.title}
            </p>
            <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]">
              {client.full_name}
            </h2>
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            onClick={onClose}
            aria-label={tx.title}
          >
            <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          <StatusBadge
            tone={getStatusTone(client.status ?? 'new')}
            status={client.status || 'new'}
            label={localizedStatusLabel}
          />
        </div>
      </header>

      <PageCard>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.phone}</p>
            <p className={`mt-1 ${valueClassName}`}>{client.phone || '-'}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.region}</p>
            <p className={`mt-1 ${valueClassName}`}>{client.region || '-'}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.address}</p>
            <p className={`mt-1 ${valueClassName}`}>{client.address || '-'}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.electricity}</p>
            <p className={`mt-1 ${valueClassName}`}>{client.electricity_consumption || '-'}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.budget}</p>
            <p className={`mt-1 ${valueClassName}`}>{client.budget_range || '-'}</p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.source}</p>
            <p className={`mt-1 ${valueClassName}`}>
              {client.source_platform === 'manual' 
                ? (isRu ? 'Вручную' : 'Qo\'lda') 
                : client.source_platform === 'telegram'
                ? 'Telegram'
                : client.source_platform === 'instagram'
                ? 'Instagram'
                : (client.source_platform_label || client.source_platform || '-')}
            </p>
          </div>
          <div className="rounded-lg bg-surface-subtle/80 p-3">
            <p className={labelClassName}>{tx.fields.manager}</p>
            <p className={`mt-1 ${valueClassName}`}>
              {client.manager_username && !isUuidLike(client.manager_username)
                ? client.manager_username
                : '-'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-surface-subtle/80 p-3 text-left transition duration-fast hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!client.chat_session_id}
            onClick={() => {
              if (!client.chat_session_id) {
                return;
              }

              navigate(routePaths.chats, {
                state: { sessionId: client.chat_session_id },
              });
              onClose?.();
            }}
          >
            <p className={valueClassName}>
              {client.chat_session_id ? tx.fields.chatSession : '-'}
            </p>
          </button>
          {noteItems.length > 0 ? (
            <div className="rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2">
              <p className={labelClassName}>{tx.fields.notes}</p>
              <div className="mt-2 grid gap-2">
                {noteItems.map((note, index) => (
                  <div
                    key={`${index}-${note}`}
                    className="rounded-lg bg-surface-card/72 px-3 py-2.5 ring-1 ring-border-soft/35"
                  >
                    <p className="m-0 text-sm leading-6 text-text-secondary [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {client.ai_summary ? (
            <div className="rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2">
              <p className={labelClassName}>{tx.fields.aiSummary}</p>
              <p className="mt-1 text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
                {client.ai_summary}
              </p>
            </div>
          ) : null}
          <ClientRecallScheduleDisplay
            value={recallAt}
            language={i18n.language}
            locale={locale}
          />
        </div>
      </PageCard>

      {client.selected_products && client.selected_products.length > 0 ? (
        <PageCard>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <AppIcon name="products" className="h-4 w-4" />
            </div>
            <p className={`${labelClassName} text-text-primary`}>{tx.fields.selectedProducts}</p>
          </div>
          <div className="grid gap-2.5">
            {client.selected_products.map((item: ClientSelectedProduct, i: number) => (
              <button
                key={item.product_id ?? i}
                type="button"
                className="group relative flex w-full flex-col gap-1.5 rounded-xl bg-surface-subtle/50 p-3.5 text-left text-sm transition-all duration-fast hover:bg-surface-subtle/80 ring-1 ring-border-soft/20 hover:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={!item.product_id}
                onClick={() => {
                  if (!item.product_id) {
                    return;
                  }

                  navigate(routePaths.products, { state: { productId: item.product_id } });
                  onClose?.();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold leading-tight text-text-primary [overflow-wrap:anywhere] group-hover:text-primary transition-colors">
                    {item.product_name}
                  </span>
                  <div className="shrink-0 flex items-center gap-1 overflow-hidden rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                    <span>x</span>
                    <span>{item.quantity}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {item.unit_price && (
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <div className="h-1 w-1 rounded-full bg-border-soft" />
                      <p className="font-semibold text-[13px]">
                        {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(item.unit_price))} UZS
                      </p>
                    </div>
                  )}
                  {item.contract_title && (
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <div className="h-1 w-1 rounded-full bg-border-soft" />
                      <p className="text-[12px] font-medium italic">
                        {item.contract_title}
                      </p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </PageCard>
      ) : null}

      {client.recent_contracts && client.recent_contracts.length > 0 ? (
        <PageCard>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-bg text-info">
              <AppIcon name="contracts" className="h-4 w-4" />
            </div>
            <p className={`${labelClassName} text-text-primary`}>{tx.fields.recentContracts}</p>
          </div>
          <div className="grid gap-2.5">
            {client.recent_contracts.map((contract: ClientRecentContract, i: number) => (
              <div
                key={contract.id ?? i}
                className="group flex w-full flex-col gap-3 rounded-xl bg-surface-subtle/50 p-3.5 ring-1 ring-border-soft/20 transition-all duration-fast hover:bg-surface-subtle/80 hover:ring-info/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={!contract.id}
                    onClick={() => {
                      if (!contract.id) {
                        return;
                      }

                      navigate(routePaths.contracts, { state: { contractId: contract.id } });
                      onClose?.();
                    }}
                  >
                    <p className="text-[13.5px] font-bold text-text-primary group-hover:text-info transition-colors [overflow-wrap:anywhere]">
                      {contract.title}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-text-muted flex items-center gap-1">
                      <AppIcon name="activity" className="h-3 w-3 opacity-60" />
                      {formatLocalizedDate(contract.created_at, locale, { locale, withYear: true, withTime: true, shortMonth: true, fallback: '-' })}
                    </p>
                  </button>
                  {contract.status ? (
                    canManageContracts && contract.id ? (
                      <StatusSelect
                        value={contract.status}
                        options={orderStatusOptions}
                        disabled={savingOrderId === contract.id}
                        onChange={next => {
                          if (next !== contract.status) {
                            void patchOrder(contract, { status: next });
                          }
                        }}
                        ariaLabel={isRu ? 'Статус заказа' : 'Buyurtma holati'}
                      />
                    ) : (
                      <div className="shrink-0 scale-90 origin-top-right">
                        <StatusBadge
                          tone={getContractStatusTone(contract.status)}
                          status={contract.status}
                          label={getContractStatusLabel(contract.status, isRu)}
                        />
                      </div>
                    )
                  ) : null}
                </div>

                {contract.total_amount && (
                  <div className="flex items-center justify-between border-t border-border-soft/20 pt-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total</span>
                    <p className="text-[14px] font-black tracking-tight text-text-primary">
                      {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(contract.total_amount))} UZS
                    </p>
                  </div>
                )}

                {contract.delivery_status ? (
                  <div className="flex items-center justify-between gap-2 border-t border-border-soft/20 pt-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      {isRu ? 'Доставка' : 'Yetkazish'}
                    </span>
                    {canManageContracts && contract.id ? (
                      <StatusSelect
                        value={contract.delivery_status}
                        options={deliveryStatusOptions}
                        disabled={savingOrderId === contract.id}
                        onChange={next => {
                          if (next !== contract.delivery_status) {
                            void patchOrder(contract, { delivery_status: next });
                          }
                        }}
                        ariaLabel={isRu ? 'Статус доставки' : 'Yetkazish holati'}
                      />
                    ) : (
                      <div className="shrink-0 scale-90 origin-top-right">
                        <StatusBadge
                          tone={getDeliveryStatusTone(contract.delivery_status)}
                          status={contract.delivery_status}
                          label={contract.delivery_status_label || getDeliveryStatusLabel(contract.delivery_status, isRu)}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {orderStatusError ? (
            <p className="mt-2 text-[12px] font-semibold text-danger">
              {isRu ? 'Не удалось обновить статус заказа.' : 'Buyurtma holatini yangilab bo\'lmadi.'}
            </p>
          ) : null}
        </PageCard>
      ) : null}

      <PageCard>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
            <p className={labelClassName}>{tx.fields.created}</p>
            <p className={`mt-1 ${valueClassName}`}>
              {formatLocalizedDate(client.created_at, locale, {
                locale,
                withYear: true,
                withTime: true,
                shortMonth: true,
                fallback: '-',
              })}
            </p>
          </div>
          <div className="rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20">
            <p className={labelClassName}>{tx.fields.updated}</p>
            <p className={`mt-1 ${valueClassName}`}>
              {formatLocalizedDate(client.updated_at, locale, {
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

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          onClick={() => onEdit?.(client)}
        >
          <FiEdit2 className="h-4 w-4" />
          {tx.edit}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 text-sm font-semibold text-danger shadow-sm ring-1 ring-danger/25 transition duration-fast hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/25"
          onClick={() => {
            onRequestDelete?.(client);
            onDelete?.(client);
          }}
        >
          <FiTrash2 className="h-4 w-4" />
          {tx.delete}
        </button>
      </div>
    </div>
  );
}
