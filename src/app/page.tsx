import { requireUser } from "@/lib/auth";
import { projectsFor } from "@/lib/queries";
import AppHeader from "@/components/AppHeader";
import ProjectCard from "@/components/ProjectCard";
import NewProjectButton from "@/components/NewProjectButton";
import { Empty } from "@/components/ui";

export const metadata = { title: "Projects" };

export default async function Home() {
  const user = await requireUser();
  const projects = projectsFor(user);
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Projects</h1>
          {!!user.is_site_admin && <NewProjectButton />}
        </div>

        {active.length === 0 ? (
          <Empty title="No projects yet">
            {user.is_site_admin ? "Create your first project to get started." : "Ask an admin to add you to a project."}
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-muted hover:text-fg">Archived ({archived.length})</summary>
            <div className="mt-4 grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
