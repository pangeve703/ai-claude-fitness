import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { redeemSignInLink } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getDictionary();
  const expired = token === "expired";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-xl font-bold">{t.signin.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{expired ? t.signin.expired : t.signin.desc}</p>
        {expired ? (
          <Link href="/" className="btn-ink mt-5 inline-block px-6 py-3">
            {t.signin.home}
          </Link>
        ) : (
          <form action={redeemSignInLink.bind(null, token)}>
            <button className="btn-ink mt-5 w-full py-3">
              {t.signin.continue}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
