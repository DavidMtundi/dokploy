import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { runDeployment } from "@/lib/deploy";

type Params = { params: Promise<{ slug: string }> };

function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const received = signature.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (
    process.env.NODE_ENV === "production" &&
    !verifyGitHubSignature(rawBody, signature, project.webhookSecret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    return NextResponse.json({ message: "Ignored event" });
  }

  if (!project.autoDeploy) {
    return NextResponse.json({ message: "Auto-deploy disabled" });
  }

  const payload = JSON.parse(rawBody) as {
    ref?: string;
    repository?: { clone_url?: string };
  };

  const branchRef = `refs/heads/${project.branch}`;
  if (payload.ref !== branchRef) {
    return NextResponse.json({ message: "Ignored branch" });
  }

  const deploymentId = await runDeployment(project.id, "webhook");
  return NextResponse.json({ deploymentId }, { status: 202 });
}
