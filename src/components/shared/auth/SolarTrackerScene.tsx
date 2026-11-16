import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * "Quyosh kuzatuvchi" — decorative login scene.
 *
 * A single-axis solar tracker farm seen from a slight elevation. A full
 * day/night cycle runs in a loop: the sun travels across the sky, every
 * panel rotates to face it, the sky shifts from dawn to noon to night and
 * energy pulses run along the cables towards the login form.
 *
 * Everything is plain SVG driven by one requestAnimationFrame loop that
 * writes attributes directly (no React re-render per frame). Reduced motion
 * renders a single still frame.
 */

export type SolarSceneStatus = 'idle' | 'error';

interface SolarTrackerSceneProps {
  /** Incremented on every keystroke — briefly boosts the energy flow. */
  energyPulse?: number;
  status?: SolarSceneStatus;
  /** Optional element whose width (in %) mirrors the current power output. */
  powerBarRef?: RefObject<HTMLElement | null>;
  className?: string;
  /** Show the telemetry HUD (clock, panel angle, power). */
  showHud?: boolean;
}

const VIEW_W = 800;
const VIEW_H = 1000;
const HORIZON = 560;
const CYCLE_SECONDS = 34;
const DAY_SHARE = 0.8;
const PANEL_W = 140;
const PANEL_D = 64;
const PANEL_LIFT = 26;
const TILT_LIMIT = 55;
const STILL_PHASE = 0.3;

type Rgb = [number, number, number];

const SKY = {
  night: { top: [9, 18, 40] as Rgb, bottom: [27, 42, 74] as Rgb },
  dawn: { top: [58, 84, 140] as Rgb, bottom: [255, 176, 120] as Rgb },
  noon: { top: [56, 152, 226] as Rgb, bottom: [196, 232, 255] as Rgb },
};

const ROWS = [
  { y: 640, scale: 0.42, count: 8, offset: 0.5 },
  { y: 735, scale: 0.66, count: 6, offset: 0 },
  { y: 880, scale: 1.02, count: 4, offset: 0.5 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgb(c: Rgb) {
  return `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic pseudo-random so stars do not jump between renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Frame {
  sunX: number;
  sunY: number;
  elevation: number;
  night: number;
  tilt: number;
  power: number;
  hours: number;
}

function computeFrame(phase: number): Frame {
  if (phase < DAY_SHARE) {
    const d = phase / DAY_SHARE;
    const theta = Math.PI * (1 - d);
    const elevation = Math.sin(theta);
    const tiltRaw = ((theta * 180) / Math.PI - 90) * 0.7;
    return {
      sunX: 400 + 430 * Math.cos(theta),
      sunY: HORIZON + 30 - 330 * elevation,
      elevation,
      night: 0,
      tilt: Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, tiltRaw)),
      power: smoothstep(0.04, 0.75, elevation),
      hours: 6 + d * 12,
    };
  }

  const q = (phase - DAY_SHARE) / (1 - DAY_SHARE);
  // Trackers stow flat at night, then swing back east before sunrise.
  const stow = q < 0.5 ? lerp(-TILT_LIMIT, 0, smoothstep(0, 0.35, q)) : lerp(0, TILT_LIMIT, smoothstep(0.65, 1, q));
  return {
    sunX: -200,
    sunY: HORIZON + 200,
    elevation: 0,
    night: Math.sin(Math.PI * q),
    tilt: stow,
    power: 0,
    hours: (18 + q * 12) % 24,
  };
}

function formatClock(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m - (m % 5)).padStart(2, '0')}`;
}

function SolarTrackerScene({
  energyPulse = 0,
  status = 'idle',
  powerBarRef,
  className,
  showHud = true,
}: SolarTrackerSceneProps) {
  const { t } = useTranslation();

  const skyTopRef = useRef<SVGStopElement>(null);
  const skyBottomRef = useRef<SVGStopElement>(null);
  const sunRef = useRef<SVGGElement>(null);
  const sunCoreRef = useRef<SVGCircleElement>(null);
  const starsRef = useRef<SVGGElement>(null);
  const shadeRef = useRef<SVGRectElement>(null);
  const hazeRef = useRef<SVGRectElement>(null);
  const cloudsRef = useRef<SVGGElement>(null);
  const cablesRef = useRef<SVGGElement>(null);
  const panelRefs = useRef<Array<SVGGElement | null>>([]);
  const glintRefs = useRef<Array<SVGRectElement | null>>([]);
  const clockRef = useRef<HTMLSpanElement>(null);
  const tiltRef = useRef<HTMLSpanElement>(null);
  const powerRef = useRef<HTMLSpanElement>(null);
  const boostRef = useRef(0);
  const statusRef = useRef<SolarSceneStatus>(status);

  statusRef.current = status;

  useEffect(() => {
    if (energyPulse > 0) {
      boostRef.current = Math.min(2.4, boostRef.current + 0.7);
    }
  }, [energyPulse]);

  const panels = useMemo(() => {
    const list: Array<{ x: number; y: number; scale: number }> = [];
    for (const row of ROWS) {
      const gap = VIEW_W / row.count;
      for (let i = 0; i < row.count; i += 1) {
        list.push({ x: gap * (i + 0.5) + (row.offset - 0.25) * gap * 0.6, y: row.y, scale: row.scale });
      }
    }
    return list;
  }, []);

  const stars = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: 46 }, () => ({
      x: rand() * VIEW_W,
      y: rand() * (HORIZON - 60),
      r: 0.8 + rand() * 1.6,
      o: 0.35 + rand() * 0.65,
    }));
  }, []);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let phase = STILL_PHASE;
    let dashOffset = 0;
    let cloudShift = 0;
    let last = performance.now();
    let raf = 0;
    let lastHud = 0;

    function paint(frame: Frame, now: number) {
      const dawnToNoon = smoothstep(0.05, 0.6, frame.elevation);
      let top = mixRgb(SKY.dawn.top, SKY.noon.top, dawnToNoon);
      let bottom = mixRgb(SKY.dawn.bottom, SKY.noon.bottom, dawnToNoon);
      top = mixRgb(top, SKY.night.top, frame.night);
      bottom = mixRgb(bottom, SKY.night.bottom, frame.night);
      skyTopRef.current?.setAttribute('stop-color', rgb(top));
      skyBottomRef.current?.setAttribute('stop-color', rgb(bottom));

      sunRef.current?.setAttribute('transform', `translate(${frame.sunX.toFixed(1)} ${frame.sunY.toFixed(1)})`);
      sunCoreRef.current?.setAttribute(
        'fill',
        rgb(mixRgb([255, 168, 76], [255, 246, 200], smoothstep(0, 0.5, frame.elevation))),
      );

      starsRef.current?.setAttribute('opacity', frame.night.toFixed(3));
      shadeRef.current?.setAttribute('opacity', (frame.night * 0.55).toFixed(3));
      hazeRef.current?.setAttribute('opacity', (0.55 * (1 - dawnToNoon) * (1 - frame.night)).toFixed(3));

      const rad = (frame.tilt * Math.PI) / 180;
      const a = Math.cos(rad).toFixed(4);
      const b = (-0.5 * Math.sin(rad)).toFixed(4);
      const matrix = `matrix(${a} ${b} 0 -1 0 0)`;
      for (const el of panelRefs.current) {
        el?.setAttribute('transform', matrix);
      }
      const glint = (0.15 + 0.6 * frame.power).toFixed(3);
      for (const el of glintRefs.current) {
        el?.setAttribute('opacity', glint);
      }

      const flow = Math.min(1, frame.power + boostRef.current * 0.35);
      if (cablesRef.current) {
        cablesRef.current.setAttribute('opacity', (0.15 + 0.85 * flow).toFixed(3));
        cablesRef.current.style.setProperty('--dash-offset', dashOffset.toFixed(1));
      }
      if (cloudsRef.current) {
        cloudsRef.current.setAttribute('transform', `translate(${cloudShift.toFixed(1)} 0)`);
      }

      if (now - lastHud > 120) {
        lastHud = now;
        const power = Math.round(Math.min(100, frame.power * 100 + boostRef.current * 6));
        if (clockRef.current) clockRef.current.textContent = formatClock(frame.hours);
        if (tiltRef.current) tiltRef.current.textContent = `${Math.round(frame.tilt) > 0 ? '+' : ''}${Math.round(frame.tilt)}°`;
        if (powerRef.current) powerRef.current.textContent = `${power}%`;
        if (powerBarRef?.current) powerBarRef.current.style.width = `${Math.max(4, power)}%`;
      }
    }

    if (reduceMotion) {
      paint(computeFrame(STILL_PHASE), performance.now());
      return undefined;
    }

    function tick(now: number) {
      // Clamp dt so a backgrounded tab does not jump the cycle.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const stalled = statusRef.current === 'error';
      phase = (phase + dt / CYCLE_SECONDS) % 1;
      const frame = computeFrame(phase);
      const flow = stalled ? 0 : Math.min(1.6, frame.power + boostRef.current * 0.5);
      dashOffset -= dt * (30 + 170 * flow);
      cloudShift = (cloudShift + dt * 9) % (VIEW_W + 400);
      boostRef.current = Math.max(0, boostRef.current - dt * 1.6);

      paint(frame, now);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [powerBarRef]);

  return (
    <div
      className={`solar-scene relative overflow-hidden ${status === 'error' ? 'solar-scene--error' : ''} ${className ?? ''}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="solar-sky" x1="0" y1="0" x2="0" y2="1">
            <stop ref={skyTopRef} offset="0" stopColor="rgb(56 152 226)" />
            <stop ref={skyBottomRef} offset={HORIZON / VIEW_H} stopColor="rgb(196 232 255)" />
          </linearGradient>
          <radialGradient id="solar-sun-glow">
            <stop offset="0" stopColor="#fff4c2" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#ffd25e" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffb02e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="solar-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9f6b" stopOpacity="0" />
            <stop offset="1" stopColor="#ff9f6b" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="solar-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6fae5a" />
            <stop offset="0.45" stopColor="#3f8a3c" />
            <stop offset="1" stopColor="#1f5a2a" />
          </linearGradient>
          <pattern id="solar-cells" width="17.5" height="16" patternUnits="userSpaceOnUse" x="-70">
            <rect width="17.5" height="16" fill="#173a6e" />
            <rect x="0.9" y="0.9" width="15.7" height="14.2" rx="1" fill="#1f4f91" />
            <path d="M0.9 8 H16.6" stroke="#2c62aa" strokeWidth="0.6" />
          </pattern>
          <linearGradient id="solar-glint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.48" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.56" stopColor="#bfe3ff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#solar-sky)" />

        <g ref={starsRef} opacity="0">
          {stars.map((star, index) => (
            <circle
              key={index}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#ffffff"
              opacity={star.o}
              className="solar-scene__star"
              style={{ animationDelay: `${(index % 7) * 0.6}s` }}
            />
          ))}
        </g>

        <g ref={sunRef} transform="translate(400 260)">
          <circle r="170" fill="url(#solar-sun-glow)" />
          <circle ref={sunCoreRef} r="44" fill="#fff6c8" />
        </g>

        <g ref={cloudsRef} opacity="0.85">
          <g transform="translate(-260 170)">
            <ellipse cx="0" cy="0" rx="70" ry="22" fill="#ffffff" opacity="0.8" />
            <ellipse cx="40" cy="-14" rx="46" ry="24" fill="#ffffff" opacity="0.8" />
            <ellipse cx="-36" cy="-8" rx="34" ry="18" fill="#ffffff" opacity="0.8" />
          </g>
          <g transform="translate(240 330)">
            <ellipse cx="0" cy="0" rx="56" ry="15" fill="#ffffff" opacity="0.55" />
            <ellipse cx="26" cy="-10" rx="34" ry="16" fill="#ffffff" opacity="0.55" />
          </g>
        </g>

        <rect ref={hazeRef} y={HORIZON - 260} width={VIEW_W} height="260" fill="url(#solar-haze)" opacity="0" />

        <path
          d={`M0 ${HORIZON + 10} C 140 ${HORIZON - 50}, 260 ${HORIZON - 30}, 380 ${HORIZON - 4} S 640 ${HORIZON - 60}, 800 ${HORIZON - 10} V ${VIEW_H} H 0 Z`}
          fill="#8bbf7a"
          opacity="0.75"
        />
        <rect y={HORIZON} width={VIEW_W} height={VIEW_H - HORIZON} fill="url(#solar-ground)" />

        <g ref={cablesRef} className="solar-scene__cables" opacity="0.6">
          {ROWS.map((row) => (
            <g key={row.y}>
              <path
                d={`M0 ${row.y + 10 * row.scale} H ${VIEW_W}`}
                stroke="#1b3b22"
                strokeOpacity="0.45"
                strokeWidth={4 * row.scale}
              />
              <path
                d={`M0 ${row.y + 10 * row.scale} H ${VIEW_W}`}
                stroke="#ffd34d"
                strokeWidth={5 * row.scale}
                strokeLinecap="round"
                strokeDasharray={`${3 * row.scale} ${34 * row.scale}`}
                className="solar-scene__pulse"
              />
            </g>
          ))}
        </g>

        {panels.map((panel, index) => (
          <g key={index} transform={`translate(${panel.x.toFixed(1)} ${panel.y}) scale(${panel.scale})`}>
            <ellipse cx="0" cy="6" rx="78" ry="10" fill="#0f3317" opacity="0.28" />
            <rect x="-4" y={-PANEL_D / 2 - PANEL_LIFT} width="8" height={PANEL_D / 2 + PANEL_LIFT + 6} rx="2" fill="#5d6b74" />
            <g transform={`translate(0 ${-PANEL_LIFT})`}>
            <g
              ref={(el) => {
                panelRefs.current[index] = el;
              }}
              transform="matrix(1 0 0 -1 0 0)"
            >
              <rect
                x={-PANEL_W / 2}
                y="0"
                width={PANEL_W}
                height={PANEL_D}
                fill="url(#solar-cells)"
                stroke="#c9d4dc"
                strokeWidth="3"
                rx="2"
              />
              <rect
                ref={(el) => {
                  glintRefs.current[index] = el;
                }}
                x={-PANEL_W / 2}
                y="0"
                width={PANEL_W}
                height={PANEL_D}
                fill="url(#solar-glint)"
                opacity="0.4"
                className="solar-scene__glint"
              />
            </g>
            </g>
          </g>
        ))}

        <rect ref={shadeRef} width={VIEW_W} height={VIEW_H} fill="#07122b" opacity="0" />
      </svg>

      {showHud ? (
        <div className="solar-scene__hud absolute bottom-8 left-8 right-8 flex flex-wrap gap-3 text-white">
          <HudItem label={t('auth.login.scene.clock')} valueRef={clockRef} />
          <HudItem label={t('auth.login.scene.tilt')} valueRef={tiltRef} />
          <HudItem label={t('auth.login.scene.power')} valueRef={powerRef} accent />
        </div>
      ) : null}
    </div>
  );
}

function HudItem({
  label,
  valueRef,
  accent = false,
}: {
  label: string;
  valueRef: RefObject<HTMLSpanElement | null>;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[112px] rounded-[14px] border border-white/25 bg-black/25 px-4 py-2.5 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{label}</p>
      <span
        ref={valueRef}
        className="mt-0.5 block font-display text-[1.35rem] font-extrabold tabular-nums leading-tight"
        style={accent ? { color: '#ffd34d' } : undefined}
      >
        —
      </span>
    </div>
  );
}

export default SolarTrackerScene;
