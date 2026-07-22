import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeChannel } from "@/lib/tracking";

export async function POST(request: NextRequest) {
  try {
    const { postId, url, label, source, channel } = await request.json();
    if (!postId || !url) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const validSource = source === "gen" || source === "vip" || source === "vc" || source === "wel" ? source : null;
    // 配信チャネル（mail / line）。不正値・未指定は null（＝直接・不明）
    const validChannel = normalizeChannel(channel);

    await prisma.click.create({
      data: { postId, url, label: label || null, source: validSource, channel: validChannel },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
