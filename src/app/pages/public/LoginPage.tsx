import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  canAccessRouteForUser,
  resolveDefaultLandingPathForUser,
  useAuth,
} from '../../../auth';
import { getRouteByPathname } from '../../../config/routes';
import SolarTrackerScene, {
  type SolarSceneStatus,
} from '../../../components/shared/auth/SolarTrackerScene';

const WIDE_QUERY = '(min-width: 1024px)';

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isWide;
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
  const [energyPulse, setEnergyPulse] = useState(0);
  const [sceneStatus, setSceneStatus] = useState<SolarSceneStatus>('idle');
  const [shakeKey, setShakeKey] = useState(0);
  const powerBarRef = useRef<HTMLSpanElement>(null);
  const isWide = useIsWide();

  useEffect(() => {
    if (sceneStatus !== 'error') {
      return undefined;
    }
    const timer = window.setTimeout(() => setSceneStatus('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [sceneStatus]);

  function pulseEnergy() {
    setEnergyPulse((value) => value + 1);
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

    try {
      const user = await login({ username: trimmedUsername, password });
      
      const targetRoute = redirectFromPath
        ? getRouteByPathname(redirectFromPath)
        : undefined;
      const nextPath =
        targetRoute && canAccessRouteForUser(user, targetRoute.id)
          ? targetRoute.path
          : resolveDefaultLandingPathForUser(user);
      
      // Give auth state time to propagate before navigating
      await new Promise(resolve => setTimeout(resolve, 100));
      
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

  return (
    <main className="relative min-h-screen bg-[#f4f8f1] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(460px,1fr)]">
      <div className="relative lg:sticky lg:top-0 lg:h-screen">
      <SolarTrackerScene
        className="h-[240px] sm:h-[300px] lg:h-screen"
        energyPulse={energyPulse}
        status={sceneStatus}
        powerBarRef={powerBarRef}
        showHud={isWide}
      />

      {isWide ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 p-12 text-white">
          <div className="max-w-[480px] [text-shadow:0_2px_18px_rgba(8,24,48,0.45)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/85">
              {t('auth.login.scene.kicker')}
            </p>
            <h2 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.03em]">
              {t('auth.login.scene.title')}
            </h2>
            <p className="mt-3 max-w-[400px] text-[0.98rem] leading-relaxed text-white/90">
              {t('auth.login.scene.subtitle')}
            </p>
          </div>
        </div>
      ) : null}
      </div>

      <div
        className="relative flex items-start justify-center px-4 pb-10 sm:px-6 lg:min-h-screen lg:items-center lg:py-12"
        style={{
          background:
            'radial-gradient(90% 60% at 100% 0%, rgba(255, 211, 77, 0.22) 0%, transparent 60%), radial-gradient(80% 60% at 0% 100%, rgba(34, 139, 34, 0.14) 0%, transparent 65%), #f4f8f1',
        }}
      >
        <section className="relative z-10 -mt-16 w-full sm:-mt-20 lg:mt-0" style={{ maxWidth: '440px' }}>
          <article
            key={shakeKey}
            className={`login-card-enter relative overflow-hidden rounded-[26px] p-6 sm:p-8 ${shakeKey > 0 ? 'login-shake' : ''}`}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.86)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow:
                '0 40px 80px -44px rgba(21, 80, 21, 0.55), 0 18px 32px -24px rgba(15, 23, 42, 0.3), inset 0 1px 0 rgba(255,255,255,0.9)',
              border: '1px solid rgba(255, 255, 255, 0.7)',
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-[4px] overflow-hidden"
              style={{ backgroundColor: 'rgba(34, 139, 34, 0.12)' }}
              aria-hidden="true"
            >
              <span
                ref={powerBarRef}
                className="login-power-bar block h-full rounded-r-full"
                style={{
                  width: '60%',
                  backgroundImage:
                    'linear-gradient(90deg, #228b22 0%, #7ccf4f 35%, #ffd34d 50%, #7ccf4f 65%, #228b22 100%)',
                }}
              />
            </div>

            <div className="flex items-center gap-3.5">
              <span
                className="relative inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px]"
                style={{
                  background: 'linear-gradient(140deg, #ffe07a 0%, #ffb627 55%, #f08c00 100%)',
                  boxShadow: '0 14px 26px -14px rgba(240, 140, 0, 0.85), inset 0 1px 0 rgba(255,255,255,0.6)',
                }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 32 32" className="login-sun-mark h-8 w-8">
                  <circle cx="16" cy="16" r="6" fill="#ffffff" />
                  {Array.from({ length: 8 }, (_, index) => (
                    <rect
                      key={index}
                      x="15"
                      y="2.5"
                      width="2"
                      height="5"
                      rx="1"
                      fill="#ffffff"
                      transform={`rotate(${index * 45} 16 16)`}
                    />
                  ))}
                </svg>
              </span>
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: '#2d6b2d' }}
                >
                  {t('auth.login.eyebrow')}
                </p>
                <h1
                  className="mt-1 font-display text-[2rem] font-extrabold leading-none tracking-[-0.04em]"
                  style={{ color: '#14361a' }}
                >
                  Solar
                  <span style={{ color: '#f0a400' }}>.</span>
                </h1>
              </div>
            </div>
            <p className="mt-4 text-[0.98rem] leading-relaxed" style={{ color: '#5b6b62' }}>
              {t('auth.login.subtitle')}
            </p>

            <form className="mt-7 grid gap-4" onSubmit={handleSubmit} noValidate>
              <label className="grid gap-2">
                <span
                  className="text-[12px] font-semibold tracking-[0.01em]"
                  style={{ color: '#334155' }}
                >
                  {t('auth.login.usernameLabel')}
                </span>
                <span
                  className="relative flex h-[52px] items-center rounded-[14px] border transition duration-fast focus-within:ring-4"
                  style={{
                    backgroundColor: '#f8fdf8',
                    borderColor: usernameHasError ? '#ef4444' : '#c8e6c0',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                    ['--tw-ring-color' as string]: 'rgba(255, 196, 46, 0.32)',
                  }}
                >
                  <FiUser className="ml-4 h-[18px] w-[18px] shrink-0" style={{ color: '#4a8f4a' }} />
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
                    className="h-full w-full rounded-[14px] border-0 bg-transparent px-3.5 pr-3.5 text-[15px] font-medium placeholder:text-[14px] placeholder:text-slate-400 focus:outline-none"
                    style={{ color: '#0f172a', caretColor: '#155015' }}
                  />
                </span>
                {usernameHasError ? (
                  <span
                    id="login-username-error"
                    className="text-xs font-medium"
                    style={{ color: '#dc2626' }}
                  >
                    {t('auth.login.usernameError')}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span
                  className="text-[12px] font-semibold tracking-[0.01em]"
                  style={{ color: '#334155' }}
                >
                  {t('auth.login.passwordLabel')}
                </span>
                <span
                  className="relative flex h-[52px] items-center rounded-[14px] border transition duration-fast focus-within:ring-4"
                  style={{
                    backgroundColor: '#f8fdf8',
                    borderColor: passwordHasError ? '#ef4444' : '#c8e6c0',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                    ['--tw-ring-color' as string]: 'rgba(255, 196, 46, 0.32)',
                  }}
                >
                  <FiLock className="ml-4 h-[18px] w-[18px] shrink-0" style={{ color: '#4a8f4a' }} />
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
                    className="h-full w-full rounded-[14px] border-0 bg-transparent px-3.5 pr-12 text-[15px] font-medium placeholder:text-[14px] placeholder:text-slate-400 focus:outline-none"
                    style={{ color: '#0f172a', caretColor: '#155015' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg transition duration-fast hover:bg-slate-100"
                    aria-label={
                      showPassword
                        ? t('auth.login.hidePassword')
                        : t('auth.login.showPassword')
                    }
                    style={{ color: '#6b7e9f' }}
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-4 w-4" />
                    ) : (
                      <FiEye className="h-4 w-4" />
                    )}
                  </button>
                </span>
                {passwordHasError ? (
                  <span
                    id="login-password-error"
                    className="text-xs font-medium"
                    style={{ color: '#dc2626' }}
                  >
                    {t('auth.login.passwordError')}
                  </span>
                ) : null}
              </label>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ color: '#b91c1c', backgroundColor: '#fee2e2' }}
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="group relative mt-2 inline-flex h-[54px] items-center justify-center gap-2 overflow-hidden rounded-[14px] px-4 text-[1.02rem] font-semibold text-white transition duration-fast hover:-translate-y-px hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(102deg, #228b22 0%, #1e7b1e 54%, #155015 100%)',
                  boxShadow: '0 18px 34px -20px rgba(34, 139, 34, 0.78)',
                }}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100 group-disabled:hidden"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 224, 122, 0.55), transparent)',
                  }}
                  aria-hidden="true"
                />
                {isSubmitting ? t('auth.login.signingIn') : t('auth.login.signIn')}
                <FiArrowRight className="h-4 w-4 transition-transform duration-base group-hover:translate-x-0.5" />
              </button>
            </form>
          </article>

          <footer className="mt-6 text-center text-[11px] leading-relaxed" style={{ color: '#6b7280' }}>
            <p>{t('auth.login.footerRights')}</p>
            <p className="mt-1.5">
              {t('auth.login.footerPowered')}{' '}
              <a
                href="https://www.cognilabs.org"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#155015', fontWeight: 700 }}
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
