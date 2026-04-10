import { NextResponse } from "next/server";

let botStarted = false;

export async function POST() {
  if (!botStarted) {
    // Dynamic import to avoid issues during build
    const { getBot } = await import("@/lib/telegram-bot");
    getBot();
    botStarted = true;
  }
  return NextResponse.json({ status: "running" });
}

export async function GET() {
  return NextResponse.json({ status: botStarted ? "running" : "stopped" });
}
