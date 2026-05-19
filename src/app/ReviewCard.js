"use client";
import { useState, useEffect } from "react";
import { getTodayReviewWords } from "./studentWords";

// ══════════════════════════════════════════════════════════════════════════
//   🔔 오늘의 복습 카드 (Phase 2: 망각 곡선)
//
//   학생 홈 상단에 표시되는 카드.
//   getTodayReviewWords()로 오늘 복습할 단어를 가져와서 보여줍니다.
//   복습할 단어가 없으면 카드 자체가 숨겨집니다.
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg: "#f0f7ff", card: "#ffffff", border: "#dce8ff",
  accent: "#4f8ef7", accentLight: "#e8f0ff",
  green: "#22c55e", greenLight: "#dcfce7",
  yellow: "#f59e0b", yellowLight: "#fef3c7",
  orange: "#f97316", orangeLight: "#fff7ed",
  red: "#ef4444",
  purple: "#a855f7",
  text: "#1e293b", textMid: "#64748b", textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
};

export function ReviewCard({ studentName, onStartReview }) {
  const [reviewWords, setReviewWords] = useState([]);
  const [loading, setLoading] = useState(true);

  // 마운트 시 오늘 복습 단어 가져오기
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const words = await getTodayReviewWords(studentName, 50);
      if (!cancelled) {
        setReviewWords(words);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  // 로딩 중이거나 복습 단어가 없으면 카드 자체를 숨김
  if (loading || reviewWords.length === 0) return null;

  // 난이도별 색상 (오래된 복습일수록 빨갛게)
  const today = new Date().toISOString().slice(0, 10);
  const overdue = reviewWords.filter(w => w.nextReviewDate && w.nextReviewDate < today).length;
  const dueToday = reviewWords.filter(w => w.nextReviewDate === today).length;
  
  // 색상 결정: 밀린 복습이 많으면 빨강 톤, 오늘 거만 있으면 파랑 톤
  const isUrgent = overdue >= 5;
  const gradient = isUrgent
    ? `linear-gradient(135deg, ${T.red} 0%, ${T.orange} 100%)`
    : `linear-gradient(135deg, ${T.orange} 0%, ${T.yellow} 100%)`;

  // 레벨별 통계
  const levelCounts = [0, 0, 0, 0, 0, 0]; // 0~5
  reviewWords.forEach(w => {
    levelCounts[w.reviewLevel || 0]++;
  });

  return (
    <div onClick={() => onStartReview && onStartReview(reviewWords)} style={{
      background: gradient,
      borderRadius: 16, padding: "16px 18px", marginBottom: 14,
      color: "white", cursor: "pointer", boxShadow: T.shadow,
      transition: "transform 0.15s",
    }}
    onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
    onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    onTouchStart={e => e.currentTarget.style.transform = "scale(0.98)"}
    onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 32 }}>🔔</div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>
              {isUrgent ? "💡 오늘 꼭 복습해요!" : "📚 오늘의 복습"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
              {reviewWords.length}<span style={{ fontSize: 14, opacity: 0.85, marginLeft: 4 }}>단어</span>
            </div>
          </div>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.25)",
          borderRadius: 12, padding: "8px 14px",
          fontSize: 13, fontWeight: 900,
        }}>
          시작 →
        </div>
      </div>

      {/* 진행 상황 미리보기 */}
      <div style={{
        background: "rgba(255,255,255,0.2)",
        borderRadius: 10, padding: "8px 12px",
        fontSize: 11, fontWeight: 700,
      }}>
        {overdue > 0 && <span>⏰ 밀린 복습 {overdue}개 · </span>}
        {dueToday > 0 && <span>📅 오늘 복습 {dueToday}개</span>}
        {levelCounts[5] > 0 && <span style={{ opacity: 0.85 }}> · 🏆 {levelCounts[5]}개 마스터 단어 점검</span>}
      </div>

      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 8, lineHeight: 1.4 }}>
        💡 정답 맞히면 다음 복습이 더 멀리 잡혀요. 외울수록 간격이 길어져요!
      </div>
    </div>
  );
}
