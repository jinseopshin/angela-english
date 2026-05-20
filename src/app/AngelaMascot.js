"use client";
import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════════════════
//   🦊 Angela Mascot — 학습 도우미 마스코트
//   - 상황별로 등장해서 격려/축하/위로 메시지 표시
//   - 화면 우측 하단에서 슬라이드 인 / 사라짐
//   - useAngela 훅으로 어디서든 호출 가능
// ══════════════════════════════════════════════════════════════════════════

// 마스코트 표정 라이브러리 (상황 → 이모지 + 메시지)
export const ANGELA_REACTIONS = {
  // 게임 시작
  start: [
    { emoji: "👋", msg: "Let's go!" },
    { emoji: "🎯", msg: "Ready!" },
    { emoji: "💪", msg: "You got this!" },
  ],
  // 첫 정답
  firstCorrect: [
    { emoji: "😊", msg: "Good start!" },
    { emoji: "👍", msg: "Nice one!" },
    { emoji: "✨", msg: "Off to a great start!" },
  ],
  // 일반 정답
  correct: [
    { emoji: "😊", msg: "Good!" },
    { emoji: "👍", msg: "Nice!" },
    { emoji: "✨", msg: "Excellent!" },
    { emoji: "🎯", msg: "Bullseye!" },
  ],
  // 오답
  wrong: [
    { emoji: "🤔", msg: "Almost!" },
    { emoji: "💪", msg: "Try again!" },
    { emoji: "🌱", msg: "Keep going!" },
    { emoji: "😌", msg: "It's okay!" },
  ],
  // 오답 후 다시 정답 (멋진 회복)
  recovery: [
    { emoji: "💪", msg: "Great recovery!" },
    { emoji: "🔥", msg: "You bounced back!" },
    { emoji: "👏", msg: "Way to come back!" },
  ],
  // 3 콤보
  combo3: [
    { emoji: "🔥", msg: "On fire!" },
    { emoji: "⚡", msg: "Hot streak!" },
    { emoji: "🎉", msg: "Combo!" },
  ],
  // 5 콤보
  combo5: [
    { emoji: "🌟", msg: "Amazing!" },
    { emoji: "💥", msg: "Awesome!" },
    { emoji: "🚀", msg: "You're flying!" },
  ],
  // 7 콤보
  combo7: [
    { emoji: "💪", msg: "Incredible!" },
    { emoji: "⭐", msg: "Super star!" },
    { emoji: "🏆", msg: "Champion!" },
  ],
  // 10 콤보
  combo10: [
    { emoji: "👑", msg: "Unstoppable!" },
    { emoji: "💎", msg: "Diamond level!" },
    { emoji: "🎆", msg: "MEGA COMBO!" },
  ],
  // 15 콤보 (전설)
  combo15: [
    { emoji: "👑✨", msg: "LEGENDARY!" },
    { emoji: "🌈", msg: "MYTHIC!" },
    { emoji: "🎇", msg: "GODLIKE!" },
  ],
  // 게임 완료 - 만점
  perfect: [
    { emoji: "🏆", msg: "Perfect score!" },
    { emoji: "💯", msg: "100% AMAZING!" },
    { emoji: "👑", msg: "You're a CHAMPION!" },
  ],
  // 게임 완료 - 좋음 (80%+)
  great: [
    { emoji: "🎉", msg: "Well done!" },
    { emoji: "🌟", msg: "Great job!" },
    { emoji: "👏", msg: "Excellent work!" },
  ],
  // 게임 완료 - 보통 (50-80%)
  good: [
    { emoji: "👍", msg: "Good effort!" },
    { emoji: "💪", msg: "Keep practicing!" },
    { emoji: "🌱", msg: "Growing strong!" },
  ],
  // 게임 완료 - 격려 (50% 미만)
  encourage: [
    { emoji: "🌱", msg: "Keep going!" },
    { emoji: "💪", msg: "Don't give up!" },
    { emoji: "🌟", msg: "You'll get it!" },
  ],
};

// 무작위 메시지 선택
function pickReaction(type) {
  const reactions = ANGELA_REACTIONS[type] || ANGELA_REACTIONS.correct;
  return reactions[Math.floor(Math.random() * reactions.length)];
}

// ══════════════════════════════════════════════════════════════════════════
//   AngelaMascot 컴포넌트
//   - position: "right" (기본) | "left" | "top-center"
//   - reaction: ANGELA_REACTIONS의 key
//   - trigger: 변경되면 마스코트 표시 (number, e.g., Date.now())
//   - duration: 표시 시간 ms (기본 2000)
// ══════════════════════════════════════════════════════════════════════════
export function AngelaMascot({
  reaction = "correct",
  trigger = 0,
  position = "right",
  duration = 2000,
  size = "md",  // sm | md | lg
}) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (trigger === 0) return;
    // 새 메시지 선택
    const r = pickReaction(reaction);
    setCurrent(r);
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), duration);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [trigger, reaction, duration]);

  if (!current) return null;

  // 위치 스타일
  const positions = {
    right: { right: 16, bottom: 80, transform: visible ? "translateX(0) scale(1)" : "translateX(120%) scale(0.5)" },
    left: { left: 16, bottom: 80, transform: visible ? "translateX(0) scale(1)" : "translateX(-120%) scale(0.5)" },
    "top-center": { left: "50%", top: 80, transform: visible ? "translate(-50%, 0) scale(1)" : "translate(-50%, -120%) scale(0.5)" },
  };

  // 크기 설정
  const sizes = {
    sm: { mascotSize: 40, fontSize: 20, msgSize: 11, padding: "6px 10px" },
    md: { mascotSize: 56, fontSize: 30, msgSize: 13, padding: "8px 14px" },
    lg: { mascotSize: 72, fontSize: 40, msgSize: 15, padding: "10px 18px" },
  };

  const sz = sizes[size] || sizes.md;
  const pos = positions[position] || positions.right;

  // 콤보 등급에 따라 색상 변경
  const isHighCombo = reaction === "combo10" || reaction === "combo15" || reaction === "perfect";
  const isMedCombo = reaction === "combo5" || reaction === "combo7" || reaction === "great";
  const bg = isHighCombo
    ? "linear-gradient(135deg, #fbbf24, #ef4444)"
    : isMedCombo
    ? "linear-gradient(135deg, #f59e0b, #ec4899)"
    : "linear-gradient(135deg, #4f8ef7, #a855f7)";

  return (
    <div style={{
      position: "fixed",
      ...pos,
      zIndex: 9990,
      pointerEvents: "none",
      transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s",
      opacity: visible ? 1 : 0,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      {/* 마스코트 캐릭터 */}
      <div style={{
        width: sz.mascotSize,
        height: sz.mascotSize,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: sz.fontSize,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.5)",
        animation: visible ? "angela-bounce 0.6s ease-out" : "none",
      }}>
        {current.emoji}
      </div>

      {/* 말풍선 */}
      <div style={{
        background: "white",
        color: "#1e293b",
        padding: sz.padding,
        borderRadius: 14,
        fontSize: sz.msgSize,
        fontWeight: 800,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        whiteSpace: "nowrap",
        position: "relative",
      }}>
        {/* 말풍선 꼬리 (왼쪽 방향) */}
        <div style={{
          position: "absolute",
          left: -6,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderRight: "8px solid white",
        }} />
        {current.msg}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   useAngela 훅 — 간편 사용
//   const angela = useAngela();
//   angela.show("correct");  // 정답 반응
//   angela.show("combo5");   // 5콤보 반응
// ══════════════════════════════════════════════════════════════════════════
export function useAngela() {
  const [trigger, setTrigger] = useState(0);
  const [reaction, setReaction] = useState("correct");

  const show = (reactionType) => {
    setReaction(reactionType);
    setTrigger(Date.now());
  };

  return {
    show,
    trigger,
    reaction,
    AngelaComponent: (props) => (
      <AngelaMascot
        trigger={trigger}
        reaction={reaction}
        {...props}
      />
    ),
  };
}

// ══════════════════════════════════════════════════════════════════════════
//   콤보 횟수 → 적절한 reaction 자동 선택 헬퍼
// ══════════════════════════════════════════════════════════════════════════
export function getComboReaction(comboCount) {
  if (comboCount >= 15) return "combo15";
  if (comboCount >= 10) return "combo10";
  if (comboCount >= 7) return "combo7";
  if (comboCount >= 5) return "combo5";
  if (comboCount >= 3) return "combo3";
  return "correct";
}

// 점수 비율 → 게임 종료 reaction 자동 선택
export function getFinishReaction(score, total) {
  if (total === 0) return "good";
  const ratio = score / total;
  if (ratio === 1.0) return "perfect";
  if (ratio >= 0.8) return "great";
  if (ratio >= 0.5) return "good";
  return "encourage";
}
