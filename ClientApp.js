"use client";
import dynamic from "next/dynamic";

// SSR 완전 차단 - localStorage hydration mismatch 방지
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #4f8ef7 0%, #a855f7 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: 18,
      fontWeight: 700,
    }}>
      🎀 로딩 중...
    </div>
  ),
});

export default function ClientApp() {
  return <App />;
}
