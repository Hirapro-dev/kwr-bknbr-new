import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { postId, url, label } = await request.json();
    if (!postId || !url) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    await prisma.click.create({
      data: { postId, url, label: label || null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
