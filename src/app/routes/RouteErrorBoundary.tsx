import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

function readErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unexpected error';
}

function isDynamicImportFailure(error: unknown): boolean {
  const message = readErrorMessage(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
    message,
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = readErrorMessage(error);
  const isChunkFailure = isDynamicImportFailure(error);

  return (
    <main className="grid min-h-screen place-items-center bg-background-default p-6">
      <section className="w-full max-w-[540px] rounded-xl bg-surface-card p-6 shadow-sm ring-1 ring-border-soft/50">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          Xatolik
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-text-primary">
          {isChunkFailure
            ? "Sahifa yangilandi. Qayta yuklab ko'ring."
            : "Kutilmagan xatolik yuz berdi."}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {isChunkFailure
            ? "Yangi versiya yuklangani sababli fayl topilmadi. Sahifani yangilash bu holatni tuzatadi."
            : message}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            onClick={() => window.location.reload()}
          >
            Qayta yuklash
          </button>
        </div>
      </section>
    </main>
  );
}

export default RouteErrorBoundary;
