import { useEffect, useMemo, useRef, useState } from 'react';
import type { SelectOption } from '../../../types/common';
import AppIcon from '../icons/AppIcon';
import { useTranslation } from 'react-i18next';

interface FilterSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
}

function FilterSelect({
  value,
  options,
  onChange,
  disabled = false,
  size = 'default',
  searchable = false,
  searchPlaceholder,
}: FilterSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery, searchable]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen && searchQuery) {
      setSearchQuery('');
    }
  }, [isOpen, searchQuery]);

  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    setIsOpen(false);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePlacement() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const expectedMenuHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      setOpenAbove(
        spaceBelow < expectedMenuHeight && spaceAbove > spaceBelow,
      );
    }

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={['relative min-w-0', isOpen ? 'z-[140]' : 'z-10'].join(' ')}
    >
      <button
        type="button"
        className={[
          'inline-flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border-0 bg-surface-card px-4 text-left',
          size === 'compact' ? 'h-10 min-h-10' : 'min-h-[44px]',
          'text-sm font-medium text-text-primary shadow-sm outline-none transition duration-fast',
          'hover:bg-surface-subtle/90 focus-visible:ring-2 focus-visible:ring-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
        ].join(' ')}
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="block min-w-0 flex-1 truncate pr-1">
          {selectedOption?.label ?? t('shared.filterSelect.select')}
        </span>
        <AppIcon
          name="chevron-down"
          className={[
            'h-4 w-4 shrink-0 text-text-muted transition duration-fast',
            isOpen ? 'rotate-180 text-text-secondary' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          className={[
            'absolute left-0 z-[150] w-full overflow-hidden rounded-xl bg-surface-card p-1.5 shadow-[0_22px_44px_-30px_rgba(25,28,30,0.38)] ring-1 ring-border-soft/30',
            openAbove ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
          ].join(' ')}
          role="listbox"
        >
          {searchable ? (
            <div className="px-1 pb-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder ?? t('shared.filterSelect.search')}
                className="w-full rounded-lg border border-border-soft/60 bg-surface-card px-3 py-2 text-sm font-medium text-text-primary outline-none transition duration-fast placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.map((option) => {
              const isSelected = option.value === value;
              const isDisabled = Boolean(option.disabled);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition duration-fast',
                    isSelected
                      ? 'bg-primary/12 text-text-primary'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                    isDisabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-text-secondary' : '',
                  ].join(' ')}
                  onClick={() => {
                    if (isDisabled) {
                      return;
                    }
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                >
                  <span className="block min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected ? (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">
                {t('shared.filterSelect.noResults')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FilterSelect;
