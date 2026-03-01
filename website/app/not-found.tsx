import Link from "next/link";
import { WormMascot } from "./components/WormMascot";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex min-h-[180px] items-center justify-center">
        <div className="scale-[2.5] origin-center sm:scale-[3]">
          <WormMascot variant={5} className="opacity-90" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-[var(--fg)]">Page not found</h1>
        <p className="mt-1 text-sm text-[var(--muted-fg)]">
          The wormhole didn&apos;t lead anywhere.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg px-4 py-2 text-sm font-normal text-[var(--fg)] transition-colors hover:bg-white/10"
      >
        Back home
      </Link>
    </div>
  );
}
