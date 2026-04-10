export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");

  return (
    <div className="pb-20 min-h-screen bg-slate-50">
      <ProfileClient user={user} />
      <NavBar />
    </div>
  );
}
