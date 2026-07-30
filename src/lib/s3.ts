import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * S3 に画像をアップロードし、公開URLを返す
 */
export async function uploadToS3(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `uploads/${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * ブラウザから S3 へ直接PUTするための署名付きURLを発行する。
 *
 * 動画はサーバー経由にするとVercel Functionsのボディ上限（100MB）とメモリを食うため、
 * ブラウザ → S3 の直接アップロードにしている。
 * ※この方式にはS3バケット側のCORS設定（PUT許可）が必要。
 *
 * 保存先は画像と同じ uploads/ 配下にする。バケットの公開読み取り設定が
 * すでに uploads/ に効いているため、動画だけ別プレフィックスにすると
 * 再生時に403になりかねない。
 *
 * @returns uploadUrl … このURLにPUTでファイル本体を送る（1時間有効）
 *          publicUrl … アップロード後に記事へ埋め込む公開URL
 */
export async function createPresignedUploadUrl(
  filename: string,
  contentType: string,
  prefix = "uploads"
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const key = `${prefix}/${filename}`;

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    // 大きい動画は回線が細いとアップロードに時間がかかるため長めに取る。
    // 期限はS3がリクエストを受け付けた時点で判定されるので、開始できれば途中で切れることはない。
    { expiresIn: 3600 }
  );

  return {
    uploadUrl,
    publicUrl: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

/**
 * S3 から画像を削除する
 */
export async function deleteFromS3(imageUrl: string): Promise<void> {
  // URLからS3のキーを抽出
  const url = new URL(imageUrl);
  const key = url.pathname.slice(1); // 先頭の "/" を除去

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
