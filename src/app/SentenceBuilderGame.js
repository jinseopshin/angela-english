"use client";
import { useState, useEffect, useMemo } from "react";
import { T, Btn, Card } from "./theme";
import { onCorrect, onWrong, onFinish, playClick, isSoundEnabled } from "./soundEffects";
import { useAngela, getComboReaction, getFinishReaction, FullScreenConfetti } from "./AngelaMascot";
import { getAvailableSentencesForStudent, DIFFICULTY_LABELS } from "./sentenceBuilderData";

// ══════════════════════════════════════════════════════════════════════════
//   📝 SentenceBuilderGame.js — 문장 만들기 게임 (학생용)
//
//   - 선생님이 출제한 문장을 단어 카드로 풀기
//   - 단어 클릭 순서대로 → 문장 완성
//   - 한글 뜻 표시 (힌트)
//   - 이미지 있으면 표시 (선택적)
//   - 되돌리기 / 정답 확인 / 다음 문제
// ══════════════════════════════════════════════════════════════════════════

// TTS 영어 발음
function speakEN(text, rate = 0.85) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!isSoundEnabled()) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = rate;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// Fisher-Yates 셔플
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 진도 저장
function saveProgress(studentName, score, total) {
  if (typeof window === "undefined" || !studentName) return;
  try {
    const key = `phonics_progress_${studentName}`;
    const stored = JSON.parse(window.localStorage.getItem(key) || "{}");
    const recordKey = "sentence-builder_play";
    const prev = stored[recordKey] || { plays: 0 };
    const stars = total > 0 ? (score / total >= 0.9 ? 3 : score / total >= 0.7 ? 2 : score / total >= 0.5 ? 1 : 0) : 0;
    stored[recordKey] = {
      bestStars: Math.max(prev.bestStars || 0, stars),
      lastScore: score,
      lastTotal: total,
      plays: prev.plays + 1,
      lastPlayed: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════
//   메인 메뉴: 학생에게 배정된/공개된 문장 목록 표시
// ══════════════════════════════════════════════════════════════════════════
export function SentenceBuilderMenu({ studentName, onExit }) {
  const [started, setStarted] = useState(false);
  const sentences = useMemo(() => getAvailableSentencesForStudent(studentName), [studentName]);

  if (sentences.length === 0) {
    return (
      <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onExit} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
          }}>← 뒤로</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>📝 문장 만들기</div>
            <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>섞인 단어로 문장을 완성해요</div>
          </div>
        </div>

        <div style={{
          padding: 40, textAlign: "center", marginTop: 40,
          background: T.card, borderRadius: 20, border: `2px solid ${T.border}`
        }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>
            아직 풀 문장이 없어요
          </div>
          <div style={{ fontSize: 12, color: T.textMid }}>
            선생님이 문제를 출제하면 여기에 나타나요
          </div>
        </div>
      </div>
    );
  }

  if (started) {
    return (
      <SentenceBuilderPlay
        studentName={studentName}
        sentences={sentences}
        onExit={() => setStarted(false)}
        onFinalExit={onExit}
      />
    );
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onExit} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>📝 문장 만들기</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>섞인 단어로 문장을 완성해요</div>
        </div>
      </div>

      <Card style={{
        padding: 20, marginBottom: 16,
        background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
        color: "white", border: "none"
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>
          🎯 {sentences.length}개 문장 준비됨
        </div>
        <div style={{ fontSize: 11, opacity: 0.95 }}>
          섞여있는 단어를 올바른 순서로 클릭해서 문장을 완성하세요!
        </div>
      </Card>

      <button onClick={() => { playClick(); setStarted(true); }}
        style={{
          width: "100%", padding: 20, background: T.green,
          color: "white", border: "none", borderRadius: 16,
          fontSize: 18, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)"
        }}>
        🚀 시작하기
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   게임 실행 컴포넌트
// ══════════════════════════════════════════════════════════════════════════
function SentenceBuilderPlay({ studentName, sentences, onExit, onFinalExit }) {
  const [rounds] = useState(() => shuffle(sentences).slice(0, Math.min(10, sentences.length)));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [built, setBuilt] = useState([]);     // [{id, word}] 클릭한 단어 (순서대로)
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [done, setDone] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = rounds[idx];

  // 단어 카드 (id 부여, 셔플)
  // 같은 단어가 두 번 나올 수 있으니 id로 구분
  const wordCards = useMemo(() => {
    if (!current?.words) return [];
    const cards = current.words.map((word, i) => ({
      id: `w${i}`,
      word,
      originalIdx: i,
    }));
    return shuffle(cards);
  }, [current]);

  // 라운드 시작 시 초기화
  useEffect(() => {
    setBuilt([]);
    setFeedback(null);
  }, [idx]);

  const handleWordClick = (card) => {
    if (feedback) return;
    if (built.some(b => b.id === card.id)) return; // 이미 선택됨
    playClick();
    const next = [...built, card];
    setBuilt(next);

    // 모든 단어 선택 완료 → 정답 체크
    if (next.length === current.words.length) {
      const userOrder = next.map(c => c.word).join(" ");
      const correctOrder = current.words.join(" ");
      const isCorrect = userOrder === correctOrder;

      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
        onCorrect();
        const newCombo = combo + 1;
        setCombo(newCombo);
        setScore(s => s + 1);
        setTimeout(() => speakEN(current.english, 0.85), 300);
        if (newCombo >= 3) {
          setTimeout(() => angela.show(getComboReaction(newCombo)), 500);
        } else {
          setTimeout(() => angela.show("correct"), 500);
        }
      } else {
        onWrong();
        setCombo(0);
        setTimeout(() => angela.show("wrong"), 200);
      }

      // 다음 문제로
      setTimeout(() => {
        if (idx < rounds.length - 1) {
          setIdx(i => i + 1);
        } else {
          const final = score + (isCorrect ? 1 : 0);
          setDone(true);
          saveProgress(studentName, final, rounds.length);
          onFinish(final, rounds.length);
          setTimeout(() => angela.show(getFinishReaction(final, rounds.length)), 500);
          if (final / rounds.length >= 0.8) setConfettiTrigger(t => t + 1);
        }
      }, 2200);
    }
  };

  const undo = () => {
    if (feedback) return;
    playClick();
    setBuilt(prev => prev.slice(0, -1));
  };

  const reset = () => {
    if (feedback) return;
    playClick();
    setBuilt([]);
  };

  if (done) {
    const stars = score / rounds.length >= 0.9 ? 3 : score / rounds.length >= 0.7 ? 2 : score / rounds.length >= 0.5 ? 1 : 0;
    const ratio = rounds.length > 0 ? score / rounds.length : 0;
    let message, mainEmoji;
    if (ratio === 1.0) { message = "완벽해요! 정말 잘했어요!"; mainEmoji = "🏆"; }
    else if (ratio >= 0.8) { message = "아주 잘했어요!"; mainEmoji = "🌟"; }
    else if (ratio >= 0.5) { message = "잘했어요! 더 연습해봐요"; mainEmoji = "😊"; }
    else { message = "괜찮아요, 다시 도전해봐요!"; mainEmoji = "💪"; }

    return (
      <div style={{ padding: 14, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <FullScreenConfetti trigger={confettiTrigger} />
        <div style={{
          background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
          color: "white", borderRadius: 28, padding: "40px 24px", marginTop: 40
        }}>
          <div style={{ fontSize: 96, marginBottom: 12 }}>{mainEmoji}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{message}</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 20 }}>
            {score} / {rounds.length} 맞췄어요
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24 }}>
            {[1, 2, 3].map(i => (
              <span key={i} style={{
                fontSize: 60,
                opacity: stars >= i ? 1 : 0.3,
                filter: stars >= i ? "drop-shadow(0 0 12px rgba(255,255,255,0.8))" : "none",
              }}>⭐</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onExit} style={{
            flex: 1, padding: 14, background: T.card,
            color: T.text, border: `2px solid ${T.border}`, borderRadius: 14,
            fontSize: 13, fontWeight: 800, cursor: "pointer"
          }}>
            다시 도전
          </button>
          <button onClick={onFinalExit} style={{
            flex: 1, padding: 14, background: T.accent,
            color: "white", border: "none", borderRadius: 14,
            fontSize: 13, fontWeight: 800, cursor: "pointer"
          }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div>문장이 없어요</div>
        <button onClick={onExit}>← 뒤로</button>
      </div>
    );
  }

  const difficulty = DIFFICULTY_LABELS[current.difficulty] || DIFFICULTY_LABELS.medium;
  const isAnswered = feedback !== null;

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <angela.AngelaComponent />

      {/* 헤더 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={onExit} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.textMid
          }}>← 그만</button>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 900, color: T.text }}>
            📝 문장 만들기
          </div>
          {combo > 0 && (
            <div style={{
              background: combo >= 3 ? T.orange : T.accent, color: "white",
              padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 900
            }}>
              🔥 {combo}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${((idx + 1) / rounds.length) * 100}%`, height: "100%",
              background: T.accent, transition: "width 0.3s"
            }} />
          </div>
          <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700 }}>
            {idx + 1}/{rounds.length}
            <span style={{ marginLeft: 6, color: T.green }}>· ⭐ {score}</span>
          </div>
        </div>
      </div>

      {/* 문제 카드 */}
      <div style={{
        background: T.card, borderRadius: 24, padding: "24px 20px",
        marginBottom: 16, border: `2px solid ${T.border}`,
        textAlign: "center"
      }}>
        {/* 난이도 뱃지 */}
        <div style={{
          display: "inline-block", marginBottom: 12,
          padding: "4px 12px", borderRadius: 12,
          background: difficulty.bg, color: difficulty.color,
          fontSize: 11, fontWeight: 800
        }}>
          {difficulty.label}
        </div>

        {/* 이미지 (있는 경우) */}
        {current.imageUrl && (
          <div style={{
            width: "100%", maxWidth: 320, height: 180,
            margin: "0 auto 14px",
            borderRadius: 12, overflow: "hidden",
            background: T.bg
          }}>
            <img
              src={current.imageUrl}
              alt="문장 그림"
              loading="lazy"
              style={{
                width: "100%", height: "100%", objectFit: "contain"
              }}
            />
          </div>
        )}

        {/* 한글 뜻 (힌트) */}
        <div style={{
          fontSize: 18, fontWeight: 800, color: T.text,
          marginBottom: 8
        }}>
          {current.korean}
        </div>
        <div style={{ fontSize: 11, color: T.textMid }}>
          위 뜻에 맞게 영어 단어를 순서대로 클릭하세요
        </div>
      </div>

      {/* 만들고 있는 문장 (정답 칸) */}
      <div style={{
        background: feedback === "correct" ? "#dcfce7" : feedback === "wrong" ? "#fee2e2" : T.bg,
        borderRadius: 16, padding: 16,
        marginBottom: 14,
        minHeight: 70,
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "center",
        border: `2px dashed ${feedback === "correct" ? T.green : feedback === "wrong" ? T.red : T.border}`,
        transition: "all 0.3s"
      }}>
        {built.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>
            아래 단어를 클릭하세요 ↓
          </div>
        ) : (
          built.map((card, i) => (
            <div key={i} style={{
              padding: "8px 14px",
              background: feedback === "correct" ? T.green : feedback === "wrong" ? T.red : T.accent,
              color: "white",
              borderRadius: 10, fontSize: 16, fontWeight: 700,
              animation: "fadeIn 0.2s"
            }}>
              {card.word}
            </div>
          ))
        )}
      </div>

      {/* 정답 시: 영어 문장 + 발음 */}
      {feedback === "correct" && (
        <div style={{
          background: "#dcfce7", color: T.green,
          padding: "10px 14px", borderRadius: 12,
          marginBottom: 14, textAlign: "center",
          fontSize: 14, fontWeight: 800
        }}>
          ✅ 정답! 🔊 {current.english}
        </div>
      )}
      {feedback === "wrong" && (
        <div style={{
          background: "#fee2e2", color: T.red,
          padding: "10px 14px", borderRadius: 12,
          marginBottom: 14, textAlign: "center",
          fontSize: 13, fontWeight: 800
        }}>
          정답: <strong style={{ fontSize: 15 }}>{current.english}</strong>
        </div>
      )}

      {/* 단어 카드 (선택 가능) */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center"
      }}>
        {wordCards.map(card => {
          const used = built.some(b => b.id === card.id);
          return (
            <button key={card.id} onClick={() => handleWordClick(card)}
              disabled={used || isAnswered}
              style={{
                padding: "12px 18px",
                background: used ? T.border : T.card,
                color: used ? T.textDim : T.text,
                border: `2px solid ${used ? T.border : T.accent}`,
                borderRadius: 12,
                fontSize: 18, fontWeight: 700,
                cursor: used || isAnswered ? "default" : "pointer",
                opacity: used ? 0.4 : 1,
                transition: "all 0.2s"
              }}>
              {card.word}
            </button>
          );
        })}
      </div>

      {/* 컨트롤 버튼 */}
      {built.length > 0 && !isAnswered && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
          <button onClick={undo} style={{
            background: "transparent", color: T.textMid,
            border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
            cursor: "pointer"
          }}>
            ← 되돌리기
          </button>
          <button onClick={reset} style={{
            background: "transparent", color: T.red,
            border: `1px solid ${T.red}`, borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
            cursor: "pointer"
          }}>
            🔄 처음부터
          </button>
        </div>
      )}
    </div>
  );
}
