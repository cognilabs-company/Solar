import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterSelect, Switch } from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  getUserPermissionDescription,
  getUserPermissionLabel,
  getUserRoleLabel,
} from '../../../i18n/labels';
import type {
  CreateUserInput,
  ManagedUser,
  UpdateUserInput,
  UserPermission,
  UserRoleCatalogItem,
  UserRole,
} from '../../../services/contracts';

interface UserFormPanelProps {
  mode: 'create' | 'edit';
  user?: ManagedUser | null;
  permissions: UserPermission[];
  roleCatalog: UserRoleCatalogItem[];
  canManageDeveloperRole: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateUserInput | UpdateUserInput) => void;
}

interface UserFormState {
  email: string;
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  customPermissionIds: string[];
}

const inputClassName = [
  'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
  'placeholder:text-text-muted outline-none transition duration-fast',
  'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

function createInitialState(
  mode: 'create' | 'edit',
  user: ManagedUser | null | undefined,
): UserFormState {
  if (mode === 'edit' && user) {
    return {
      email: user.email,
      fullName: user.full_name,
      phone: user.phone ?? '',
      password: '',
      role: user.role,
      isActive: user.is_active ?? true,
      customPermissionIds: user.custom_permissions ?? [],
    };
  }

  return {
    email: '',
    fullName: '',
    phone: '',
    password: '',
    role: 'operator',
    isActive: true,
    customPermissionIds: [],
  };
}

function resolvePermissionGroupTitle(code: string): 'viewing' | 'managing' {
  if (code.startsWith('can_view_') || code.endsWith('.view')) {
    return 'viewing';
  }

  return 'managing';
}

function UserFormPanel({
  mode,
  user,
  permissions,
  roleCatalog,
  canManageDeveloperRole,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: UserFormPanelProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<UserFormState>(() =>
    createInitialState(mode, user),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setForm(createInitialState(mode, user));
    setFieldError(null);
  }, [mode, user]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const roleOptions = useMemo(
    () => {
      const catalogOptions = roleCatalog
        .filter((role) => canManageDeveloperRole || role.key !== 'developer')
        .map((role) => ({
          value: role.key,
          label: role.label || getUserRoleLabel(t, role.key),
        }));

      if (catalogOptions.length > 0) {
        return catalogOptions;
      }

      return (['developer', 'admin', 'operator'] as const)
        .filter((role) => canManageDeveloperRole || role !== 'developer')
        .map((role) => ({
          value: role,
          label: getUserRoleLabel(t, role),
        }));
    },
    [canManageDeveloperRole, roleCatalog, t],
  );

  const permissionIdByCode = useMemo(() => {
    const mapped = new Map<string, string>();
    permissions.forEach((permission) => {
      mapped.set(permission.code, permission.id);
    });
    return mapped;
  }, [permissions]);

  const roleDefaults = useMemo(() => {
    const mapped = new Map<UserRole, string[]>();
    roleCatalog.forEach((role) => {
      const resolvedIds = role.default_permissions
        .map((permissionCode) => permissionIdByCode.get(permissionCode) ?? permissionCode)
        .filter((permissionId) => permissionId.length > 0);
      mapped.set(role.key, resolvedIds);
    });
    return mapped;
  }, [permissionIdByCode, roleCatalog]);

  const selectedRoleDefaultCount = roleDefaults.get(form.role)?.length ?? 0;

  const groupedPermissions = useMemo(() => {
    const groups = new Map<'viewing' | 'managing', UserPermission[]>();
    permissions.forEach((permission) => {
      const groupTitle = resolvePermissionGroupTitle(permission.code);
      const current = groups.get(groupTitle) ?? [];
      current.push(permission);
      groups.set(groupTitle, current);
    });

    const order: Array<'viewing' | 'managing'> = ['viewing', 'managing'];

    return Array.from(groups.entries())
      .sort((left, right) => order.indexOf(left[0]) - order.indexOf(right[0]))
      .map(([title, items]) => ({
        title,
        items: [...items].sort((left, right) => left.name.localeCompare(right.name)),
      }));
  }, [permissions]);

  const canSubmit = useMemo(() => {
    const isPasswordValid = mode === 'edit' || form.password.trim().length >= 8;
    return (
      form.email.trim().length > 0 &&
      form.fullName.trim().length > 0 &&
      isPasswordValid
    );
  }, [form.email, form.fullName, form.password, mode]);

  function togglePermission(permissionId: string) {
    setForm((current) => {
      const selected = current.customPermissionIds.includes(permissionId);
      return {
        ...current,
        customPermissionIds: selected
          ? current.customPermissionIds.filter((id) => id !== permissionId)
          : [...current.customPermissionIds, permissionId],
      };
    });
  }

  function applyRoleDefaults(role: UserRole) {
    const defaults = roleDefaults.get(role) ?? [];
    if (!defaults.length) {
      return;
    }

    setForm((current) => ({
      ...current,
      customPermissionIds: defaults,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);

    const email = form.email.trim().toLowerCase();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const password = form.password.trim();

    if (!email || !fullName) {
      setFieldError(t('users.form.requiredError'));
      return;
    }

    if (!email.includes('@')) {
      setFieldError(t('users.form.emailError'));
      return;
    }

    if (mode === 'create' && password.length < 8) {
      setFieldError(t('users.form.passwordError'));
      return;
    }

    const payloadBase = {
      email,
      full_name: fullName,
      phone: phone || null,
      role: form.role,
      is_active: form.isActive,
      custom_permission_ids:
        form.role === 'developer' ? [] : form.customPermissionIds,
    };

    if (mode === 'create') {
      onSubmit({
        ...payloadBase,
        password,
      });
      return;
    }

    onSubmit({
      ...payloadBase,
      password: password || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <aside
        className="h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[620px] min-[641px]:p-5"
        onClick={(event) => event.stopPropagation()}
        aria-label={mode === 'create' ? t('users.form.createTitle') : t('users.form.editTitle')}
      >
        <header className="mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {t('users.form.eyebrow')}
              </p>
              <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary">
                {mode === 'create' ? t('users.form.createTitle') : t('users.form.editTitle')}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {mode === 'create'
                  ? t('users.form.createSubtitle')
                  : t('users.form.editSubtitle')}
              </p>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label={t('users.form.close')}
            >
              <AppIcon name="close" className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <form
          className="grid gap-3"
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="user-form-full-name">
                {t('users.form.fullName')}
              </label>
              <input
                id="user-form-full-name"
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
                className={inputClassName}
                placeholder={t('users.form.fullNamePlaceholder')}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="user-form-email">
                {t('users.form.email')}
              </label>
              <input
                id="user-form-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className={inputClassName}
                placeholder="user@example.com"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="user-form-phone">
                {t('users.form.phone')}
              </label>
              <input
                id="user-form-phone"
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className={inputClassName}
                placeholder="+998 90 000 00 00"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="user-form-password">
                {t('users.form.password')}
              </label>
              <input
                id="user-form-password"
                type="password"
                autoComplete={mode === 'create' ? 'new-password' : 'off'}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                className={inputClassName}
                placeholder={mode === 'create' ? t('users.form.passwordRequired') : t('users.form.passwordOptional')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className={labelClassName}>{t('users.form.role')}</span>
              <FilterSelect
                value={form.role}
                options={roleOptions}
                onChange={(value) =>
                  setForm((current) => {
                    const nextRole = value as UserRole;
                    const defaultPermissions = roleDefaults.get(nextRole) ?? [];
                    return {
                      ...current,
                      role: nextRole,
                      customPermissionIds:
                        nextRole === 'developer' ? [] : defaultPermissions,
                    };
                  })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35">
              <div className="grid gap-0.5">
                <p className="m-0 text-sm font-semibold text-text-primary">
                  {t('users.form.activeUser')}
                </p>
                <p className="m-0 text-[12px] text-text-secondary">
                  {t('users.form.activeHint')}
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onChange={(nextValue) =>
                  setForm((current) => ({ ...current, isActive: nextValue }))
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          {form.role !== 'developer' ? (
            <div className="grid gap-3 rounded-xl bg-surface-card/80 p-4 ring-1 ring-border-soft/35">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="grid gap-1">
                <h3 className="m-0 text-[0.95rem] font-semibold text-text-primary">
                  {t('users.form.permissionsTitle')}
                </h3>
                <p className="m-0 text-sm text-text-secondary">
                  {t('users.form.permissionsDescription')}
                </p>
                </div>
                {selectedRoleDefaultCount > 0 ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-subtle px-3 text-[12px] font-semibold text-text-primary ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-muted"
                    onClick={() => applyRoleDefaults(form.role)}
                    disabled={isSubmitting}
                  >
                    {t('users.form.applyRoleDefaults', { count: selectedRoleDefaultCount })}
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3">
                {groupedPermissions.map((group) => (
                  <div key={group.title} className="grid gap-2 rounded-xl bg-background-default/45 p-3 ring-1 ring-border-soft/30">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {t(`users.form.permissionGroups.${group.title}`)}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.items.map((permission) => {
                        const isChecked = form.customPermissionIds.includes(permission.id);
                        return (
                          <button
                            key={permission.id}
                            type="button"
                            className={[
                              'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 transition duration-fast',
                              isChecked
                                ? 'bg-primary/10 text-text-primary ring-primary/30'
                                : 'bg-surface-subtle text-text-secondary ring-border-soft/35 hover:bg-surface-muted',
                            ].join(' ')}
                            onClick={() => togglePermission(permission.id)}
                            disabled={isSubmitting}
                            aria-pressed={isChecked}
                          >
                            <span
                              className={[
                                'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                                isChecked
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-border-soft bg-background-default',
                              ].join(' ')}
                            >
                              {isChecked ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              ) : null}
                            </span>
                            <span className="grid gap-0.5">
                              <span className="text-sm font-semibold">
                                {getUserPermissionLabel(
                                  t,
                                  permission.code,
                                  permission.name,
                                )}
                              </span>
                              <span className="text-[12px] text-text-muted">
                                {getUserPermissionDescription(
                                  t,
                                  permission.code,
                                  permission.description,
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {fieldError ? (
            <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
              {fieldError}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-card px-4 text-sm font-semibold text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting
                ? mode === 'create'
                  ? t('users.form.creating')
                  : t('users.form.saving')
                : mode === 'create'
                  ? t('users.form.createSubmit')
                  : t('users.form.editSubmit')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default UserFormPanel;

