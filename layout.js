import "./globals.css";

export const metadata = {
  title: "영어 문제 플랫폼 | 신경은 선생님",
  description: "초·중등 영어 선생님을 위한 문제 출제·편집·출력 플랫폼",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3b6ef8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
