"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatQar, type Receipt } from "@/lib/results";
import { insert } from "@/lib/supabase";

const PROBLEMS = [
  { value: "wrong_price", label: "Wrong price" },
  { value: "not_available", label: "Not available in the store" },
  { value: "wrong_product", label: "Wrong product matched" },
  { value: "other", label: "Something else" },
] as const;

type Problem = (typeof PROBLEMS)[number]["value"];

/** "Report a problem" form. Reports are saved to the database for the owner to review. */
export default function ReportDialog({
  receipts,
  initialStoreId,
  onClose,
}: {
  receipts: Receipt[];
  initialStoreId?: string;
  onClose: () => void;
}) {
  const [storeId, setStoreId] = useState(initialStoreId ?? receipts[0]?.storeId ?? "");
  const receipt = receipts.find((r) => r.storeId === storeId);
  const [itemId, setItemId] = useState(receipt?.lines[0]?.itemId ?? "");
  const [problem, setProblem] = useState<Problem>("wrong_price");
  const [correctPrice, setCorrectPrice] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  const line = receipt?.lines.find((l) => l.itemId === itemId) ?? receipt?.lines[0];

  // Close on Escape; focus the dialog when it opens.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!receipt || !line) return;
    setState("sending");
    const price = Number(correctPrice);
    try {
      await insert("reports", {
        store_id: receipt.storeId,
        product_id: line.product ? Number(line.product.id) || null : null,
        item_text: line.query.slice(0, 200),
        product_name: line.product?.name.slice(0, 200) ?? null,
        shown_price: line.product?.price ?? null,
        problem,
        correct_price: problem === "wrong_price" && correctPrice && Number.isFinite(price) ? price : null,
        note: note.trim().slice(0, 500) || null,
      });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  const field =
    "w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="animate-item-in w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] focus:outline-none"
      >
        {state === "sent" ? (
          <div className="py-6 text-center">
            <p className="font-display text-3xl italic">Thank you!</p>
            <p className="mt-3 text-sm text-neutral-400">
              Your report helps make prices more accurate for everyone.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-neutral-400 px-6 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h2 id="report-title" className="text-lg font-medium text-neutral-100">
                Report a problem
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 px-1 text-neutral-500 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
              Store
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  const r = receipts.find((x) => x.storeId === e.target.value);
                  setItemId(r?.lines[0]?.itemId ?? "");
                }}
                className={field}
              >
                {receipts.map((r) => (
                  <option key={r.storeId} value={r.storeId}>
                    {r.storeName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
              Item
              <select value={line?.itemId ?? ""} onChange={(e) => setItemId(e.target.value)} className={field}>
                {receipt?.lines.map((l) => (
                  <option key={l.itemId} value={l.itemId}>
                    {l.product
                      ? `${l.product.name} — QAR ${formatQar(l.product.price)}`
                      : `${l.query} — not found`}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs text-neutral-400">What&apos;s wrong?</legend>
              <div className="grid grid-cols-2 gap-2">
                {PROBLEMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProblem(p.value)}
                    aria-pressed={problem === p.value}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                      problem === p.value
                        ? "border-neutral-300 bg-neutral-800 text-neutral-100"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {problem === "wrong_price" && (
              <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
                Correct price in store (optional)
                <input
                  inputMode="decimal"
                  value={correctPrice}
                  onChange={(e) => setCorrectPrice(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                  placeholder="e.g. 9.75"
                  className={`${field} font-mono`}
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
              Anything else? (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="e.g. only the 2 kg bag was on the shelf"
                className={`${field} resize-none`}
              />
            </label>

            {state === "error" && (
              <p className="text-xs text-red-400">Couldn&apos;t send that. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={state === "sending" || !line}
              className="mt-1 rounded-full bg-neutral-400 px-6 py-3 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-300 disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Send report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
