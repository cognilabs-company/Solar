import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../../../components/shared/icons/AppIcon';
import { EmptyState, PageHeader, PageLayout, PageSection } from '../../../components/shared/page';
import ClientDeleteDialog from '../../../features/clients/components/ClientDeleteDialog';
import { ClientsDetailPanel } from '../../../features/clients/components/ClientsDetailPanel';
import { ClientsFormPanel } from '../../../features/clients/components/ClientsFormPanel';
import { ClientsListView } from '../../../features/clients/components/ClientsListView';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { services } from '../../../services';
import { useAuth } from '../../../auth';
import type { Client } from '../../../services/contracts';

function ClientsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageClients = hasPermission('can_manage_clients');

  const tx = {
    eyebrow: t('clients.page.eyebrow'),
    title: t('clients.page.title'),
    subtitle: t('clients.page.subtitle'),
    newClient: t('clients.page.newClient'),
    visible: t('clients.page.visible'),
    detailOpen: t('clients.page.detailOpen'),
    errorTitle: t('clients.page.errorTitle'),
    errorDescription: t('clients.page.errorDescription'),
    deleteError: t('clients.page.deleteError'),
  };
  const importTx = {
    importClients: t('clients.importExport.importClients'),
    exportClients: t('clients.importExport.exportClients'),
    importTitle: t('clients.importExport.importTitle'),
    importSubtitle: t('clients.importExport.importSubtitle'),
    uploadFile: t('clients.importExport.uploadFile'),
    downloadTemplate: t('clients.importExport.downloadTemplate'),
    importPlaceholder: t('clients.importExport.importPlaceholder'),
    startImport: t('clients.importExport.startImport'),
    importing: t('clients.importExport.importing'),
    close: t('clients.importExport.close'),
    exportInProgress: t('clients.importExport.exportInProgress'),
    importFileReadError: t('clients.importExport.importFileReadError'),
    invalidImportJson: t('clients.importExport.invalidImportJson'),
    importNoValidRows: t('clients.importExport.importNoValidRows'),
    exportFailed: t('clients.importExport.exportFailed'),
    importFailed: t('clients.importExport.importFailed'),
    exportSuccess: t('clients.importExport.exportSuccess'),
    importResult: t('clients.importExport.importResult'),
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!actionMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionMessage]);

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

  function openCreateForm() {
    setEditingClient(null);
    setIsFormOpen(true);
  }

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

  function handleDeleteFromList(client: Client) {
    setClientToDelete(client);
  }

  function resolveTemplateMessage(template: string, values: Record<string, string | number>) {
    return template.replace(/\{\{(.*?)\}\}/g, (_, key: string) => {
      const trimmedKey = key.trim();
      return String(values[trimmedKey] ?? '');
    });
  }

  function normalizeImportRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null;
    }

    const source = input as Record<string, unknown>;
    const fullName =
      typeof source.full_name === 'string'
        ? source.full_name.trim()
        : typeof source.fullName === 'string'
          ? source.fullName.trim()
          : typeof source.name === 'string'
            ? source.name.trim()
            : '';

    if (!fullName) {
      return null;
    }

    const normalized: Record<string, unknown> = {
      ...source,
      full_name: fullName,
    };

    delete normalized.fullName;
    delete normalized.name;

    return normalized;
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setImportPayload(content);
    } catch {
      setActionMessage({ type: 'error', text: importTx.importFileReadError });
    } finally {
      event.target.value = '';
    }
  }

  function handleDownloadImportTemplate() {
    const sample = [
      {
        full_name: 'Ali Valiyev',
        phone: '+998901234567',
        region: 'Toshkent',
        address: 'Yunusobod tumani',
        source_platform: 'manual',
        status: 'new',
      },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'clients-import-template.json';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportClients() {
    setIsExporting(true);
    setActionMessage(null);

    try {
      const blob = await services.clients.exportClients();

      if (!blob || blob.size === 0) {
        setActionMessage({ type: 'error', text: importTx.exportFailed });
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `clients-export-${date}.xlsx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setActionMessage({
        type: 'success',
        // We don't know the exact exported row count from the XLSX response.
        // Use the currently loaded total as a best-effort value for the template.
        text: resolveTemplateMessage(importTx.exportSuccess, { count: stats.total }),
      });
    } catch {
      setActionMessage({ type: 'error', text: importTx.exportFailed });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportClients() {
    setIsImporting(true);
    setActionMessage(null);

    try {
      const parsed = JSON.parse(importPayload) as unknown;
      if (!Array.isArray(parsed)) {
        setActionMessage({ type: 'error', text: importTx.invalidImportJson });
        return;
      }

      const records = parsed
        .map(normalizeImportRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item));

      if (!records.length) {
        setActionMessage({ type: 'error', text: importTx.importNoValidRows });
        return;
      }

      let success = 0;
      let failed = 0;

      for (const record of records) {
        try {
          await services.clients.bulkImportClient(record as any);
          success += 1;
        } catch {
          failed += 1;
        }
      }

      if (success > 0) {
        setListRefreshKey((current) => current + 1);
      }

      setActionMessage({
        type: failed > 0 ? 'error' : 'success',
        text: resolveTemplateMessage(importTx.importResult, { success, failed }),
      });

      if (success > 0) {
        setIsImportOpen(false);
        setImportPayload('');
      }
    } catch {
      setActionMessage({ type: 'error', text: importTx.importFailed });
    } finally {
      setIsImporting(false);
    }
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
          {canManageClients ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              onClick={openCreateForm}
            >
              <AppIcon name="plus" className="h-4 w-4" aria-hidden="true" />
              {tx.newClient}
            </button>
          ) : null}
          {canManageClients ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-card px-3.5 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft/70 transition duration-fast hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-65"
              onClick={() => {
                void handleExportClients();
              }}
              disabled={isExporting}
            >
              <AppIcon name="download" className="h-4 w-4" aria-hidden="true" />
              {isExporting ? importTx.exportInProgress : importTx.exportClients}
            </button>
          ) : null}
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success">
            <AppIcon name="clients" className="h-3.5 w-3.5" aria-hidden="true" />
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
          <ClientsListView
            key={listRefreshKey}
            onRowClick={(client) => setSelectedClientId(client.id)}
            onEditClient={openEditForm}
            onDeleteClient={handleDeleteFromList}
            selectedClientId={selectedClientId}
            canManageClients={canManageClients}
            onStatsChange={handleStatsChange}
          />
        </PageSection>
      </PageLayout>

      {actionMessage ? (
        <div className="fixed bottom-4 right-4 z-[230] w-[min(92vw,460px)]">
          <div
            className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 backdrop-blur-sm ${
              actionMessage.type === 'success'
                ? 'bg-success-bg/95 text-success ring-success/35'
                : 'bg-danger-bg/95 text-danger ring-danger/35'
            }`}
            role="status"
            aria-live="polite"
          >
            <AppIcon
              name={actionMessage.type === 'success' ? 'check-circle' : 'activity'}
              className="mt-0.5 h-4.5 w-4.5 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 break-words">{actionMessage.text}</span>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-card/55 text-current transition duration-fast hover:bg-surface-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/35"
              onClick={() => setActionMessage(null)}
              aria-label={t('common.close')}
            >
              <AppIcon name="close" className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

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

export default ClientsPage;

