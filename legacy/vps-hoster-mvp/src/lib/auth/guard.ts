import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, AuthUser } from "./user";

export async function requireAuth(
  request: NextRequest
): Promise<AuthUser | NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export function isAuthError(
  result: AuthUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
