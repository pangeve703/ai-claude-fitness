import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

// Self-hosted at build time; Chinese text falls back to the system CJK font (see --font-sans).
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d3f4e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1d" },
  ],
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await getLocale()];
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={dictionaries[locale].htmlLang} className={`h-full ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme on every page before first paint (no light flash). The toggle lives on the Profile page. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="app-bg min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
