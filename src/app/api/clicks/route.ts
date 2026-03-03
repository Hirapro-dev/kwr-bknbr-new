import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { postId, url, label, source } = await request.json();
    if (!postId || !url) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const validSource = source === "gen" || source === "vip" || source === "vc" ? source : null;

    await prisma.click.create({
      data: { postId, url, label: label || null, source: validSource },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
