import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activityFor, loadProject, membersOf, moduleBySlug, tasksIn } from "@/lib/queries";
import AppHeader from "@/components/AppHeader";
import TaskBoard from "@/components/TaskBoard";

type Params = Promise<{ slug: string; mod: string }>;
type Search = Promise<{ task?: string; f?: string; deleted?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug, mod } = await params;
  const { project } = await loadProject(slug);
  return { title: `${moduleBySlug(project.id, mod)?.name ?? "Module"} · ${project.name}` };
}

export default async function ModulePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug, mod } = await params;
  const sp = await searchParams;
  const { user, project, role } = await loadProject(slug);
  const module = moduleBySlug(project.id, mod);
  if (!module) notFound();

  const isAdmin = role === "admin";
  const showDeleted = isAdmin && sp.deleted === "1";
  const tasks = tasksIn(module.id, showDeleted);
  const members = membersOf(project.id).filter((m) => !m.disabled_at);
  const modules = db
    .prepare("SELECT id, name FROM modules WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order, name")
    .all(project.id) as { id: number; name: string }[];

  const selectedId = Number(sp.task);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const activity = selected ? activityFor(selected.id) : [];

  return (
    <>
      <AppHeader user={user} crumbs={[{ label: project.name, href: `/p/${project.slug}` }, { label: module.name }]} />
      <TaskBoard
        projectSlug={project.slug}
        module={{ id: module.id, name: module.name, description: module.description }}
        tasks={tasks}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        modules={modules}
        me={{ id: user.id, name: user.name }}
        isAdmin={isAdmin}
        showDeleted={showDeleted}
        selected={selected}
        activity={activity}
        initialFilter={sp.f}
      />
    </>
  );
}
