import * as React from 'react';
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('Chart components must be used inside ChartContainer.');
  }

  return context;
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: React.ReactNode;
}

function ChartContainer({
  config,
  children,
  className,
  style,
  ...props
}: ChartContainerProps) {
  const chartStyle = Object.entries(config).reduce<
    React.CSSProperties & Record<string, string>
  >(
    (accumulator, [key, value]) => {
      if (value.color) {
        accumulator[`--color-${key}`] = value.color;
      }

      return accumulator;
    },
    {},
  );

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={['min-w-0 overflow-hidden', className].filter(Boolean).join(' ')}
        style={{ ...chartStyle, ...style }}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type ChartTooltipProps = React.ComponentProps<typeof RechartsTooltip>;

function ChartTooltip({ wrapperStyle, ...props }: ChartTooltipProps) {
  return (
    <RechartsTooltip
      wrapperStyle={{ zIndex: 60, ...wrapperStyle }}
      {...props}
    />
  );
}

interface ChartTooltipEntry {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  hideLabel?: boolean;
  labelFormatter?: (value: string | number) => React.ReactNode;
  formatter?: (value: number | undefined, name: string) => React.ReactNode;
}

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  labelFormatter,
  formatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-[180px] rounded-lg border border-border-soft bg-surface-card px-3 py-2.5 backdrop-blur-sm">
      {!hideLabel ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          {labelFormatter ? labelFormatter(label ?? '') : label}
        </p>
      ) : null}

      <div className="grid gap-1.5">
        {payload.map((item) => {
          const itemConfig =
            config[item.dataKey?.toString() ?? item.name ?? ''] ?? undefined;

          return (
            <div
              key={item.dataKey?.toString() ?? item.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 text-text-secondary">
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? itemConfig?.color }}
                />
                <span>{itemConfig?.label ?? item.name}</span>
              </div>
              <span className="font-semibold text-text-primary">
                {formatter && typeof item.value === 'number'
                  ? formatter(item.value, item.name ?? '')
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useChart,
};
export type { ChartConfig };
