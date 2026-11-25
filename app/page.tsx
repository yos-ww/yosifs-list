import ListBuilder from "./components/ListBuilder";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-20 sm:pt-24">
      <h1 className="mb-10 font-display text-5xl italic tracking-tight sm:text-6xl">
        Yosif&apos;s List
      </h1>
      <ListBuilder />
    </main>
  );
}
