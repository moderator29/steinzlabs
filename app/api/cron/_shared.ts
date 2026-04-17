import { NextRequest } from "next/server";

export function verifyCron(request: NextRequest): { ok: boolean; response?: Response } {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("[cron] CRON_SECRET not set, allowing request (dev mode)");
    return { ok: true };
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  return { ok: true };
}

export function cronResponse(jobName: string, startedAt: number, extra: Record<string, unknown> = {}) {
  const durationMs = Date.now() - startedAt;
  console.log(`[cron:${jobName}] completed in ${durationMs}ms`);
  return Response.json({ ok: true, job: jobName, durationMs, timestamp: Date.now(), ...extra });
}
