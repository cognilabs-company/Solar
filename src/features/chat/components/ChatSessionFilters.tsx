import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { FiLayers } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { FilterSelect, SearchInput } from '../../../components/shared/data';
import type { ChatChannel, SelectOption } from '../../../types/domain';

type ChannelFilterValue = ChatChannel | 'all';
type OperatorFilterValue = 'all' | 'active' | 'inactive';

interface ChatSessionFiltersProps {
  search: string;
  channelFilter: ChannelFilterValue;
  operatorFilter: OperatorFilterValue;
  ordering: string;
  orderingOptions: SelectOption[];
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onChannelChange: (value: ChannelFilterValue) => void;
  onOperatorFilterChange: (value: OperatorFilterValue) => void;
  onOrderingChange: (value: string) => void;
}

interface ChannelOption {
  value: ChannelFilterValue;
  label: string;
  shortLabel: string;
}

function ChannelFilterIcon({ value }: { value: ChannelFilterValue }) {
  if (value === 'telegram') {
    return <FaTelegramPlane className="h-3.5 w-3.5 text-sky-500" />;
  }

  if (value === 'instagram') {
    return <FaInstagram className="h-3.5 w-3.5 text-rose-500" />;
  }

  return <FiLayers className="h-3.5 w-3.5 text-text-muted" />;
}

function ChatSessionFilters({
  search,
  channelFilter,
  operatorFilter,
  ordering,
  orderingOptions,
  disabled,
  onSearchChange,
  onChannelChange,
  onOperatorFilterChange,
  onOrderingChange,
}: ChatSessionFiltersProps) {
  const { t } = useTranslation();

  const channelOptions: ChannelOption[] = [
    {
      value: 'all',
      label: t('chatPage.filters.allChannels'),
      shortLabel: t('chatPage.filters.allChannelsShort'),
    },
    { value: 'telegram', label: 'Telegram', shortLabel: 'TG' },
    { value: 'instagram', label: 'Instagram', shortLabel: 'IG' },
  ];

  const operatorOptions: Array<{ value: Exclude<OperatorFilterValue, 'all'>; label: string }> = [
    { value: 'active', label: t('chatPage.filters.activeOperator') },
    { value: 'inactive', label: t('chatPage.filters.inactiveOperator') },
  ];

  return (
    <div className="grid gap-2.5 pb-2">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={t('chatPage.filters.searchPlaceholder')}
      />

      <div className="grid gap-1.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {t('chatPage.filters.channel')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {channelOptions.map((option) => {
            const isActive = channelFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={[
                  'inline-flex h-[46px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition duration-fast',
                  'ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60',
                  isActive
                    ? 'bg-primary/14 text-text-accent ring-primary/35'
                    : 'bg-surface-subtle/90 text-text-secondary ring-border-soft/45 hover:bg-surface-card hover:text-text-primary',
                ].join(' ')}
                onClick={() => onChannelChange(option.value)}
                disabled={disabled}
                title={option.label}
                aria-label={option.label}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <ChannelFilterIcon value={option.value} />
                </span>
                <span className="truncate">{option.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {t('chatPage.filters.operator')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {operatorOptions.map((option) => {
            const isActive = operatorFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={[
                  'inline-flex min-h-[42px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition duration-fast',
                  'ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60',
                  isActive
                    ? 'bg-primary/14 text-text-accent ring-primary/35'
                    : 'bg-surface-subtle/90 text-text-secondary ring-border-soft/45 hover:bg-surface-card hover:text-text-primary',
                ].join(' ')}
                onClick={() =>
                  onOperatorFilterChange(isActive ? 'all' : option.value)
                }
                disabled={disabled}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {t('chatPage.filters.sorting')}
        </p>
        <FilterSelect
          value={ordering}
          options={orderingOptions}
          onChange={onOrderingChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default ChatSessionFilters;

