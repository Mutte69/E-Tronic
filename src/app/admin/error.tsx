"use client";

import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-copper-bright mb-4">
          E Tronic admin
        </p>
        <h1 className="font-display text-2xl text-paper mb-3">
          This page hit an error
        </h1>
        <p className="font-body text-sm text-muted mb-2">
          Often this means a recent update needs the database schema
          re-run — ask your developer to check{" "}
          <code className="font-mono text-copper-bright">supabase/schema.sql</code>{" "}
          has been run in Supabase's SQL Editor.
        </p>
        {error.message && (
          <p className="font-mono text-xs text-muted bg-surface border border-line rounded-md px-3 py-2 my-4 text-left break-words">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={reset}
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-line text-muted hover:text-paper transition-colors font-body text-sm px-5 py-2.5"
          >
            Back to dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="font-mono text-[10px] text-muted mt-6">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
