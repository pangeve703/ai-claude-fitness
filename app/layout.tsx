import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 健身教练助理",
  description: "个性化饮食与训练计划，Telegram 照片记录卡路里",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full">
      <head>
        {/* Anti-flash: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
        {children}
      </body>
    </html>
  );
}
