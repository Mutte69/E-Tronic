"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-copper-bright mb-4">
          E Tronic
        </p>
        <h1 className="font-display text-2xl text-paper mb-3">
          Something went wrong
        </h1>
        <p className="font-body text-sm text-muted mb-6">
          This page hit a snag loading. Try again, or come back in a moment.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
        >
          Try again
        </button>
        {error.digest && (
          <p className="font-mono text-[10px] text-muted mt-6">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
