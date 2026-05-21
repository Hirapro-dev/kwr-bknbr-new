import Link from "next/link";

type Props = {
  /** ロゴクリック時の遷移先（未指定時は /wel） */
  homeHref?: string;
};

/** ウェルネス媒体専用ヘッダー（ワインレッド × ゴールド） */
export default function WelHeader({ homeHref = "/wel" }: Props) {
  return (
    <header className="wel-header">
      <div className="wel-header-inner">
        <Link href={homeHref} className="wel-header-title">
          <small>投資のKAWARA版.com</small>
          “次世代ウェルネス”×“資産形成”戦略通信
        </Link>
      </div>
    </header>
  );
}
