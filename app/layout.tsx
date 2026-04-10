import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 健身教练助理",
  description: "个性化饮食与训练计划，Telegram 照片记录卡路里",
};

async function InitializeTelegramBot() {
  try {
    await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/startup`, {
      method: "GET",
    });
  } catch {
    // Silent fail - bot will initialize on first use
  }
  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await InitializeTelegramBot();

  return (
    <html lang="zh-TW" className="h-full">
      <head>
        {/* Anti-flash: apply saved theme before first paint */}
        {/* <script
          id="theme-loader"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        /> */}
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">{children}</body>
    </html>
  );
}
