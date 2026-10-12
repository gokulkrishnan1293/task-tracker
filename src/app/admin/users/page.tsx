import { requireSiteAdmin } from "@/lib/auth";
import { allUsers } from "@/lib/queries";
import AppHeader from "@/components/AppHeader";
import UsersManager from "@/components/UsersManager";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireSiteAdmin();
  return (
    <>
      <AppHeader user={user} crumbs={[{ label: "Users" }]} />
      <main className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
        <UsersManager users={allUsers()} meId={user.id} />
      </main>
    </>
  );
}
