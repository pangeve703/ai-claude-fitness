import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");

  return (
    <div className="pb-20 min-h-screen bg-slate-50 dark:bg-slate-900">
      <ProfileClient user={user} />
      <NavBar />
    </div>
  );
}
