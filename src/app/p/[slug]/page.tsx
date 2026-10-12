import { deletedModules, goalsForWeek, loadProject, modulesFor, projectStats } from "@/lib/queries";
import { isWeekKey, weekStart } from "@/lib/util";
import GoalsStrip from "@/components/GoalsStrip";
import AppHeader from "@/components/AppHeader";
import ProjectHeader from "@/components/ProjectHeader";
import ModuleCard from "@/components/ModuleCard";
import DeletedModules from "@/components/DeletedModules";
import { Empty } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { project } = await loadProject((await params).slug);
  return { title: project.name };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { user, project, role } = await loadProject((await params).slug);
  const sp = await searchParams;
  const week = isWeekKey(sp.week) ? sp.week : weekStart();
  const isAdmin = role === "admin";
  const modules = modulesFor(project.id);
  const stats = projectStats(project.id);

  const attention = modules.filter((m) => m.attention > 0);
  const complete = modules.filter((m) => m.attention === 0 && m.total > 0 && m.done === m.total);
  const active = modules.filter((m) => !attention.includes(m) && !complete.includes(m));
  const deleted = isAdmin ? deletedModules(project.id) : [];

  const section = (title: string, list: typeof modules) =>
    list.length > 0 && (
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          {title} <span className="text-muted/70">({list.length})</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((m) => (
            <ModuleCard key={m.id} m={m} href={`/p/${project.slug}/m/${m.slug}`} isAdmin={isAdmin} />
          ))}
        </div>
      </section>
    );

  return (
    <>
      <AppHeader user={user} crumbs={[{ label: project.name }]} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <ProjectHeader project={project} stats={stats} role={role} siteAdmin={!!user.is_site_admin} tab="modules" />
        <GoalsStrip
          projectId={project.id}
          projectSlug={project.slug}
          week={week}
          goals={goalsForWeek(project.id, week)}
          meId={user.id}
          isAdmin={isAdmin}
        />
        {modules.length === 0 ? (
          <Empty title="No modules yet">
            {isAdmin ? "Modules group the tasks in a project. Create the first one with “+ New module”." : "An admin needs to create modules first."}
          </Empty>
        ) : (
          <>
            {section("Needs attention", attention)}
            {section("In progress", active)}
            {section("Completed", complete)}
          </>
        )}
        {deleted.length > 0 && <DeletedModules items={deleted} />}
      </main>
    </>
  );
}
