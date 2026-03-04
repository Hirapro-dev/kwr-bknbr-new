import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "投資のKAWARA版.com",
  description: "投資に関する最新情報をお届けするブログメディア",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Google Ads: AW-857052394 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-857052394"
          strategy="afterInteractive"
        />
        {/* Google Analytics: G-R0QS0BSSG1 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-R0QS0BSSG1"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-857052394');
            gtag('config', 'G-R0QS0BSSG1');
          `}
        </Script>
        {/* SiTEST */}
        <Script id="sitest-init" strategy="afterInteractive">
          {`
            (function(PID){
              var script = document.createElement("script");
              script.src = "https://tracking.sitest.jp/tag?p=" + PID + "&u=" + encodeURIComponent(location.origin + location.pathname + location.search);
              script.async = true;
              document.head.appendChild(script);
            })("p663c4537de394");
          `}
        </Script>
      </head>
      <body className={`${notoSansJP.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
