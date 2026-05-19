"use client";
import { useState, useEffect, useRef } from "react";
import { ALL_WORDS, getWordsByLevel } from "./wordData";
import { recordPronunciation } from "./studentWords";

// ══════════════════════════════════════════════════════════════════════════
//   🎤 발음 챌린지 게임 (Phase 3)
//
//   Web Speech API의 SpeechRecognition으로 학생 발음을 인식.
//   Levenshtein 거리로 정답 단어와 유사도 계산 → 별 1~5점 부여.
//   점수는 student_words 테이블에 누적 저장.
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg: "#f0f7ff", card: "#ffffff", border: "#dce8ff",
  accent: "#4f8ef7", accentLight: "#e8f0ff",
  green: "#22c55e", greenLight: "#dcfce7",
  red: "#ef4444", redLight: "#fee2e2",
  yellow: "#f59e0b", yellowLight: "#fef3c7",
  orange: "#f97316", orangeLight: "#fff7ed",
  purple: "#a855f7", purpleLight: "#f3e8ff",
  pink: "#ec4899", pinkLight: "#fce7f3",
  text: "#1e293b", textMid: "#64748b", textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
  shadowLg: "0 8px 32px rgba(79,142,247,0.18)",
};

// ──────────────────────────────────────────────────────────────────────────
//  Levenshtein 거리 알고리즘 (단어 유사도 측정)
//  반환값: 0~100 (100이면 완벽 일치)
// ──────────────────────────────────────────────────────────────────────────
function calcSimilarity(a, b) {
  const s1 = a.toLowerCase().trim().replace(/[^a-z]/g, "");
  const s2 = b.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const len1 = s1.length, len2 = s2.length;
  const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i-1] === s2[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,        // 삭제
        matrix[i][j-1] + 1,        // 삽입
        matrix[i-1][j-1] + cost,   // 교체
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

// 점수 → 별점 변환
function scoreToStars(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

// 점수 → 메시지 변환
function scoreToMessage(score) {
  if (score >= 90) return { msg: "완벽해요! 🌟", color: T.green };
  if (score >= 75) return { msg: "훌륭해요!", color: T.green };
  if (score >= 60) return { msg: "잘했어요!", color: T.accent };
  if (score >= 40) return { msg: "조금만 더!", color: T.yellow };
  return { msg: "다시 들어볼까요?", color: T.red };
}

// 발음 재생 헬퍼
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// 단어 배열 섞기
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ══════════════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════════════════

export function PronunciationGame({ name, setStudents, student, onExit, levelId = "all" }) {
  const [level, setLevel] = useState(null); // null = 레벨 선택 화면
  const [idx, setIdx] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [results, setResults] = useState([]); // [{word, score, transcript}, ...]
  const [recording, setRecording] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [browserSupport, setBrowserSupport] = useState(true);
  const recognitionRef = useRef(null);
  const awardedRef = useRef(false);

  // 게임에 사용할 단어 10개 (레벨 선택 후)
  const words = level
    ? shuffle(level === "all" ? ALL_WORDS : getWordsByLevel(level)).slice(0, 10)
    : [];

  // 브라우저 지원 체크
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) setBrowserSupport(false);
  }, []);

  // 게임 종료 시 학생 기록 저장 (한 번만)
  useEffect(() => {
    if (awardedRef.current) return;
    if (!level || words.length === 0 || idx < words.length) return;
    awardedRef.current = true;

    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;
    
    // 학생 기록에 저장
    if (setStudents) {
      setStudents(prev => {
        const cur = prev[name] || { name, points: 0, records: [] };
        return {
          ...prev,
          [name]: {
            ...cur,
            points: (cur.points || 0) + Math.round(avgScore / 10),
            records: [...(cur.records || []), {
              type: "game",
              gameType: "발음 챌린지",
              score: avgScore,
              total: 100,
              category: "발음",
              points: Math.round(avgScore / 10),
              date: new Date().toISOString(),
            }].slice(-50),
          }
        };
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, idx, words.length]);

  // 발음 인식 시작
  const startRecording = () => {
    if (recording || !browserSupport) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      setRecording(true);
      setLastResult(null);
    };

    rec.onresult = async (event) => {
      // 여러 후보 중 가장 점수 높은 것 선택
      const alternatives = Array.from(event.results[0]).map(a => a.transcript);
      const target = words[idx].en;
      
      let bestScore = 0;
      let bestTranscript = alternatives[0];
      for (const alt of alternatives) {
        const score = calcSimilarity(alt, target);
        if (score > bestScore) {
          bestScore = score;
          bestTranscript = alt;
        }
      }
      
      const result = { word: words[idx], score: bestScore, transcript: bestTranscript };
      setLastResult(result);
      setResults(prev => [...prev, result]);
      setTotalScore(prev => prev + bestScore);
      
      // Supabase에 발음 점수 기록
      try {
        await recordPronunciation(name, words[idx], bestScore);
      } catch {}
      
      setRecording(false);
    };

    rec.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      setRecording(false);
      if (e.error === "no-speech") {
        setLastResult({ word: words[idx], score: 0, transcript: "(소리가 안 들렸어요)" });
      } else if (e.error === "not-allowed") {
        alert("마이크 권한이 필요해요. 주소창 옆 자물쇠 아이콘에서 허용해주세요!");
      }
    };

    rec.onend = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && recording) {
      try { recognitionRef.current.stop(); } catch {}
    }
  };

  const next = () => {
    setLastResult(null);
    setIdx(idx + 1);
  };

  // ────────────────────────────────────────────────────────────
  //  화면 1: 브라우저 미지원
  // ────────────────────────────────────────────────────────────
  if (!browserSupport) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", color: T.accent, fontSize: 14,
          fontWeight: 700, cursor: "pointer", marginBottom: 16,
        }}>← 종료</button>
        <div style={{
          background: T.yellowLight, borderRadius: 16, padding: 24, textAlign: "center",
          marginTop: 40, color: T.text,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎤</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            발음 인식이 안 되는 브라우저예요
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: T.textMid }}>
            <strong>크롬(Chrome)</strong>이나 <strong>엣지(Edge)</strong> 브라우저로<br/>
            접속하면 발음 챌린지를 즐길 수 있어요!<br/><br/>
            iPhone은 Safari에서도 일부 지원돼요.
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  //  화면 2: 레벨 선택
  // ────────────────────────────────────────────────────────────
  if (!level) {
    const levels = [
      { id: "elementary", icon: "🌱", label: "기초", desc: "초등 기본 단어", bg: T.greenLight, color: T.green },
      { id: "intermediate", icon: "📚", label: "중급", desc: "초등 고학년 단어", bg: T.accentLight, color: T.accent },
      { id: "advanced", icon: "🎓", label: "고급", desc: "중학교 단어", bg: T.purpleLight, color: T.purple },
      { id: "all", icon: "🎲", label: "전체 랜덤", desc: "모든 단어 중에서", bg: T.yellowLight, color: T.yellow },
    ];

    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={onExit} style={{
            background: "none", border: "none", color: T.accent, fontSize: 14,
            fontWeight: 700, cursor: "pointer",
          }}>← 종료</button>
        </div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎤</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>발음 챌린지</div>
          <div style={{ fontSize: 13, color: T.textMid, marginTop: 6, lineHeight: 1.5 }}>
            10단어의 발음을 도전해보세요!<br/>
            🎤 버튼을 누르고 영어로 발음하면 점수가 나와요.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420, margin: "0 auto" }}>
          {levels.map(lv => (
            <div key={lv.id} onClick={() => setLevel(lv.id)} style={{
              background: T.card, borderRadius: 16, padding: 18,
              boxShadow: T.shadow, border: `2px solid ${T.border}`,
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = lv.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; }}>
              <div style={{
                width: 54, height: 54, borderRadius: 14, background: lv.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
              }}>{lv.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{lv.label}</div>
                <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>{lv.desc}</div>
              </div>
              <div style={{ fontSize: 22, color: T.textDim }}>›</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20, padding: 12, background: T.accentLight, borderRadius: 10,
          fontSize: 11, color: T.text, textAlign: "center", lineHeight: 1.6,
        }}>
          💡 <strong>크롬(Chrome) 브라우저</strong>에서 가장 잘 작동해요!<br/>
          처음 사용 시 <strong>마이크 권한</strong>을 허용해주세요.
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  //  화면 3: 게임 종료 (결과 화면)
  // ────────────────────────────────────────────────────────────
  if (idx >= words.length) {
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;
    const totalStars = Math.round(results.reduce((s, r) => s + scoreToStars(r.score), 0));
    const maxStars = words.length * 5;
    
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
        <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>
            {avgScore >= 80 ? "🏆" : avgScore >= 60 ? "🎉" : "💪"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.text }}>
            평균 {avgScore}점
          </div>
          <div style={{ fontSize: 14, color: T.textMid, marginTop: 4 }}>
            획득한 별 ⭐ {totalStars} / {maxStars}
          </div>
          <div style={{
            background: avgScore >= 80 ? T.greenLight : avgScore >= 60 ? T.accentLight : T.yellowLight,
            color: avgScore >= 80 ? T.green : avgScore >= 60 ? T.accent : T.yellow,
            borderRadius: 12, padding: "10px 18px", display: "inline-block",
            marginTop: 12, fontSize: 13, fontWeight: 800,
          }}>
            +{Math.round(avgScore / 10)} 포인트 획득!
          </div>
        </div>

        {/* 결과 상세 */}
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 8, padding: "0 4px" }}>
            📊 단어별 결과
          </div>
          {results.map((r, i) => {
            const stars = scoreToStars(r.score);
            return (
              <div key={i} style={{
                background: T.card, borderRadius: 12, padding: "12px 14px",
                marginBottom: 6, boxShadow: T.shadow,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{r.word.en}</div>
                  <div style={{ fontSize: 10, color: T.textMid }}>
                    인식: "{r.transcript}" · {r.word.ko}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: r.score >= 80 ? T.green : r.score >= 60 ? T.accent : r.score >= 40 ? T.yellow : T.red }}>
                    {r.score}점
                  </div>
                  <div style={{ fontSize: 12 }}>
                    {"⭐".repeat(stars)}{"☆".repeat(5 - stars)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, maxWidth: 320, margin: "20px auto 0" }}>
          <button onClick={() => {
            setLevel(null); setIdx(0); setResults([]); setTotalScore(0); setLastResult(null);
            awardedRef.current = false;
          }} style={{
            flex: 1, background: T.accentLight, color: T.accent,
            border: "none", borderRadius: 12, padding: "12px",
            fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>🔄 다시</button>
          <button onClick={onExit} style={{
            flex: 1, background: T.accent, color: "white",
            border: "none", borderRadius: 12, padding: "12px",
            fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>홈으로</button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  //  화면 4: 게임 진행 중
  // ────────────────────────────────────────────────────────────
  const currentWord = words[idx];
  const message = lastResult ? scoreToMessage(lastResult.score) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", color: T.accent, fontSize: 13,
          fontWeight: 700, cursor: "pointer",
        }}>← 종료</button>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            background: T.accentLight, color: T.accent,
            padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800,
          }}>{idx + 1} / {words.length}</span>
          <span style={{
            background: T.yellowLight, color: T.yellow,
            padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800,
          }}>⭐ {totalScore}점</span>
        </div>
      </div>

      {/* 진도바 */}
      <div style={{ height: 5, background: T.border, borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, transition: "width 0.3s",
          width: `${((idx) / words.length) * 100}%`,
          background: `linear-gradient(90deg, ${T.accent}, ${T.purple})`,
        }} />
      </div>

      {/* 단어 카드 */}
      <div style={{
        background: T.card, borderRadius: 20, padding: "32px 20px",
        textAlign: "center", marginBottom: 16, boxShadow: T.shadowLg,
      }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6, fontWeight: 700 }}>
          이 단어를 발음해보세요
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: T.purple, marginBottom: 4 }}>
          {currentWord.en}
        </div>
        <div style={{ fontSize: 14, color: T.textMid, marginBottom: 16 }}>
          {currentWord.ko}
        </div>
        <button onClick={() => speak(currentWord.en)} style={{
          background: T.accentLight, color: T.accent, border: "none",
          borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 800,
          cursor: "pointer",
        }}>
          🔊 먼저 들어보기
        </button>
      </div>

      {/* 마이크 버튼 (가운데 큰 버튼) */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={!!lastResult}
          style={{
            width: 100, height: 100, borderRadius: "50%",
            background: lastResult ? T.border : recording ? T.red : `linear-gradient(135deg, ${T.purple}, ${T.accent})`,
            color: "white", border: "none",
            fontSize: 44, cursor: lastResult ? "default" : "pointer",
            boxShadow: recording ? "0 0 0 12px rgba(239,68,68,0.2)" : T.shadowLg,
            transition: "all 0.2s",
            animation: recording ? "pulse 1.5s ease-in-out infinite" : "none",
          }}
        >🎤</button>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 10, fontWeight: 700 }}>
          {lastResult ? "결과 확인 후 다음으로!" : recording ? "🔴 듣고 있어요... 말해보세요!" : "마이크 버튼을 누르고 말해보세요"}
        </div>
      </div>

      {/* 인식 결과 */}
      {lastResult && (
        <div style={{
          background: T.card, borderRadius: 16, padding: 16,
          marginBottom: 16, boxShadow: T.shadow,
          border: `2px solid ${message.color}33`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700 }}>인식된 발음</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginTop: 2 }}>
                "{lastResult.transcript}"
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: message.color }}>
                {lastResult.score}점
              </div>
              <div style={{ fontSize: 16, marginTop: 2 }}>
                {"⭐".repeat(scoreToStars(lastResult.score))}{"☆".repeat(5 - scoreToStars(lastResult.score))}
              </div>
            </div>
          </div>
          <div style={{
            background: message.color + "15", color: message.color,
            borderRadius: 8, padding: "8px 12px",
            fontSize: 13, fontWeight: 800, textAlign: "center",
          }}>
            {message.msg}
          </div>
          
          <button onClick={next} style={{
            width: "100%", marginTop: 12,
            background: T.accent, color: "white", border: "none",
            borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>
            {idx === words.length - 1 ? "🏁 결과 보기" : "다음 단어 →"}
          </button>
        </div>
      )}

      {/* 키프레임 애니메이션 (마이크 펄스) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 12px rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 0 20px rgba(239,68,68,0.05); }
        }
      `}</style>
    </div>
  );
}
