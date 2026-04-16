import { NextResponse } from "next/server";

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: false,
    disabled: true,
    message: "morning-digest is temporarily disabled while collect pipeline is being stabilized",
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
