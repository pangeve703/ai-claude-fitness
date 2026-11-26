import { GUEST_TTL_DAYS, requireUser } from "@/lib/session";
import { dateKey } from "@/lib/dates";
import NavBar from "@/components/NavBar";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen pb-28">
      <ProfileClient user={user} guestTtlDays={GUEST_TTL_DAYS} />
      <NavBar today={dateKey()} />
    </div>
  );
}
