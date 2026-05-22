"use client";
import { useState, useEffect } from "react";
import { T } from "./theme";
import { getPronunciationStats } from "./studentWords";

// ══════════════════════════════════════════════════════════════════════════
//   🎤 이번 주 발음 위젯 (학생 홈용)
//
//   학생 홈에 작은 카드로 표시.
//   평균 발음 점수와 "발음 챌린지 시작" 버튼 제공.
//   발음 기록이 없으면 숨김.
// ══════════════════════════════════════════════════════════════════════════

// (T는 ./theme 에서 import)

export function PronunciationWidget({ studentName, onStart }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getPronunciationStats(studentName);
      if (!cancelled) {
        setStats(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  // 로딩 중이거나 기록이 없으면 숨김
  if (loading || !stats || stats.count === 0) return null;

  const scoreColor = stats.avg >= 80 ? T.green : stats.avg >= 60 ? T.accent : T.yellow;
  const emoji = stats.avg >= 80 ? "🏆" : stats.avg >= 60 ? "🎯" : "💪";
  const message = stats.avg >= 80 ? "발음 마스터!" : stats.avg >= 60 ? "잘하고 있어요" : "더 연습해봐요";

  return (
    <div onClick={onStart} style={{
      background: `linear-gradient(135deg, ${T.purple} 0%, ${T.accent} 100%)`,
      borderRadius: T.radiusLg, padding: "14px 16px", marginBottom: 14,
      color: "white", cursor: "pointer", boxShadow: T.shadow,
      transition: "transform 0.15s",
    }}
    onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
    onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🎤</div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>내 발음 점수</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{stats.avg}<span style={{ fontSize: 12, opacity: 0.85 }}>점</span></div>
              <div style={{ fontSize: 18 }}>{emoji}</div>
            </div>
          </div>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.25)",
          borderRadius: T.radiusSm, padding: "6px 12px",
          fontSize: 12, fontWeight: 900,
        }}>
          도전 →
        </div>
      </div>
      <div style={{
        marginTop: 8, fontSize: 11, opacity: 0.9, lineHeight: 1.5,
      }}>
        {message} · {stats.count}개 단어 도전 중
        {stats.weakWords && stats.weakWords.length > 0 && (
          <span> · 약한 단어 {stats.weakWords.length}개 보강 필요!</span>
        )}
      </div>
    </div>
  );
}
