import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export async function POST(request) {
  // Verify the request is authorized
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  const secret = authHeader?.replace("Bearer ", "") || body.secret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sendEmail = body.sendEmail !== false; // default true
    const result = await runPipeline({ sendEmail });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Pipeline trigger error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
