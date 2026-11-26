import ListBuilder from "./components/ListBuilder";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-24 sm:pt-32">
      <h1 className="mb-14 font-display text-5xl italic tracking-tight sm:mb-20 sm:text-6xl">
        Yosif&apos;s List
      </h1>
      <ListBuilder />
    </main>
  );
}
