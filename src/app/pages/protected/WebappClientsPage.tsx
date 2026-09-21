import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { EmptyState, PageHeader, PageLayout, PageSection } from '../../../components/shared/page';
import ClientDeleteDialog from '../../../features/clients/components/ClientDeleteDialog';
import { ClientsDetailPanel } from '../../../features/clients/components/ClientsDetailPanel';
import { ClientsFormPanel } from '../../../features/clients/components/ClientsFormPanel';
import { WebappClientsListView } from '../../../features/clients/components/WebappClientsListView';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { services } from '../../../services';
import { useAuth } from '../../../auth';
import type { Client } from '../../../services/contracts';

function WebappClientsPage() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageClients = hasPermission('can_manage_clients');
  const isRu = i18n.language === 'ru';

  const tx = isRu
    ? {
        eyebrow: 'WebApp',
        title: 'WebApp клиенты',
        subtitle: 'Клиенты из Telegram WebApp — отдельная очередь, чтобы не путать с основными клиентами.',
        visible: 'показано',
        detailOpen: 'Профиль открыт',
        errorTitle: 'WebApp клиенты недоступны',
        errorDescription: 'Не удалось загрузить список WebApp клиентов.',
        deleteError: 'Не удалось удалить клиента.',
      }
    : {
        eyebrow: 'WebApp',
        title: 'WebApp mijozlar',
        subtitle: 'Telegram WebApp orqali kelgan mijozlar — asosiy mijozlar bilan adashmaslik uchun alohida navbat.',
        visible: "ko'rinmoqda",
        detailOpen: 'Profil ochiq',
        errorTitle: 'WebApp mijozlari mavjud emas',
        errorDescription: "WebApp mijozlar ro'yxatini yuklab bo'lmadi.",
        deleteError: "Mijozni o'chirib bo'lmadi.",
      };

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [stats, setStats] = useState({ visible: 0, total: 0, loading: true });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const state = location.state as { clientId?: string } | null;
    const requestedClientId = state?.clientId;
    if (!requestedClientId || typeof requestedClientId !== 'string') {
      return;
    }

    setSelectedClientId(requestedClientId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const state = location.state as { clientId?: string } | null;
    const requestedClientId = state?.clientId;

    if (!requestedClientId || typeof requestedClientId !== 'string') {
      setSelectedClientId(null);
    }

    setIsFormOpen(false);
    setEditingClient(null);
    setClientToDelete(null);
    setIsDeleting(false);
  }, [location.pathname]);

  function openEditForm(client: Client) {
    setEditingClient(client);
    setIsFormOpen(true);
  }

  function handleClientSaved(client: Client) {
    setIsFormOpen(false);
    setEditingClient(null);
    setSelectedClientId(client.id);
    setListRefreshKey((current) => current + 1);
  }

  async function handleConfirmDelete() {
    if (!clientToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await services.clients.deleteClient(clientToDelete.id);
      if (selectedClientId === clientToDelete.id) {
        setSelectedClientId(null);
      }
      setClientToDelete(null);
      setListRefreshKey((current) => current + 1);
    } catch (error) {
      // Keep the dialog open with the reason (e.g. client still has contracts)
      // instead of swapping the whole page for an error state.
      setDeleteError(extractApiErrorMessage(error, tx.deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  const handleStatsChange = useCallback((next: { visible: number; total: number; loading: boolean }) => {
    setStats((current) => {
      if (
        current.visible === next.visible &&
        current.total === next.total &&
        current.loading === next.loading
      ) {
        return current;
      }

      return next;
    });

    if (!next.loading) {
      setHasError(false);
    }
  }, []);

  const header = (
    <PageHeader
      eyebrow={tx.eyebrow}
      title={tx.title}
      subtitle={tx.subtitle}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto">
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success">
            <AppIcon name="orders" className="h-3.5 w-3.5" aria-hidden="true" />
            {stats.visible} {tx.visible}
          </span>
          {selectedClientId ? (
            <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
              <AppIcon name="user" className="h-3.5 w-3.5" aria-hidden="true" />
              {tx.detailOpen}
            </span>
          ) : null}
        </div>
      }
    />
  );

  if (hasError) {
    return (
      <PageLayout header={header}>
        <EmptyState title={tx.errorTitle} description={tx.errorDescription} />
      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout header={header}>
        <PageSection>
          <WebappClientsListView
            key={listRefreshKey}
            onRowClick={(client) => setSelectedClientId(client.id)}
            onEditClient={openEditForm}
            onDeleteClient={(client) => setClientToDelete(client)}
            selectedClientId={selectedClientId}
            canManageClients={canManageClients}
            onStatsChange={handleStatsChange}
          />
        </PageSection>
      </PageLayout>

      {selectedClientId ? (
        <div
          className="fixed inset-0 z-[140] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
          role="presentation"
          onClick={() => setSelectedClientId(null)}
        >
          <div
            className="h-full w-full max-w-[520px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <ClientsDetailPanel
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
              onEdit={(client: Client) => {
                setSelectedClientId(null);
                openEditForm(client);
              }}
              onRequestDelete={(client: Client) => {
                setSelectedClientId(null);
                setClientToDelete(client);
              }}
            />
          </div>
        </div>
      ) : null}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]"
          role="presentation"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="h-full w-full max-w-[560px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <ClientsFormPanel
              client={editingClient ?? undefined}
              onClose={() => {
                setIsFormOpen(false);
                setEditingClient(null);
              }}
              onSuccess={handleClientSaved}
            />
          </div>
        </div>
      ) : null}

      {clientToDelete ? (
        <ClientDeleteDialog
          client={clientToDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onCancel={() => {
            if (!isDeleting) {
              setClientToDelete(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      ) : null}
    </>
  );
}

export default WebappClientsPage;
