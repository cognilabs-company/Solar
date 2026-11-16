import { useId } from 'react';

interface SparklineProps {
  values: number[];
  color: string;
  className?: string;
}

const WIDTH = 120;
const HEIGHT = 36;
const PAD = 3;

/** Tiny dependency-free trend line with a soft gradient fill. */
function Sparkline({ values, color, className }: SparklineProps) {
  const gradientId = useId();

  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = (WIDTH - PAD * 2) / (values.length - 1);
  const points = values.map((value, index) => [
    PAD + index * step,
    HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2),
  ]);
  const line = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${points[points.length - 1]![0]!.toFixed(1)} ${HEIGHT} L${PAD} ${HEIGHT} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={400}
        className="dash-sparkline-path"
      />
    </svg>
  );
}

export default Sparkline;
