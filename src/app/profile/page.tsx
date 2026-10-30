import { requireUser } from "@/lib/auth";
import { getEmployee } from "@/modules/employees/queries";
import { ProfileView } from "@/components/ProfileView";

export default async function MyProfile({ searchParams }: PageProps<"/profile">) {
  const me = await requireUser();
  const { tab } = await searchParams;
  const emp = (await getEmployee(me.id))!;
  return <ProfileView me={me} emp={emp} tab={String(tab ?? "personal")} basePath="/profile" />;
}
