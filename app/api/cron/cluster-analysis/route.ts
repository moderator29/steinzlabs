import { NextRequest } from "next/server";
import { verifyCron, cronResponse } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  return cronResponse("cluster-analysis", startedAt);
}
