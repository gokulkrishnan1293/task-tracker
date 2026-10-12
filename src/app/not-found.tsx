import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-4 text-center">
      <div>
        <p className="text-lg font-semibold">Not found</p>
        <p className="mt-1 text-sm text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to projects
        </Link>
      </div>
    </main>
  );
}
