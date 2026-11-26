import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./session";
import { getDictionary } from "./i18n/server";

/**
 * For Route Handlers:
 *   const auth = await apiUser();
 *   if (!auth.user) return auth.response;
 */
export async function apiUser(): Promise<{ user: CurrentUser; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getCurrentUser();
  if (user) return { user };
  const t = await getDictionary();
  return { response: NextResponse.json({ error: t.errors.notSignedIn, code: "not_signed_in" }, { status: 401 }) };
}

/** 404 for a record that doesn't exist or belongs to someone else (same response, so ids can't be probed). */
export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
