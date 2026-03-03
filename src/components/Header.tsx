import Link from "next/link";
import Image from "next/image";

type HeaderProps = {
  variant?: "default" | "full";
  /** ロゴのリンク先（未指定時は /） */
  homeHref?: string;
};

export default function Header({ variant = "default", homeHref = "/" }: HeaderProps) {
  const showContact = homeHref === "/";
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#bbb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center justify-between gap-2">
          <Link href={homeHref} className="flex items-center shrink min-w-0">
            <Image
              src={variant === "full" ? "/header_logo_v.png" : "/header_logo.png"}
              alt="投資のiPSマーケット.com"
              width={200}
              height={40}
              className="h-8 sm:h-10 w-auto max-w-[250px] sm:max-w-none object-contain object-left"
              priority
            />
          </Link>

          {showContact && (
            <a
              href="https://kawaraban.co.jp/form/contactall/"
              target="_blank"
              rel="noopener noreferrer"
              className={`btn btn-c shrink-0 whitespace-nowrap ${variant === "full" ? "btn-c-header--full" : ""}`}
            >
              お問合わせ
              <span className="btn-c-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="1.6rem" height="1.6rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
