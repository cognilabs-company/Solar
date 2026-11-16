// @ts-nocheck

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { useAuth } from '../../../auth';
import { routePaths } from '../../../config/routes';
import notificationSound from '../../../assets/notification.mp3';
import { services } from '../../../services';
import type { AppNotification, EntityId } from '../../../types/domain';
import {
  formatNotificationMessage,
  formatNotificationTitle,
  getNotificationChannelClassName,
  getNotificationChannelLabel,
  getNotificationReadLabel,
  getNotificationUserLabel,
} from '../utils/notification-format';

const POLL_INTERVAL_MS = 12000;
const AUTO_DISMISS_MS = 8500;
const MAX_VISIBLE_TOASTS = 3;

function trimMessage(message: string, maxLength = 180): string {
  if (message.length <= maxLength) {
    return message;
  }

  return `${message.slice(0, maxLength - 3)}...`;
}

function NotificationToastCenter() {
  const { i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const navigate = useNavigate();
  const { canAccessRoute } = useAuth();
  const canViewNotifications = canAccessRoute('notifications');
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [hoveredToastId, setHoveredToastId] = useState<EntityId | null>(null);
  const hasPrimedNotificationsRef = useRef(false);
  const isSyncingRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<EntityId>>(new Set());
  const toastTimeoutsRef = useRef<Map<EntityId, number>>(new Map());
  const collapseTimeoutRef = useRef<number | null>(null);

  const handleStackMouseEnter = useCallback(() => {
    if (typeof collapseTimeoutRef.current === 'number') {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsStackHovered(true);
  }, []);

  const handleStackMouseLeave = useCallback(() => {
    if (typeof collapseTimeoutRef.current === 'number') {
      window.clearTimeout(collapseTimeoutRef.current);
    }

    // Small delay prevents accidental collapse while moving between stacked toasts.
    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsStackHovered(false);
      setHoveredToastId(null);
      collapseTimeoutRef.current = null;
    }, 120);
  }, []);

  const dismissToast = useCallback((notificationId: EntityId) => {
    const timeoutId = toastTimeoutsRef.current.get(notificationId);
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(notificationId);
    }

    setToasts((current) => current.filter((item) => item.id !== notificationId));
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio(notificationSound);
      audio.preload = 'auto';
      audio.currentTime = 0;
      audio.volume = 1;
      void audio.play();
    } catch {
      // Ignore playback failures (browser gesture policies, etc.).
    }
  }, []);

  const pushToast = useCallback(
    (notification: AppNotification) => {
      setToasts((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== notification.id);
        const next = [notification, ...withoutDuplicate];
        const dropped = next.slice(MAX_VISIBLE_TOASTS);

        for (const item of dropped) {
          const timeoutId = toastTimeoutsRef.current.get(item.id);
          if (typeof timeoutId === 'number') {
            window.clearTimeout(timeoutId);
            toastTimeoutsRef.current.delete(item.id);
          }
        }

        return next.slice(0, MAX_VISIBLE_TOASTS);
      });

      const existingTimeout = toastTimeoutsRef.current.get(notification.id);
      if (typeof existingTimeout === 'number') {
        window.clearTimeout(existingTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        dismissToast(notification.id);
      }, AUTO_DISMISS_MS);
      toastTimeoutsRef.current.set(notification.id, timeoutId);
      playNotificationSound();
    },
    [dismissToast, playNotificationSound],
  );

  const syncNotifications = useCallback(async () => {
    if (!canViewNotifications || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const result = await services.notifications.listNotifications({
        page: 1,
        pageSize: 20,
        ordering: '-created_at',
      });

      const latest = result.items;
      if (!hasPrimedNotificationsRef.current) {
        latest.forEach((item) => {
          seenNotificationIdsRef.current.add(item.id);
        });
        hasPrimedNotificationsRef.current = true;
        return;
      }

      const freshNotifications = latest.filter(
        (item) => !seenNotificationIdsRef.current.has(item.id),
      );

      if (!freshNotifications.length) {
        return;
      }

      freshNotifications.forEach((item) => {
        seenNotificationIdsRef.current.add(item.id);
      });

      freshNotifications
        .slice()
        .sort(
          (left, right) =>
            new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        )
        .forEach((item) => {
          pushToast(item);
        });

      window.dispatchEvent(new CustomEvent('notifications:changed'));
    } catch {
      // Do not show global error toast for background notification polling.
    } finally {
      isSyncingRef.current = false;
    }
  }, [canViewNotifications, pushToast]);

  useEffect(() => {
    if (!canViewNotifications) {
      setToasts([]);
      hasPrimedNotificationsRef.current = false;
      seenNotificationIdsRef.current.clear();

      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
      return;
    }

    void syncNotifications();

    const pollTimer = window.setInterval(() => {
      void syncNotifications();
    }, POLL_INTERVAL_MS);

    function handleWindowFocus() {
      void syncNotifications();
    }

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [canViewNotifications, syncNotifications]);

  useEffect(
    () => () => {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      toastTimeoutsRef.current.clear();
      if (typeof collapseTimeoutRef.current === 'number') {
        window.clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = null;
      }
    },
    [],
  );

  if (!toasts.length) {
    return null;
  }

  const visibleToasts = isStackHovered ? toasts : toasts.slice(0, MAX_VISIBLE_TOASTS);
  const collapsedStackHeight = 138;
  const hoveredToast =
    isStackHovered && hoveredToastId
      ? toasts.find((notification) => notification.id === hoveredToastId) ?? null
      : null;
  const hoveredToastUserLabel = hoveredToast
    ? getNotificationUserLabel(hoveredToast.user, hoveredToast.metadata, i18n.language)
    : null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[65] w-[min(96vw,460px)] min-[640px]:right-5 min-[640px]:top-5"
      aria-live="polite"
      aria-atomic="false"
    >
      <div
        className={isStackHovered ? 'pointer-events-auto grid gap-2.5' : 'pointer-events-auto relative'}
        style={isStackHovered ? undefined : { height: `${collapsedStackHeight}px` }}
        onMouseEnter={handleStackMouseEnter}
        onMouseLeave={handleStackMouseLeave}
      >
        {visibleToasts.map((notification, index) => {
          const isCollapsed = !isStackHovered;
          const isFrontToast = index === 0;

          const collapsedStyle = isCollapsed
            ? {
                top: `${index * 12}px`,
                transform: `scale(${1 - index * 0.04})`,
                opacity: Math.max(0.34, 1 - index * 0.18),
                zIndex: 40 - index,
              }
            : undefined;

          return (
            <article
              key={notification.id}
              className={[
                'cursor-pointer rounded-xl bg-surface-card p-3.5 shadow-md ring-1 ring-border-soft/60 backdrop-blur-shell transition duration-fast hover:ring-primary/35',
                isCollapsed ? 'absolute left-0 w-full' : 'relative w-full',
                isCollapsed && !isFrontToast ? 'pointer-events-none' : 'pointer-events-auto',
              ].join(' ')}
              style={collapsedStyle}
              onMouseEnter={() => setHoveredToastId(notification.id)}
              onMouseLeave={() => {
                setHoveredToastId((current) =>
                  current === notification.id ? null : current,
                );
              }}
              onClick={() => {
                dismissToast(notification.id);
                navigate(routePaths.notifications, {
                  state: { notificationId: notification.id },
                });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  dismissToast(notification.id);
                  navigate(routePaths.notifications, {
                    state: { notificationId: notification.id },
                  });
                }
              }}
              role="button"
              tabIndex={isCollapsed && !isFrontToast ? -1 : 0}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    {isRu ? 'Уведомление' : 'Bildirishnoma'}
                  </p>
                  <h3 className="mt-1 line-clamp-2 font-display text-[1.15rem] font-extrabold leading-[1.12] tracking-[-0.025em] text-text-primary">
                    {formatNotificationTitle(notification.title, i18n.language)}
                  </h3>
                </div>

                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onClick={(event) => {
                    event.stopPropagation();
                    dismissToast(notification.id);
                  }}
                  aria-label={isRu ? 'Закрыть уведомление' : 'Bildirishnoma toastini yopish'}
                >
                  <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {hoveredToast ? (
        <article className="pointer-events-none mt-2.5 rounded-xl bg-surface-card p-3.5 shadow-md ring-1 ring-border-soft/60 backdrop-blur-shell">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex min-h-7 items-center rounded-pill px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                getNotificationChannelClassName(hoveredToast.channel),
              ].join(' ')}
            >
              {getNotificationChannelLabel(hoveredToast.channel, i18n.language)}
            </span>
            <StatusBadge
              status={hoveredToast.is_read ? 'read' : 'unread'}
              label={getNotificationReadLabel(hoveredToast.is_read, i18n.language)}
            />
          </div>

          <p className="m-0 mt-3 text-sm leading-[1.45] text-text-secondary">
            {trimMessage(formatNotificationMessage(hoveredToast.message, i18n.language))}
          </p>

          <div className="mt-3 rounded-lg bg-surface-subtle/85 px-3 py-2.5">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {isRu ? 'Пользователь' : 'Foydalanuvchi'}
            </p>
            <p className="m-0 mt-1 text-sm font-semibold text-text-primary">
              {hoveredToastUserLabel}
            </p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

export default NotificationToastCenter;

