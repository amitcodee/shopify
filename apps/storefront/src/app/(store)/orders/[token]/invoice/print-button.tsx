'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn px-5 py-2.5 text-sm">
      Print or save as PDF
    </button>
  );
}
