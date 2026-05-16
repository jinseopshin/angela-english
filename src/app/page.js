"use client";
import dynamic from "next/dynamic";

// SSR 완전 비활성화 - localStorage 기반 앱이므로 클라이언트에서만 렌더
const App = dynamic(() => import("./App"), { ssr: false });

export default function Page() {
  return <App />;
}
