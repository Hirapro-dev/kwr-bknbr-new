-- 記事の日付表示フラグを追加。デフォルトは true（表示）。
ALTER TABLE "posts" ADD COLUMN "showDate" BOOLEAN NOT NULL DEFAULT true;
