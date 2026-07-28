"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-line text-muted hover:text-paper transition-colors font-body text-sm px-4 py-2 print:hidden"
    >
      Print / save as PDF
    </button>
  );
}
