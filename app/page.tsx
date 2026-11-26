import ListBuilder from "./components/ListBuilder";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-24 sm:pt-32">
      <h1 className="font-display text-5xl italic tracking-tight sm:text-6xl">
        Yosif&apos;s List
      </h1>
      <p className="mb-12 mt-3 text-center text-sm text-neutral-500 sm:mb-16 sm:text-base">
        Find the cheapest store for your groceries in Doha
      </p>
      <ListBuilder />
    </main>
  );
}
