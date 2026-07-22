-- AlterTable: 配信チャネル（"mail" | "line"）を追加。既存レコードは NULL（＝直接・不明）のまま
ALTER TABLE "page_views" ADD COLUMN "channel" TEXT;
ALTER TABLE "clicks" ADD COLUMN "channel" TEXT;

-- CreateIndex: 記事ごとのチャネル別集計を高速化
CREATE INDEX "page_views_postId_channel_idx" ON "page_views"("postId", "channel");
CREATE INDEX "clicks_postId_channel_idx" ON "clicks"("postId", "channel");
