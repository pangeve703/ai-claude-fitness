import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// Depends on the visitor's session cookie, so never prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/setup");
}
