// アクセス解析の集計状況を調査（読み取りのみ）
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const fmt = (d) => (d ? new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—");

console.log("=== 1. レコード総数 ===");
const [pvCount, clickCount, postCount] = await Promise.all([
  prisma.pageView.count(), prisma.click.count(), prisma.post.count(),
]);
console.log(`  PageView: ${pvCount} / Click: ${clickCount} / Post: ${postCount}`);
const viewsSum = await prisma.post.aggregate({ _sum: { views: true } });
console.log(`  Post.views の合計: ${viewsSum._sum.views}（PageViewレコード数と乖離があれば要注意）`);

console.log("\n=== 2. source（媒体）の内訳 ===");
const pvBySource = await prisma.pageView.groupBy({ by: ["source"], _count: { id: true } });
console.log("  PageView:");
pvBySource.sort((a, b) => b._count.id - a._count.id).forEach((g) => console.log(`    ${String(g.source)}: ${g._count.id}`));
const clBySource = await prisma.click.groupBy({ by: ["source"], _count: { id: true } });
console.log("  Click:");
clBySource.sort((a, b) => b._count.id - a._count.id).forEach((g) => console.log(`    ${String(g.source)}: ${g._count.id}`));

console.log("\n=== 3. 記録期間 ===");
for (const [name, model] of [["PageView", prisma.pageView], ["Click", prisma.click]]) {
  const first = await model.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const last = await model.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  console.log(`  ${name}: ${fmt(first?.createdAt)} 〜 ${fmt(last?.createdAt)}`);
}

console.log("\n=== 4. 月別件数 ===");
const allPv = await prisma.pageView.findMany({ select: { createdAt: true, source: true } });
const allCl = await prisma.click.findMany({ select: { createdAt: true, source: true } });
const byMonth = (rows) => {
  const m = {};
  rows.forEach((r) => { const k = r.createdAt.toISOString().slice(0, 7); m[k] = (m[k] || 0) + 1; });
  return m;
};
const pvM = byMonth(allPv), clM = byMonth(allCl);
const months = [...new Set([...Object.keys(pvM), ...Object.keys(clM)])].sort();
months.forEach((k) => console.log(`  ${k}  閲覧 ${String(pvM[k] || 0).padStart(6)}  クリック ${String(clM[k] || 0).padStart(6)}`));

console.log("\n=== 5. 管理画面と同じ条件で集計（媒体タブ = gen の場合）===");
const media = "gen";
const posts = await prisma.post.findMany({ where: { showForGen: true }, select: { id: true } });
const postIds = posts.map((p) => p.id);
const totalViewsTab = await prisma.pageView.count({ where: { postId: { in: postIds }, source: media } });
const totalClicksTab = await prisma.click.count({ where: { postId: { in: postIds }, source: media } });
const totalViewsNoSrc = await prisma.pageView.count({ where: { postId: { in: postIds } } });
const totalClicksNoSrc = await prisma.click.count({ where: { postId: { in: postIds } } });
console.log(`  対象記事: ${postIds.length}件`);
console.log(`  source="gen" で絞った場合 → 閲覧 ${totalViewsTab} / クリック ${totalClicksTab}`);
console.log(`  source で絞らない場合   → 閲覧 ${totalViewsNoSrc} / クリック ${totalClicksNoSrc}`);

console.log("\n=== 6. 詳細パネルの期間フィルタ（日別=直近30日）の影響 ===");
const now = new Date();
const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
const d365 = new Date(now); d365.setMonth(d365.getMonth() - 12);
for (const [name, model] of [["PageView", prisma.pageView], ["Click", prisma.click]]) {
  const [all, last30, last12m] = await Promise.all([
    model.count(), model.count({ where: { createdAt: { gte: d30 } } }), model.count({ where: { createdAt: { gte: d365 } } }),
  ]);
  console.log(`  ${name}: 全期間 ${all} / 直近30日 ${last30} / 直近12ヶ月 ${last12m}`);
}

await prisma.$disconnect();
