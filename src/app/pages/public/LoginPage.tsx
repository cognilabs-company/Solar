import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  canAccessRouteForUser,
  resolveDefaultLandingPathForUser,
  useAuth,
} from '../../../auth';
import { getRouteByPathname } from '../../../config/routes';
import EnergyPlanet, {
  type PlanetStats,
  type PlanetStatus,
} from '../../../components/shared/auth/EnergyPlanet';

const EMPTY_STATS: PlanetStats = {
  energy: 0,
  litCities: 0,
  totalCities: 0,
  dayFarms: 0,
  totalFarms: 0,
};

const RING_RADIUS = 22;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

interface LoginLocationState {
  from?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractLoginErrorMessage(error: unknown, fallback: string): string {
  const topLevel = asRecord(error);
  const response = asRecord(topLevel?.response);
  const data = response?.data;
  const dataRecord = asRecord(data);

  const candidates: Array<unknown> = [
    dataRecord?.detail,
    dataRecord?.message,
    dataRecord?.error,
    Array.isArray(dataRecord?.non_field_errors)
      ? (dataRecord?.non_field_errors as unknown[])[0]
      : null,
    Array.isArray(dataRecord?.errors)
      ? (dataRecord?.errors as unknown[])[0]
      : null,
    Array.isArray(data)
      ? (data as unknown[])[0]
      : null,
    topLevel?.message,
  ];

  for (const candidate of candidates) {
    const message = readMessage(candidate);
    if (message) {
      return message;
    }
  }

  return fallback;
}

function isValidUsername(value: string): boolean {
  return value.trim().length > 0;
}

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [sceneStatus, setSceneStatus] = useState<PlanetStatus>('idle');
  const [shakeKey, setShakeKey] = useState(0);
  const [stats, setStats] = useState<PlanetStats>(EMPTY_STATS);
  const [isTouch] = useState(isTouchDevice);

  useEffect(() => {
    if (sceneStatus !== 'error') {
      return undefined;
    }
    const timer = window.setTimeout(() => setSceneStatus('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [sceneStatus]);

  function pulseEnergy() {
    setPulseKey((value) => value + 1);
  }

  const redirectFromPath = useMemo(() => {
    const state = location.state as LoginLocationState | null;
    return state?.from;
  }, [location.state]);

  const trimmedUsername = username.trim();
  const usernameHasError = username.length > 0 && !isValidUsername(trimmedUsername);
  const passwordHasError = password.length > 0 && password.length < 8;
  const isFormValid =
    trimmedUsername.length > 0 &&
    password.length >= 8 &&
    isValidUsername(trimmedUsername);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSceneStatus('submitting');

    try {
      const user = await login({ username: trimmedUsername, password });

      const targetRoute = redirectFromPath
        ? getRouteByPathname(redirectFromPath)
        : undefined;
      const nextPath =
        targetRoute && canAccessRouteForUser(user, targetRoute.id)
          ? targetRoute.path
          : resolveDefaultLandingPathForUser(user);

      setSceneStatus('success');
      // Give auth state time to propagate before navigating
      await new Promise((resolve) => setTimeout(resolve, 100));

      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        extractLoginErrorMessage(error, t('auth.login.invalidCredentials')),
      );
      setSceneStatus('error');
      setShakeKey((value) => value + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  const chargePercent = Math.round(stats.energy * 100);
  const inputShellClassName =
    'login-input relative flex h-[52px] items-center rounded-lg border transition duration-fast';

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      <EnergyPlanet
        className="fixed inset-0"
        status={sceneStatus}
        pulseKey={pulseKey}
        onStats={setStats}
      />

      <div className="pointer-events-none relative z-10 mx-auto flex min-h-screen w-full max-w-[1360px] flex-col px-5 pb-8 pt-5 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10 lg:px-14 lg:py-10">
        <section className="flex flex-col">
          <div className="login-rise inline-flex w-fit items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] py-2 pl-2 pr-4 backdrop-blur-md">
            <span className="login-logo inline-flex h-9 w-9 items-center justify-center rounded-lg" aria-hidden="true">
              <svg viewBox="0 0 32 32" className="login-sun-mark h-5 w-5">
                <circle cx="16" cy="16" r="6" fill="#0b2a1a" />
                {Array.from({ length: 8 }, (_, index) => (
                  <rect
                    key={index}
                    x="15"
                    y="2.5"
                    width="2"
                    height="5"
                    rx="1"
                    fill="#0b2a1a"
                    transform={`rotate(${index * 45} 16 16)`}
                  />
                ))}
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-extrabold tracking-[-0.01em]">
                Solar<span className="text-sun">.</span> CRM
              </span>
              <span className="block text-[11px] text-white/55">Green NRG Energy Solutions</span>
            </span>
          </div>

          <div className="mt-6 max-w-[560px] lg:mt-[7vh]">
            <p className="login-rise flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.24em] text-[#9be7c4]" style={{ ['--rise' as string]: 1 }}>
              <span className="h-px w-7 bg-[#9be7c4]/70" />
              {t('auth.login.scene.kicker')}
            </p>
            <h2
              className="login-rise mt-3 font-display text-[2rem] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-[2.6rem] lg:text-[3.6rem]"
              style={{ ['--rise' as string]: 2 }}
            >
              {t('auth.login.scene.titleStart')}{' '}
              <span className="login-title-accent">{t('auth.login.scene.titleAccent')}</span>
            </h2>
            <p
              className="login-rise mt-3 hidden max-w-[400px] text-[0.98rem] leading-relaxed text-white/70 sm:block"
              style={{ ['--rise' as string]: 3 }}
            >
              {t('auth.login.scene.subtitle')}
            </p>
            <p
              className="login-rise mt-4 hidden items-center gap-2.5 text-[13px] text-white/60 sm:flex"
              style={{ ['--rise' as string]: 4 }}
            >
              <span className="login-hint-dot" />
              {isTouch ? t('auth.login.scene.hintTouch') : t('auth.login.scene.hint')}
            </p>
          </div>

          <div className="h-[38vh] min-h-[220px] lg:hidden" />

          <dl className="login-rise mt-auto hidden w-fit flex-col gap-2.5 lg:flex" style={{ ['--rise' as string]: 5 }}>
            <div className="login-stat">
              <dt>{t('auth.login.scene.farms')}</dt>
              <dd>
                <span className="text-sun">{stats.dayFarms}</span>
                <span className="text-white/40"> / {stats.totalFarms}</span>
              </dd>
            </div>
            <div className="login-stat">
              <dt>{t('auth.login.scene.cities')}</dt>
              <dd>
                <span className="text-[#ffd27a]">{stats.litCities}</span>
                <span className="text-white/40"> / {stats.totalCities}</span>
              </dd>
            </div>
            <div className="login-stat">
              <dt>{t('auth.login.scene.grid')}</dt>
              <dd className="text-[#9be7c4]">{chargePercent}%</dd>
            </div>
          </dl>
        </section>

        <section className="pointer-events-auto relative w-full max-w-[440px] self-center justify-self-end max-lg:mx-auto">
          <article
            key={shakeKey}
            className={`login-card login-card-enter relative overflow-hidden rounded-2xl p-6 sm:p-8 ${shakeKey > 0 ? 'login-shake' : ''} ${sceneStatus === 'success' ? 'login-card--success' : ''}`}
          >
            <span className="login-card__grid" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-[-0.03em]">
                  {t('auth.login.cardTitle')}
                </h1>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-white/60">
                  {t('auth.login.cardHint')}
                </p>
              </div>
              <div
                className="relative h-[58px] w-[58px] shrink-0"
                title={t('auth.login.scene.grid')}
              >
                <svg viewBox="0 0 52 52" className={`h-full w-full -rotate-90 ${isSubmitting ? 'login-ring-spin' : ''}`} aria-hidden="true">
                  <circle cx="26" cy="26" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3.5" />
                  <circle
                    cx="26"
                    cy="26"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="url(#login-ring-gradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - stats.energy)}
                    style={{ transition: 'stroke-dashoffset 300ms linear' }}
                  />
                  <defs>
                    <linearGradient id="login-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#57d17a" />
                      <stop offset="100%" stopColor="#ffd34d" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[13px] font-extrabold">{chargePercent}%</span>
                  <span className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[0.12em] text-white/45">
                    {t('auth.login.scene.gridShort')}
                  </span>
                </span>
              </div>
            </div>

            <form className="relative mt-7 grid gap-4" onSubmit={handleSubmit} noValidate>
              <label className="grid gap-2">
                <span className="text-[12px] font-semibold text-white/70">
                  {t('auth.login.usernameLabel')}
                </span>
                <span className={`${inputShellClassName} ${usernameHasError ? 'login-input--error' : ''}`}>
                  <FiUser className="ml-4 h-[18px] w-[18px] shrink-0 text-[#9be7c4]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      pulseEnergy();
                    }}
                    autoComplete="username"
                    required
                    aria-invalid={usernameHasError}
                    aria-describedby={usernameHasError ? 'login-username-error' : undefined}
                    placeholder={t('auth.login.usernamePlaceholder')}
                    className="h-full w-full rounded-lg border-0 bg-transparent px-3.5 text-[15px] font-medium text-white placeholder:text-[14px] placeholder:text-white/30 focus:outline-none"
                    style={{ caretColor: '#ffd34d' }}
                  />
                </span>
                {usernameHasError ? (
                  <span id="login-username-error" className="text-xs font-medium text-[#ff8a80]">
                    {t('auth.login.usernameError')}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-[12px] font-semibold text-white/70">
                  {t('auth.login.passwordLabel')}
                </span>
                <span className={`${inputShellClassName} ${passwordHasError ? 'login-input--error' : ''}`}>
                  <FiLock className="ml-4 h-[18px] w-[18px] shrink-0 text-[#9be7c4]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      pulseEnergy();
                    }}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    aria-invalid={passwordHasError}
                    aria-describedby={passwordHasError ? 'login-password-error' : undefined}
                    className="h-full w-full rounded-lg border-0 bg-transparent px-3.5 pr-12 text-[15px] font-medium text-white placeholder:text-[14px] placeholder:text-white/30 focus:outline-none"
                    style={{ caretColor: '#ffd34d' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition duration-fast hover:bg-white/10 hover:text-white"
                    aria-label={
                      showPassword
                        ? t('auth.login.hidePassword')
                        : t('auth.login.showPassword')
                    }
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-4 w-4" />
                    ) : (
                      <FiEye className="h-4 w-4" />
                    )}
                  </button>
                </span>
                {passwordHasError ? (
                  <span id="login-password-error" className="text-xs font-medium text-[#ff8a80]">
                    {t('auth.login.passwordError')}
                  </span>
                ) : null}
              </label>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl border border-[#ff6b5e]/30 bg-[#ff6b5e]/12 px-3 py-2 text-sm font-medium text-[#ffb4ab]"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="login-submit group relative mt-2 inline-flex h-[54px] items-center justify-center gap-2 overflow-hidden rounded-lg px-4 text-[1.02rem] font-bold transition duration-fast hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed"
              >
                <span className="login-submit__sheen" aria-hidden="true" />
                {isSubmitting ? t('auth.login.signingIn') : t('auth.login.signIn')}
                <FiArrowRight className="h-4 w-4 transition-transform duration-base group-hover:translate-x-0.5" />
              </button>
            </form>
          </article>

          <footer className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
            <p>{t('auth.login.footerRights')}</p>
            <p className="mt-1">
              {t('auth.login.footerPowered')}{' '}
              <a
                href="https://www.cognilabs.org"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[#9be7c4] hover:text-white"
              >
                Cognilabs
              </a>
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
