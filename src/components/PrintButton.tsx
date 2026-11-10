"use client";

export function PrintButton() {
  return (
    <button type="button" className="primary-btn" onClick={() => window.print()}>
      Imprimir / PDF
    </button>
  );
}
