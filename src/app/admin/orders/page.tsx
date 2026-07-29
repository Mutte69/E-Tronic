import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import { createInvoiceFromOrder } from "@/app/admin/actions";
import SubmitButton from "@/components/SubmitButton";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import type { Order } from "@/lib/types";

export const revalidate = 0;

export default async function OrdersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as Order[];
  const pending = orders.filter((o) => o.status === "pending");
  const invoiced = orders.filter((o) => o.status === "invoiced");

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/orders" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Orders</h1>

        <h2 className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-3">
          New
        </h2>
        {pending.length === 0 ? (
          <p className="font-body text-muted text-sm mb-8">
            No new orders from the site yet.
          </p>
        ) : (
          <div className="space-y-3 mb-10">
            {pending.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}

        {invoiced.length > 0 && (
          <>
            <h2 className="font-display text-sm tracking-[0.2em] uppercase text-muted mb-3">
              Already invoiced
            </h2>
            <div className="space-y-3">
              {invoiced.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="border border-line rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <p className="font-body text-sm text-paper">{order.customer_name}</p>
          <p className="font-mono text-xs text-muted">
            {order.customer_phone} · {order.customer_address}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-copper-bright">
            MVR {order.subtotal.toFixed(2)}
          </span>
          {order.status === "pending" ? (
            <form action={createInvoiceFromOrder.bind(null, order.id)}>
              <SubmitButton
                pendingText="Creating…"
                className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-mono text-xs px-3 py-1.5"
              >
                Create invoice
              </SubmitButton>
            </form>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted border border-line px-2 py-1 rounded-sm">
              Invoiced
            </span>
          )}
          <DeleteOrderButton id={order.id} customerName={order.customer_name} />
        </div>
      </div>
      <ul className="font-body text-xs text-muted space-y-0.5">
        {order.items.map((item, i) => (
          <li key={i}>
            {item.qty}x {item.name} — MVR {(item.price * item.qty).toFixed(2)}
          </li>
        ))}
      </ul>
      <p className="font-mono text-[10px] text-muted mt-2">
        {new Date(order.created_at).toLocaleString()}
      </p>
    </div>
  );
}
