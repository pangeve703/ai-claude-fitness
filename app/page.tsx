import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await prisma.user.findFirst();
  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/setup");
  }
}
