import Link from "next/link";

// Placeholder until Phase 2 builds the side-by-side store receipts.
export default function Results() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-20 sm:pt-24">
      <h1 className="font-display text-5xl italic tracking-tight sm:text-6xl">
        Yosif&apos;s List
      </h1>
      <p className="mt-10 text-sm text-neutral-500">Store receipts are coming in the next step.</p>
      <Link href="/" className="mt-6 text-sm text-neutral-300 underline-offset-4 hover:underline">
        ← Back to your list
      </Link>
    </main>
  );
}
