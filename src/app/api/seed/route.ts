import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const existing = await prisma.admin.findUnique({ where: { username: "admin" } });
    if (existing) {
      return NextResponse.json({ message: "管理者は既に存在します" });
    }

    const password = process.env.ADMIN_PASSWORD || "admin123";
    const hashed = await bcrypt.hash(password, 12);

    await prisma.admin.create({
      data: { username: "admin", password: hashed },
    });

    return NextResponse.json({ message: "管理者アカウントを作成しました" });
  } catch {
    return NextResponse.json({ error: "セットアップに失敗しました" }, { status: 500 });
  }
}
