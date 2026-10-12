import { goalsForWeek, loadProject, projectStats } from "@/lib/queries";
import { isWeekKey, weekStart } from "@/lib/util";
import AppHeader from "@/components/AppHeader";
import ProjectHeader from "@/components/ProjectHeader";
import GoalsStrip from "@/components/GoalsStrip";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { project } = await loadProject((await params).slug);
  return { title: `Weekly goals · ${project.name}` };
}

export default async function GoalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { user, project, role } = await loadProject((await params).slug);
  const sp = await searchParams;
  const week = isWeekKey(sp.week) ? sp.week : weekStart();

  return (
    <>
      <AppHeader user={user} crumbs={[{ label: project.name, href: `/p/${project.slug}` }, { label: "Weekly goals" }]} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <ProjectHeader project={project} stats={projectStats(project.id)} role={role} siteAdmin={!!user.is_site_admin} tab="goals" />
        <GoalsStrip
          projectId={project.id}
          projectSlug={project.slug}
          week={week}
          goals={goalsForWeek(project.id, week)}
          meId={user.id}
          isAdmin={role === "admin"}
        />
      </main>
    </>
  );
}
