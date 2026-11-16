import type { ReactNode } from 'react';
import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { FiEdit3, FiGlobe } from 'react-icons/fi';

const AVATAR_TONES = [
  'bg-primary/15 text-text-accent',
  'bg-sun/20 text-sun-strong',
  'bg-info-bg text-info',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-neutral-bg text-text-secondary',
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function getInitials(name?: string | null): string {
  const parts = String(name ?? '')
    .replace(/[@_.-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  const first = Array.from(parts[0])[0] ?? '';
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? '' : '';
  return (first + second).toUpperCase();
}

interface TableAvatarProps {
  name?: string | null;
  /** Stable seed for the colour (e.g. id) so it doesn't change when the name is edited. */
  seed?: string | number | null;
  size?: 'sm' | 'md';
}

export function TableAvatar({ name, seed, size = 'md' }: TableAvatarProps) {
  const tone = AVATAR_TONES[hashString(String(seed ?? name ?? '')) % AVATAR_TONES.length];

  return (
    <span
      className={[
        'table-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[12px]',
        tone,
      ].join(' ')}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

interface EntityCellProps {
  name: ReactNode;
  /** Used for the avatar initials when `name` is not a plain string. */
  avatarName?: string | null;
  seed?: string | number | null;
  subtitle?: ReactNode;
  meta?: ReactNode;
}

/** Avatar + name + secondary line, the main identity cell of a list row. */
export function EntityCell({ name, avatarName, seed, subtitle, meta }: EntityCellProps) {
  const initialsSource = avatarName ?? (typeof name === 'string' ? name : null);

  return (
    <div className="flex min-w-[180px] items-center gap-3 min-[640px]:min-w-[210px]">
      <TableAvatar name={initialsSource} seed={seed} />
      <div className="grid min-w-0 gap-0.5">
        <span className="block max-w-[160px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[240px]">
          {name}
        </span>
        {subtitle ? (
          <span className="block max-w-[160px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[240px]">
            {subtitle}
          </span>
        ) : null}
        {meta ? (
          <span className="block max-w-[160px] truncate text-[12px] leading-[1.45] text-text-muted min-[640px]:max-w-[240px]">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const SOURCE_STYLES: Record<string, { icon: ReactNode; className: string }> = {
  telegram: {
    icon: <FaTelegramPlane className="h-3 w-3" />,
    className: 'bg-[#229ED9] text-white',
  },
  instagram: {
    icon: <FaInstagram className="h-3 w-3" />,
    className: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white',
  },
  manual: {
    icon: <FiEdit3 className="h-3 w-3" />,
    className: 'bg-neutral-bg text-text-secondary',
  },
};

interface SourceChipProps {
  source?: string | null;
  label: ReactNode;
}

/** Channel chip with a brand-coloured icon (Telegram / Instagram / manual / other). */
export function SourceChip({ source, label }: SourceChipProps) {
  const style = SOURCE_STYLES[String(source ?? '').toLowerCase()] ?? {
    icon: <FiGlobe className="h-3 w-3" />,
    className: 'bg-info-bg text-info',
  };

  return (
    <span className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-text-primary">
      <span
        className={[
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md shadow-sm',
          style.className,
        ].join(' ')}
        aria-hidden="true"
      >
        {style.icon}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
