import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routePaths } from '../../../config/routes';
import { useAuth } from '../../../auth';

function AccessDeniedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    currentUser,
    isAuthenticated,
    logout,
    resolveDefaultLandingPath,
  } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-background-default p-6">
      <section className="w-full max-w-[620px] rounded-xl border border-border-soft/60 bg-surface-card p-7 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t('auth.accessDenied.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-extrabold tracking-[-0.03em] text-text-primary">
          {t('auth.accessDenied.title')}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          {t('auth.accessDenied.description')}
        </p>

        <div className="mt-5 rounded-lg bg-surface-subtle/80 px-4 py-3 text-sm text-text-secondary">
          <p className="m-0">
            {t('auth.accessDenied.currentAccount')}{' '}
            <span className="font-semibold text-text-primary">
              {currentUser?.fullName ?? t('auth.accessDenied.notSignedIn')}
            </span>
          </p>
          {currentUser ? (
            <p className="mt-1">
              {t('auth.accessDenied.role')}{' '}
              <span className="font-semibold text-text-primary">{currentUser.role}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => navigate(resolveDefaultLandingPath(), { replace: true })}
                className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent"
              >
                {t('auth.accessDenied.goAllowed')}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate(routePaths.login, { replace: true });
                }}
                className="inline-flex min-h-10 items-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-card hover:text-text-primary"
              >
                {t('auth.accessDenied.signOut')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate(routePaths.login, { replace: true })}
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent"
            >
              {t('auth.accessDenied.goLogin')}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default AccessDeniedPage;
