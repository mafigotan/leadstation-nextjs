"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary print:hidden" onClick={() => window.print()}>
      인쇄 / PDF 저장
    </button>
  );
}
