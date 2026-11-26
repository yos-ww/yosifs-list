import Link from "next/link";
import Receipts from "../components/Receipts";

export const metadata = { title: "Results · Yosif's List" };

export default function Results() {
  return (
    <main className="flex flex-1 flex-col items-center overflow-x-hidden px-4 pb-16 pt-14 sm:pt-20">
      <Link href="/" className="font-display text-4xl italic tracking-tight sm:text-5xl">
        Yosif&apos;s List
      </Link>
      <Link
        href="/"
        className="mb-10 mt-4 text-xs text-neutral-500 transition-colors hover:text-neutral-200"
      >
        ← Edit list
      </Link>
      <Receipts />
    </main>
  );
}
