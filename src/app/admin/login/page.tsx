import { signIn } from "@/app/admin/actions";
import SubmitButton from "@/components/SubmitButton";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm border border-line bg-surface rounded-lg p-8 bracket-frame">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-copper-bright mb-2">
          E Tronic
        </p>
        <h1 className="font-display text-2xl mb-6">Admin sign in</h1>

        {searchParams?.error && (
          <p className="mb-4 font-body text-sm text-copper-bright bg-copper/10 border border-copper/30 rounded-md px-3 py-2">
            {searchParams.error}
          </p>
        )}

        <form action={signIn} className="space-y-4">
          <div>
            <label className="block font-body text-xs text-muted mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-muted mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
            />
          </div>
          <SubmitButton
            pendingText="Signing in…"
            className="w-full justify-center rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium py-2.5"
          >
            Sign in
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
