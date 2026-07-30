"use client";

export default function ConfirmDeleteButton({
  action,
  confirmMessage,
  className,
  label = "Delete",
}: {
  action: () => void;
  confirmMessage: string;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(confirmMessage)) action();
      }}
      className={
        className ??
        "font-mono text-xs text-muted hover:text-copper-bright transition-colors"
      }
    >
      {label}
    </button>
  );
}
