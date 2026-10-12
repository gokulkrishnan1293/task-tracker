import { db } from "@/lib/db";
import { loadProject, membersOf, projectStats } from "@/lib/queries";
import AppHeader from "@/components/AppHeader";
import ProjectHeader from "@/components/ProjectHeader";
import MembersManager from "@/components/MembersManager";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { project } = await loadProject((await params).slug);
  return { title: `Members · ${project.name}` };
}

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user, project, role } = await loadProject((await params).slug);
  const isAdmin = role === "admin";
  const members = membersOf(project.id);
  const others = isAdmin
    ? (db
        .prepare(
          `SELECT id, name, username FROM users
            WHERE disabled_at IS NULL AND id NOT IN (SELECT user_id FROM project_members WHERE project_id = ?)
            ORDER BY name`,
        )
        .all(project.id) as { id: number; name: string; username: string }[])
    : [];

  return (
    <>
      <AppHeader user={user} crumbs={[{ label: project.name, href: `/p/${project.slug}` }, { label: "Members" }]} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <ProjectHeader project={project} stats={projectStats(project.id)} role={role} siteAdmin={!!user.is_site_admin} tab="members" />
        <MembersManager projectId={project.id} members={members} others={others} isAdmin={isAdmin} meId={user.id} />
      </main>
    </>
  );
}
