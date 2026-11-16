import { useEffect, useRef, useState } from 'react';
import type { PlanetScene, PlanetStats, PlanetStatus } from './energyPlanetScene';

export type { PlanetStats, PlanetStatus };

interface EnergyPlanetProps {
  status: PlanetStatus;
  /** Bumped on every keystroke — pushes a burst of energy through the arcs. */
  pulseKey: number;
  onStats?: (stats: PlanetStats) => void;
  className?: string;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Full-screen 3D "energy planet" behind the login form. three.js is loaded as
 * a separate chunk; without WebGL a static CSS planet is shown instead.
 */
function EnergyPlanet({ status, pulseKey, onStats, className }: EnergyPlanetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PlanetScene | null>(null);
  const onStatsRef = useRef(onStats);
  const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>('loading');

  onStatsRef.current = onStats;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !supportsWebGL()) {
      setMode('fallback');
      return undefined;
    }

    let cancelled = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('./energyPlanetScene')
      .then(({ createPlanetScene }) => {
        if (cancelled) return;
        sceneRef.current = createPlanetScene(canvas, {
          reducedMotion,
          onStats: (stats) => onStatsRef.current?.(stats),
        });
        setMode('ready');
      })
      .catch(() => {
        if (!cancelled) setMode('fallback');
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setStatus(status);
  }, [status, mode]);

  useEffect(() => {
    if (pulseKey > 0) sceneRef.current?.pulse();
  }, [pulseKey]);

  return (
    <div className={`login-space ${className ?? ''}`} aria-hidden="true">
      <div className="login-space__nebula" />
      {mode === 'fallback' ? <div className="login-space__fallback-planet" /> : null}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          mode === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ cursor: 'grab', touchAction: 'pan-y' }}
      />
    </div>
  );
}

export default EnergyPlanet;
