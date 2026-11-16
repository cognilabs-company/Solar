import { useEffect, useMemo, useState } from 'react';
import { ru, uz } from 'date-fns/locale';
import { FilterSelect } from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { Calendar } from '../../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { formatLocalizedDate, formatUzMonthYear } from '../../../i18n/date-format';
import type { Client } from '../../../services/contracts';

const MIN_RECALL_LEAD_MINUTES = 6;

const hourOptions = Array.from({ length: 24 }, (_, index) => {
  const value = String(index).padStart(2, '0');
  return { value, label: value };
});

const minuteOptions = Array.from({ length: 60 }, (_, index) => {
  const value = String(index).padStart(2, '0');
  return { value, label: value };
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseRecallAt(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateTimeValue(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':00',
  ].join('');
}

function getMinimumSelectableDateTime(): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + MIN_RECALL_LEAD_MINUTES);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function clampRecallDateTime(candidate: Date, minimumDateTime: Date): Date {
  if (candidate.getTime() < minimumDateTime.getTime()) {
    return new Date(minimumDateTime);
  }

  return candidate;
}

function getTimeParts(
  value: string | null | undefined,
  minimumDateTime: Date,
): { hour: string; minute: string } {
  const parsed = parseRecallAt(value);
  if (!parsed) {
    return {
      hour: pad(minimumDateTime.getHours()),
      minute: pad(minimumDateTime.getMinutes()),
    };
  }

  return {
    hour: pad(parsed.getHours()),
    minute: pad(parsed.getMinutes()),
  };
}

function updateDatePart(
  minimumDateTime: Date,
  nextDate: Date,
  hour: string,
  minute: string,
): string {
  const next = new Date(nextDate);
  next.setHours(Number(hour), Number(minute), 0, 0);
  return toLocalDateTimeValue(clampRecallDateTime(next, minimumDateTime));
}

function updateTimePart(
  minimumDateTime: Date,
  currentValue: string | null | undefined,
  nextHour: string,
  nextMinute: string,
): string {
  const base = parseRecallAt(currentValue) ?? new Date(minimumDateTime);
  const next = new Date(base);
  next.setHours(Number(nextHour), Number(nextMinute), 0, 0);
  return toLocalDateTimeValue(clampRecallDateTime(next, minimumDateTime));
}

function buildLabels(language: string) {
  const isRu = language.toLowerCase().startsWith('ru');

  return isRu
    ? {
        title: 'Дата повторного звонка',
        optional: 'Необязательно',
        dateLabel: 'Дата',
        hourLabel: 'Час',
        minuteLabel: 'Минуты',
        clear: 'Очистить',
        datePlaceholder: 'Выбрать дату',
        notSet: 'Не установлено',
      }
    : {
        title: "Qayta qo'ng'iroq vaqti",
        optional: 'Ixtiyoriy',
        dateLabel: 'Sana',
        hourLabel: 'Soat',
        minuteLabel: 'Daqiqa',
        clear: 'Tozalash',
        datePlaceholder: 'Sana tanlang',
        notSet: 'Belgilanmagan',
      };
}

export function readClientRecallAt(
  client?: Pick<Client, 'recall_at' | 'metadata'> | null,
): string | null {
  if (!client) {
    return null;
  }

  if (typeof client.recall_at === 'string' && client.recall_at.trim().length > 0) {
    return client.recall_at.trim();
  }

  if (!isRecord(client.metadata)) {
    return null;
  }

  const fallback = client.metadata.recall_at;
  return typeof fallback === 'string' && fallback.trim().length > 0 ? fallback.trim() : null;
}

interface ClientRecallScheduleFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  language: string;
  locale: string;
  disabled?: boolean;
}

export function ClientRecallScheduleField({
  value,
  onChange,
  language,
  locale,
  disabled = false,
}: ClientRecallScheduleFieldProps) {
  const labels = useMemo(() => buildLabels(language), [language]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [timeParts, setTimeParts] = useState(() =>
    getTimeParts(value, getMinimumSelectableDateTime()),
  );
  const minimumDateTime = getMinimumSelectableDateTime();

  useEffect(() => {
    setTimeParts(getTimeParts(value, getMinimumSelectableDateTime()));
  }, [value]);

  const parsed = useMemo(() => parseRecallAt(value), [value]);
  const isUzLanguage = language.toLowerCase().startsWith('uz');
  const calendarLocale = isUzLanguage ? uz : ru;
  const selectedDate = parsed ?? minimumDateTime;
  const isTodaySelection = isSameDay(selectedDate, minimumDateTime);
  const hourOptionsWithState = useMemo(
    () =>
      hourOptions.map(option => {
        const hour = Number(option.value);
        const disabledOption = isTodaySelection && hour < minimumDateTime.getHours();
        return {
          ...option,
          disabled: disabledOption,
        };
      }),
    [isTodaySelection, minimumDateTime],
  );
  const minuteOptionsWithState = useMemo(
    () =>
      minuteOptions.map(option => {
        const minute = Number(option.value);
        const disabledOption =
          isTodaySelection &&
          Number(timeParts.hour) === minimumDateTime.getHours() &&
          minute < minimumDateTime.getMinutes();

        return {
          ...option,
          disabled: disabledOption,
        };
      }),
    [isTodaySelection, minimumDateTime, timeParts.hour],
  );
  const displayValue = parsed
    ? formatLocalizedDate(parsed, language, {
        locale,
        withYear: true,
        withTime: true,
        shortMonth: true,
        fallback: labels.notSet,
      })
    : labels.notSet;

  return (
    <div className="grid gap-3 rounded-xl border border-border-soft/60 bg-surface-card/80 p-3.5 ring-1 ring-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <AppIcon name="calendar" className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {labels.title}
            </p>
            <p className="mt-0.5 text-sm font-medium text-text-secondary">{displayValue}</p>
          </div>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-pill bg-primary/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
          {labels.optional}
        </span>
      </div>

      <div className="grid gap-3 min-[560px]:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {labels.dateLabel}
          </span>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border-soft/60 bg-surface-card/92 px-3.5 text-left text-sm font-medium text-text-primary shadow-sm outline-none transition duration-fast hover:bg-surface-subtle/90 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                aria-label={labels.dateLabel}
              >
                <span className={`truncate whitespace-nowrap ${parsed ? 'text-text-primary' : 'text-text-muted'}`}>
                  {parsed
                    ? formatLocalizedDate(parsed, language, {
                        locale,
                        withYear: true,
                        withTime: false,
                        shortMonth: true,
                        fallback: labels.datePlaceholder,
                      })
                    : labels.datePlaceholder}
                </span>
                <AppIcon name="calendar" className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={10} className="w-auto p-3">
              <Calendar
                mode="single"
                selected={parsed ?? undefined}
                defaultMonth={selectedDate}
                disabled={{ before: startOfDay(minimumDateTime) }}
                locale={calendarLocale}
                formatters={
                  isUzLanguage
                    ? {
                        formatCaption: date => formatUzMonthYear(date, false),
                      }
                    : undefined
                }
                onSelect={nextDate => {
                  if (!nextDate) {
                    return;
                  }

                  onChange(
                    updateDatePart(
                      minimumDateTime,
                      nextDate,
                      timeParts.hour,
                      timeParts.minute,
                    ),
                  );
                  setIsCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {labels.hourLabel}
          </span>
          <FilterSelect
            value={timeParts.hour}
            options={hourOptionsWithState}
            onChange={nextHour => {
              const nextTimeParts = { hour: nextHour, minute: timeParts.minute };
              setTimeParts(nextTimeParts);
              onChange(
                updateTimePart(
                  minimumDateTime,
                  value,
                  nextTimeParts.hour,
                  nextTimeParts.minute,
                ),
              );
            }}
            disabled={disabled}
            size="compact"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {labels.minuteLabel}
          </span>
          <FilterSelect
            value={timeParts.minute}
            options={minuteOptionsWithState}
            onChange={nextMinute => {
              const nextTimeParts = { hour: timeParts.hour, minute: nextMinute };
              setTimeParts(nextTimeParts);
              onChange(
                updateTimePart(
                  minimumDateTime,
                  value,
                  nextTimeParts.hour,
                  nextTimeParts.minute,
                ),
              );
            }}
            disabled={disabled}
            size="compact"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex min-h-8 items-center rounded-lg bg-danger-bg/70 px-3 text-[11px] font-semibold text-danger ring-1 ring-danger/20 transition duration-fast hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onChange(null)}
          disabled={disabled || !value}
        >
          {labels.clear}
        </button>
      </div>
    </div>
  );
}

interface ClientRecallScheduleDisplayProps {
  value: string | null;
  language: string;
  locale: string;
}

export function ClientRecallScheduleDisplay({
  value,
  language,
  locale,
}: ClientRecallScheduleDisplayProps) {
  const labels = useMemo(() => buildLabels(language), [language]);
  const parsed = useMemo(() => parseRecallAt(value), [value]);
  const displayValue = parsed
    ? formatLocalizedDate(parsed, language, {
        locale,
        withYear: true,
        withTime: true,
        shortMonth: true,
        fallback: labels.notSet,
      })
    : labels.notSet;

  return (
    <div className="rounded-xl border border-border-soft/60 bg-surface-card/80 p-3.5 ring-1 ring-primary/10 sm:col-span-2">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <AppIcon name="calendar" className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            {labels.title}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{displayValue}</p>
        </div>
      </div>
    </div>
  );
}
