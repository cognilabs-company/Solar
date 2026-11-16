import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import AppIcon from '../icons/AppIcon';

type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  accessor?: keyof T | ((row: T) => ReactNode);
  render?: (row: T) => ReactNode;
  align?: DataTableAlign;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey?: keyof T | ((row: T, index: number) => string);
  selectedRowKey?: string | null;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T, index: number) => string;
  rowReorder?: {
    enabled?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    onReorder: (fromIndex: number, toIndex: number) => void;
  };
  /** Drop the wide minimum width — for narrow tables with only a few columns. */
  compact?: boolean;
}

const TABLE_SHELL_CLASS_NAME = [
  'table-shell relative overflow-x-auto rounded-xl bg-surface-card shadow-md ring-1 ring-border-soft/45',
  '[-webkit-overflow-scrolling:touch]',
].join(' ');

const TABLE_CLASS_NAME =
  'data-table min-w-[620px] w-full min-[768px]:min-w-[720px]';

const ROW_CLASS_NAME = 'data-table__row';

const CLICKABLE_ROW_CLASS_NAME = [
  ROW_CLASS_NAME,
  'data-table__row--clickable cursor-pointer',
].join(' ');

const SELECTED_ROW_CLASS_NAME = 'data-table__row--selected';

const HEAD_CELL_BASE_CLASS_NAME = [
  'data-table__cell data-table__cell--head px-4 py-3 align-middle text-[11px] font-bold uppercase tracking-[0.12em] max-[640px]:px-3',
  'text-text-muted',
].join(' ');

const BODY_CELL_BASE_CLASS_NAME =
  'data-table__cell px-4 py-3.5 align-middle text-sm text-text-primary max-[640px]:px-3';

const SKELETON_ROW_COUNT = 6;
const SKELETON_WIDTHS = ['w-[72%]', 'w-[54%]', 'w-[64%]', 'w-[46%]', 'w-[58%]'];

const ALIGN_CLASS_NAMES: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function getRowKey<T>(
  row: T,
  index: number,
  rowKey?: keyof T | ((row: T, index: number) => string),
): string {
  if (typeof rowKey === 'function') {
    return rowKey(row, index);
  }

  if (rowKey) {
    const value = row[rowKey];
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : `row-${index}`;
  }

  return `row-${index}`;
}

function getCellContent<T>(row: T, column: DataTableColumn<T>): ReactNode {
  if (column.render) {
    return column.render(row);
  }

  if (typeof column.accessor === 'function') {
    return column.accessor(row);
  }

  if (column.accessor) {
    const value = row[column.accessor];
    return value as ReactNode;
  }

  return null;
}

function DataTable<T>({
  data,
  columns,
  rowKey,
  selectedRowKey,
  loading = false,
  emptyTitle,
  emptyDescription,
  onRowClick,
  getRowClassName,
  rowReorder,
  compact = false,
}: DataTableProps<T>) {
  const tableClassName = compact
    ? TABLE_CLASS_NAME.replace('min-w-[620px]', 'min-w-0').replace('min-[768px]:min-w-[720px]', '')
    : TABLE_CLASS_NAME;
  const { t } = useTranslation();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const resolvedEmptyTitle = emptyTitle ?? t('shared.table.emptyTitle');
  const resolvedEmptyDescription =
    emptyDescription ?? t('shared.table.emptyDescription');
  const dragOriginIndexRef = useRef<number | null>(null);
  const dragCurrentIndexRef = useRef<number | null>(null);
  const draggedDataIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRowRectRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isRowReorderEnabled = Boolean(rowReorder?.onReorder) && rowReorder?.enabled !== false;
  const isRowReorderDisabled = Boolean(rowReorder?.disabled);
  const reorderAriaLabel = rowReorder?.ariaLabel ?? t('shared.table.reorderRow');
  const [renderOrder, setRenderOrder] = useState<number[] | null>(null);

  function buildDisplayOrder(
    baseOrder: number[],
    draggedIndex: number | null,
    placeholderIndex: number | null,
  ): number[] {
    if (draggedIndex == null || placeholderIndex == null) {
      return baseOrder;
    }

    const withoutDragged = baseOrder.filter((value) => value !== draggedIndex);
    const next = [...withoutDragged];
    const safeIndex = Math.max(0, Math.min(next.length, placeholderIndex));
    next.splice(safeIndex, 0, -1);
    return next;
  }

  const resolvedOrder = useMemo(() => {
    if (!isRowReorderEnabled || isRowReorderDisabled) {
      return null;
    }

    if (renderOrder && renderOrder.length === data.length) {
      return renderOrder;
    }

    return Array.from({ length: data.length }, (_, index) => index);
  }, [data.length, isRowReorderDisabled, isRowReorderEnabled, renderOrder]);

  useEffect(() => {
    if (!isRowReorderEnabled) {
      setRenderOrder(null);
      return;
    }

    setRenderOrder(Array.from({ length: data.length }, (_, index) => index));
  }, [data.length, isRowReorderEnabled]);

  useEffect(() => {
    if (draggingIndex === null || !isRowReorderEnabled || isRowReorderDisabled) {
      return;
    }

    function findClosestRowIndex(eventTarget: EventTarget | null): number | null {
      if (!eventTarget || !(eventTarget instanceof Element)) {
        return null;
      }

      const rowEl = eventTarget.closest('tr[data-reorder-index]');
      if (!rowEl) {
        return null;
      }

      const raw = rowEl.getAttribute('data-reorder-index');
      if (!raw) {
        return null;
      }

      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function handlePointerMove(event: PointerEvent) {
      setDragPointer({ x: event.clientX, y: event.clientY });

      const hoverIndex = findClosestRowIndex(document.elementFromPoint(event.clientX, event.clientY));
      if (hoverIndex === null) {
        return;
      }

      const draggedDataIndex = draggedDataIndexRef.current;
      if (draggedDataIndex === null) {
        return;
      }

      dragCurrentIndexRef.current = hoverIndex;
      setDragOverIndex(hoverIndex);
    }

    function handlePointerUp() {
      const fromIndex = dragOriginIndexRef.current;
      const toIndex = dragCurrentIndexRef.current;

      dragOriginIndexRef.current = null;
      dragCurrentIndexRef.current = null;
      draggedDataIndexRef.current = null;
      setDragOverIndex(null);
      setDraggingIndex(null);
      setDragPointer(null);
      setRenderOrder(Array.from({ length: data.length }, (_, idx) => idx));

      if (fromIndex == null || toIndex == null || fromIndex === toIndex) {
        return;
      }

      rowReorder?.onReorder(fromIndex, toIndex);
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [data.length, draggingIndex, isRowReorderDisabled, isRowReorderEnabled, rowReorder]);

  const draggingDataIndex = draggingIndex != null ? draggedDataIndexRef.current : null;
  const draggingRow = draggingDataIndex != null ? data[draggingDataIndex] : null;
  const placeholderIndex = draggingIndex != null ? dragCurrentIndexRef.current : null;
  const placeholderHeight = Math.max(44, dragRowRectRef.current.height || 0);
  const displayOrder = useMemo(() => {
    const baseOrder =
      resolvedOrder ?? Array.from({ length: data.length }, (_, index) => index);
    return buildDisplayOrder(baseOrder, draggingDataIndex, placeholderIndex);
  }, [data.length, draggingDataIndex, placeholderIndex, resolvedOrder]);

  if (loading) {
    return (
      <div className={TABLE_SHELL_CLASS_NAME} aria-busy="true">
        <span className="sr-only">
          {t('shared.table.loadingTitle')}. {t('shared.table.loadingDescription')}
        </span>
        <table className={tableClassName} aria-hidden="true">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={[HEAD_CELL_BASE_CLASS_NAME, ALIGN_CLASS_NAMES[column.align ?? 'left']].join(' ')}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
              <tr key={rowIndex} className="data-table__row data-table__row--skeleton">
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className={BODY_CELL_BASE_CLASS_NAME}>
                    {columnIndex === 0 ? (
                      <div className="flex items-center gap-3">
                        <span className="app-skeleton h-9 w-9 shrink-0 rounded-full" />
                        <span className="grid flex-1 gap-1.5">
                          <span className="app-skeleton h-2.5 w-[70%] rounded-pill" />
                          <span className="app-skeleton h-2 w-[45%] rounded-pill" />
                        </span>
                      </div>
                    ) : (
                      <span
                        className={[
                          'app-skeleton block h-2.5 rounded-pill',
                          SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length],
                          column.align === 'right' ? 'ml-auto' : column.align === 'center' ? 'mx-auto' : '',
                        ].join(' ')}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={TABLE_SHELL_CLASS_NAME}>
        <div className="table-empty grid min-h-[260px] place-items-center px-6 py-10 text-center">
          <div className="grid max-w-[46ch] justify-items-center gap-3">
            <div className="table-empty__icon relative grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-text-accent">
              <span className="absolute inset-[-10px] rounded-full border border-dashed border-primary/25" aria-hidden="true" />
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-sun shadow-[0_0_12px_rgb(var(--color-sun)/0.8)]" aria-hidden="true" />
              <AppIcon name="search" className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="m-0 mt-2 text-base font-semibold text-text-primary">{resolvedEmptyTitle}</h3>
            <p className="m-0 text-sm leading-[1.55] text-text-secondary">{resolvedEmptyDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={TABLE_SHELL_CLASS_NAME}>
      {dragPointer && draggingRow && isRowReorderEnabled ? (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[200]"
          style={{
            transform: `translate(${dragPointer.x - dragOffsetRef.current.x}px, ${dragPointer.y - dragOffsetRef.current.y}px)`,
            width: `${dragRowRectRef.current.width}px`,
          }}
          aria-hidden="true"
        >
          <table
            className={tableClassName}
            style={{
              minWidth: 0,
              width: '100%',
              borderSpacing: 0,
              tableLayout: 'fixed',
            }}
          >
            <tbody>
              <tr
                className={[ROW_CLASS_NAME, 'data-table__row--dragging'].join(' ')}
                style={{ height: `${dragRowRectRef.current.height}px` }}
              >
                <td
                  className={[BODY_CELL_BASE_CLASS_NAME, 'w-10 px-3'].join(' ')}
                  style={{ height: `${dragRowRectRef.current.height}px` }}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted">
                    <span className="grid grid-cols-2 grid-rows-3 gap-[2px]" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, dotIndex) => (
                        <span key={dotIndex} className="h-1 w-1 rounded-full bg-current opacity-70" />
                      ))}
                    </span>
                  </span>
                </td>
                {columns.map((column) => (
                  <td
                    key={`drag-overlay-${column.key}`}
                    className={[
                      BODY_CELL_BASE_CLASS_NAME,
                      `data-table__cell--${column.align ?? 'left'}`,
                      ALIGN_CLASS_NAMES[column.align ?? 'left'],
                    ].join(' ')}
                    style={{ height: `${dragRowRectRef.current.height}px` }}
                  >
                    {getCellContent(draggingRow, column)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      <table ref={tableRef} className={tableClassName}>
        <thead>
          <tr>
            {isRowReorderEnabled ? (
              <th
                className={[
                  HEAD_CELL_BASE_CLASS_NAME,
                  'w-10 px-3',
                  ALIGN_CLASS_NAMES.left,
                ].join(' ')}
                aria-label={reorderAriaLabel}
              />
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                className={[
                  HEAD_CELL_BASE_CLASS_NAME,
                  `data-table__cell--${column.align ?? 'left'}`,
                  ALIGN_CLASS_NAMES[column.align ?? 'left'],
                ].join(' ')}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayOrder.map((dataIndex, renderIndex) => {
            const isPlaceholderRow = dataIndex === -1;
            const row = isPlaceholderRow ? null : data[dataIndex];
            const resolvedRowKey = row ? getRowKey(row, dataIndex, rowKey) : '__reorder_placeholder__';
            const isSelected = row ? selectedRowKey === resolvedRowKey : false;

            return (
              <tr
                key={resolvedRowKey}
                data-reorder-index={renderIndex}
                className={[
                  onRowClick && !isPlaceholderRow ? CLICKABLE_ROW_CLASS_NAME : ROW_CLASS_NAME,
                  row && getRowClassName ? getRowClassName(row, dataIndex) : '',
                  isSelected ? SELECTED_ROW_CLASS_NAME : '',
                  dragOverIndex === renderIndex ? 'shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.35)]' : '',
                  isPlaceholderRow
                    ? 'bg-primary/5 shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.25)]'
                    : '',
                ].join(' ')}
                style={{ '--row-i': Math.min(renderIndex, 14) } as CSSProperties}
                onClick={onRowClick && row ? () => onRowClick(row) : undefined}
                aria-selected={isSelected}
              >
                {isPlaceholderRow ? (
                  <>
                    {isRowReorderEnabled ? (
                      <td
                        className={[BODY_CELL_BASE_CLASS_NAME, 'w-10 px-3'].join(' ')}
                        style={{ height: `${placeholderHeight}px` }}
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary/65">
                          <span className="grid grid-cols-2 grid-rows-3 gap-[2px]" aria-hidden="true">
                            {Array.from({ length: 6 }).map((_, dotIndex) => (
                              <span
                                key={dotIndex}
                                className="h-1 w-1 rounded-full bg-current opacity-70"
                              />
                            ))}
                          </span>
                        </span>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={`placeholder-${column.key}`}
                        className={[
                          BODY_CELL_BASE_CLASS_NAME,
                          'text-text-muted',
                          `data-table__cell--${column.align ?? 'left'}`,
                          ALIGN_CLASS_NAMES[column.align ?? 'left'],
                        ].join(' ')}
                        style={{ height: `${placeholderHeight}px` }}
                      >
                        <div className="h-2 w-[48%] rounded-full bg-primary/10" />
                      </td>
                    ))}
                  </>
                ) : (
                  <>
                    {isRowReorderEnabled ? (
                      <td className={[BODY_CELL_BASE_CLASS_NAME, 'w-10 px-3'].join(' ')}>
                        <button
                        type="button"
                        className={[
                          'inline-flex h-8 w-8 select-none items-center justify-center rounded-md text-text-muted transition duration-fast',
                          'hover:bg-surface-card hover:text-text-secondary',
                          isRowReorderDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing',
                        ].join(' ')}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => {
                          if (isRowReorderDisabled || !isRowReorderEnabled) {
                            return;
                          }

                          event.stopPropagation();
                          if (event.button !== 0) {
                            return;
                          }

                        const rowElement = (event.currentTarget as HTMLElement).closest('tr');
                        if (!rowElement) {
                          return;
                        }

                        const rect = rowElement.getBoundingClientRect();
                        const tableRect = tableRef.current?.getBoundingClientRect() ?? rect;
                        dragOffsetRef.current = {
                          // Keep the dragged row horizontally aligned to the table width.
                          x: Math.max(0, Math.min(tableRect.width, event.clientX - tableRect.left)),
                          y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
                        };
                        dragRowRectRef.current = {
                          width: tableRect.width,
                          height: rect.height,
                        };

                          draggedDataIndexRef.current = dataIndex;
                          dragOriginIndexRef.current = renderIndex;
                          dragCurrentIndexRef.current = renderIndex;
                          setDraggingIndex(renderIndex);
                          setDragOverIndex(renderIndex);
                          setDragPointer({ x: event.clientX, y: event.clientY });

                          setRenderOrder((currentOrder) => {
                            if (currentOrder && currentOrder.length === data.length) {
                              return currentOrder;
                            }
                            return Array.from({ length: data.length }, (_, idx) => idx);
                          });

                          try {
                            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                          } catch {
                            // ignored
                          }
                        }}
                        aria-label={reorderAriaLabel}
                        title={reorderAriaLabel}
                        >
                        <span className="grid grid-cols-2 grid-rows-3 gap-[2px]" aria-hidden="true">
                          {Array.from({ length: 6 }).map((_, dotIndex) => (
                            <span
                              key={dotIndex}
                              className="h-1 w-1 rounded-full bg-current opacity-70"
                            />
                          ))}
                        </span>
                      </button>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={[
                          BODY_CELL_BASE_CLASS_NAME,
                          `data-table__cell--${column.align ?? 'left'}`,
                          ALIGN_CLASS_NAMES[column.align ?? 'left'],
                        ].join(' ')}
                      >
                        {getCellContent(row as T, column)}
                      </td>
                    ))}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
