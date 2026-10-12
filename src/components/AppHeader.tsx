import Link from "next/link";
import type { User } from "@/lib/types";
import { Crumbs } from "./ui";
import UserMenu from "./UserMenu";

export default function AppHeader({ user, crumbs = [] }: { user: User; crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-3 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-semibold">
          <span className="grid size-5 place-items-center rounded bg-accent text-[11px] text-white">◆</span>
          Tracker
        </Link>
        {crumbs.length > 0 && (
          <>
            <span className="text-muted/60">/</span>
            <Crumbs items={crumbs} />
          </>
        )}
        <div className="ml-auto">
          <UserMenu name={user.name} siteAdmin={!!user.is_site_admin} />
        </div>
      </div>
    </header>
  );
}
