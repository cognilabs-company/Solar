import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRouteByPathname } from '../config/routes';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import NotificationToastCenter from '../features/notifications/components/NotificationToastCenter';

function AppShell() {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches) {
      return;
    }

    setIsSidebarOpen(false);
  }, [location.pathname]);

  const currentRoute = useMemo(
    () => getRouteByPathname(location.pathname),
    [location.pathname],
  );
  const isChatRoute = currentRoute?.id === 'chat';
  const showTopbarRouteMeta =
    currentRoute?.id === 'chat' || currentRoute?.id === 'dashboard';

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background-default">
      <div
        className={[
          'fixed inset-0 z-40 bg-background-overlay transition-opacity duration-base min-[960px]:hidden',
          isSidebarOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden={!isSidebarOpen}
      />

      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex h-dvh min-w-0 w-full flex-1 flex-col overflow-hidden bg-background-default">
        <AppTopbar
          title={
            currentRoute
              ? t(`routes.${currentRoute.id}.title`, { defaultValue: currentRoute.title })
              : t('common.appName')
          }
          subtitle={
            currentRoute
              ? t(`routes.${currentRoute.id}.description`, {
                  defaultValue: currentRoute.description,
                })
              : ''
          }
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          onRefreshCurrentPage={() => setRefreshCounter((current) => current + 1)}
          showRouteMeta={showTopbarRouteMeta}
        />

        <main
          className={[
            'flex-1 overscroll-contain',
            isChatRoute
              ? 'overflow-hidden min-[1024px]:overflow-y-auto'
              : 'overflow-y-auto',
          ].join(' ')}
        >
          <div
            className={[
              isChatRoute
                ? 'h-full px-0 py-0 min-[960px]:px-7 min-[960px]:pb-8 min-[960px]:pt-4'
                : 'px-3 pb-5 pt-3 min-[640px]:px-4 min-[640px]:pb-6 min-[640px]:pt-4 min-[960px]:px-7 min-[960px]:pb-8 min-[960px]:pt-4',
            ].join(' ')}
          >
          <div
            className={['mx-auto w-full max-w-page min-w-0', isChatRoute ? 'h-full' : ''].join(' ')}
          >
            <div
              key={`${location.pathname}:${refreshCounter}`}
              className={['app-page-enter', isChatRoute ? 'h-full' : ''].join(' ')}
            >
              <Outlet />
            </div>
          </div>
          </div>
        </main>
      </div>

      <NotificationToastCenter />
    </div>
  );
}

export default AppShell;
