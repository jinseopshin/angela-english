"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { ALL_WORDS, WORD_LEVELS, getWordsByLevel } from "./wordData";
import { recordWordEncounter, addToWordbook, removeFromWordbook, isInWordbook } from "./studentWords";
import { updateWordMastery } from "./features";
import {
  T, MARKS, uid, shuffle, speak,
  Btn, Tag, Card, Input, saveStudentRecord
} from "./theme";

// ══════════════════════════════════════════════════════════════════════════
//   🎮 CORE GAMES — 4개 핵심 학습 게임
//   - WordMatchGame: 단어 맞추기 (한↔영)
//   - SpellingGame:  스펠링 입력
//   - SpeedQuiz:     10초 스피드 퀴즈
//   - FlashCard:     플래시카드 (발음 자동)
//   - LevelSelect:   게임 시작 전 레벨 선택 화면
// ══════════════════════════════════════════════════════════════════════════

// 게임에서 사용할 단어 풀 결정:
//  - levelId === "homework"이면 학생의 활성 단어 숙제(미마스터 단어) 사용
//  - levelId === "review"이면 망각 곡선 복습 단어
//  - 그 외엔 기존처럼 levelId로 단어 가져오기
export function getGameWordPool(levelId, student) {
  if (levelId === "homework") {
    const hw = student?.wordHomework;
    if (hw?.active && hw.words?.length) {
      const notMastered = hw.words.filter(w => !w.mastered);
      return notMastered.length > 0 ? notMastered : hw.words;
    }
  }
  if (levelId === "review" && student?.reviewWords?.length) {
    return student.reviewWords;
  }
  return getWordsByLevel(levelId);
}

// ──────────────────────────────────────────────────────────────────────────
// 게임 1: 단어 맞추기 (방향 선택 가능)
// ──────────────────────────────────────────────────────────────────────────
const MATCH_MODES = [
  { id: "ko2en", label: "한글 → 영어", desc: "한글 보고 영단어 고르기", icon: "🇰🇷→🇺🇸", question: "ko", answer: "en" },
  { id: "en2ko", label: "영어 → 한글", desc: "영단어 보고 뜻 고르기",   icon: "🇺🇸→🇰🇷", question: "en", answer: "ko" },
  { id: "mixed", label: "랜덤 섞기",   desc: "두 방향이 랜덤으로 섞여요", icon: "🔀",      question: "mixed", answer: "mixed" },
];

export function WordMatchGame({ name, setStudents, student, onExit, levelId = "all" }) {
  const [mode, setMode] = useState(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [wrongWord, setWrongWord] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const awardedRef = useRef(false);

  const questions = useMemo(() => {
    if (!mode) return [];
    const pool = getGameWordPool(levelId, student);
    const picked = shuffle(pool).slice(0, 10);
    return picked.map(w => {
      const dir = mode.id === "mixed"
        ? (Math.random() < 0.5 ? "ko2en" : "en2ko")
        : mode.id;
      const qField = dir === "ko2en" ? "ko" : "en";
      const aField = dir === "ko2en" ? "en" : "ko";
      const wrongs = shuffle(pool.filter(x => x.en !== w.en)).slice(0, 3);
      const opts = shuffle([w, ...wrongs]);
      return {
        ...w, dir, qField, aField,
        opts, ansIdx: opts.findIndex(o => o.en === w.en)
      };
    });
  }, [mode, levelId, student?.wordHomework]);

  // ⭐ 단어장 등록 여부 — 문제가 바뀔 때마다 자동 체크
  useEffect(() => {
    const q = questions[round];
    if (!q) { setIsFav(false); return; }
    let cancelled = false;
    isInWordbook(name, q.en).then(result => {
      if (!cancelled) setIsFav(result);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, questions]);

  const toggleFav = async () => {
    const q = questions[round];
    if (favLoading || !q) return;
    setFavLoading(true);
    if (isFav) {
      await removeFromWordbook(name, q.en);
      setIsFav(false);
    } else {
      await addToWordbook(name, q);
      setIsFav(true);
    }
    setFavLoading(false);
  };

  // 게임 종료 시 점수 저장
  useEffect(() => {
    if (!mode || awardedRef.current) return;
    if (questions.length === 0 || round < questions.length) return;
    awardedRef.current = true;
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: `단어맞추기(${mode.label})`,
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 10
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, round, questions.length]);

  // 방향 선택 화면
  if (!mode) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        </div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>단어 맞추기</div>
          <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>어떤 방향으로 공부할까요?</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400, margin: "0 auto" }}>
          {MATCH_MODES.map(m => (
            <Card key={m.id} onClick={() => setMode(m)} style={{
              padding: 20, display: "flex", alignItems: "center", gap: 16,
              border: `2px solid ${T.border}`, cursor: "pointer"
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: m.id === "ko2en" ? T.accentLight : m.id === "en2ko" ? T.greenLight : T.yellowLight,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900,
                color: m.id === "ko2en" ? T.accent : m.id === "en2ko" ? T.green : T.yellow
              }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: T.textMid }}>{m.desc}</div>
              </div>
              <div style={{ fontSize: 22, color: T.textDim }}>›</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 게임 종료
  if (round >= questions.length) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>{score >= 8 ? "🎉" : score >= 5 ? "👏" : "💪"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, marginBottom: 6 }}>{score} / {questions.length}</div>
        <div style={{ fontSize: 14, color: T.textMid, marginBottom: 6 }}>
          {score >= 8 ? "정말 잘했어요!" : score >= 5 ? "좋아요!" : "다시 도전해봐요!"}
        </div>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 20 }}>모드: {mode.label}</div>
        <Card style={{ maxWidth: 320, margin: "0 auto 14px", background: T.yellowLight }}>
          <div style={{ fontSize: 32 }}>⭐</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>+{score * 10} 포인트 획득!</div>
        </Card>
        <div style={{ display: "flex", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <Btn v="secondary" size="lg" onClick={() => { setMode(null); setRound(0); setScore(0); awardedRef.current = false; }} style={{ flex: 1 }}>
            🔄 다시하기
          </Btn>
          <Btn v="primary" size="lg" onClick={onExit} style={{ flex: 1 }}>홈으로</Btn>
        </div>
      </div>
    );
  }

  const q = questions[round];

  const pick = (idx) => {
    if (feedback) return;
    const isCorrect = idx === q.ansIdx;
    recordWordEncounter(name, q, isCorrect);
    if (isCorrect) {
      setScore(score + 1);
      setFeedback("correct");
      setWrongWord(null);
      if (levelId === "homework") updateWordMastery(setStudents, name, q.en, true);
    } else {
      setFeedback("wrong");
      setWrongWord(q);
      if (levelId === "homework") updateWordMastery(setStudents, name, q.en, false);
    }
    setTimeout(() => { setFeedback(null); setWrongWord(null); setRound(round + 1); }, 1000);
  };

  const questionText = q[q.qField];
  const isKo2En = q.dir === "ko2en";
  const cardBg  = isKo2En ? T.accentLight : T.greenLight;
  const cardColor = isKo2En ? T.accent : T.green;
  const hint = isKo2En ? "다음 뜻의 영어 단어는?" : "이 영어 단어의 뜻은?";
  const dirTag = isKo2En ? "🇰🇷→🇺🇸" : "🇺🇸→🇰🇷";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Tag color={isKo2En ? "blue" : "green"}>{dirTag}</Tag>
          <Tag color="blue">{round + 1} / {questions.length}</Tag>
        </div>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={toggleFav} disabled={favLoading} style={{
          padding: "5px 10px", borderRadius: 8,
          background: isFav ? "#fef3c7" : "white",
          color: isFav ? "#f59e0b" : T.textMid,
          border: `1.5px solid ${isFav ? "#f59e0b" : T.border}`,
          fontSize: 11, fontWeight: 800, cursor: favLoading ? "wait" : "pointer",
        }}>
          {isFav ? "⭐ 단어장" : "☆ 단어장 추가"}
        </button>
      </div>

      <div style={{ height: 5, background: T.border, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, transition: "width 0.3s",
          width: `${(round / questions.length) * 100}%`,
          background: isKo2En ? T.accent : T.green
        }} />
      </div>

      <Card style={{ marginBottom: 14, textAlign: "center", padding: "28px 20px", background: cardBg }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8, fontWeight: 700 }}>
          {hint}{!isKo2En && <span style={{ color: T.accent, fontWeight: 800 }}> (단어 탭하면 발음!)</span>}
        </div>
        <div
          onClick={() => !isKo2En && speak(q.en)}
          style={{
            fontSize: isKo2En ? 40 : 36, fontWeight: 900, color: cardColor, lineHeight: 1.2,
            cursor: !isKo2En ? "pointer" : "default",
            userSelect: "none",
            transition: "transform 0.1s",
            display: "inline-block",
          }}
          onMouseDown={e => !isKo2En && (e.currentTarget.style.transform = "scale(0.94)")}
          onMouseUp={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={e => !isKo2En && (e.currentTarget.style.transform = "scale(0.94)")}
          onTouchEnd={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          title={!isKo2En ? "탭하면 발음을 들을 수 있어요" : ""}
        >
          {questionText}
        </div>
        {!isKo2En && (
          <div style={{ marginTop: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); speak(q.en); }} style={{
              background: "rgba(255,255,255,0.7)", border: "none",
              borderRadius: 10, padding: "5px 14px", fontSize: 12,
              fontWeight: 700, cursor: "pointer", color: T.green
            }}>🔊 발음 듣기</button>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {q.opts.map((o, idx) => {
          const isCorrect = idx === q.ansIdx;
          let bg = T.card, color = T.text, borderColor = T.border;
          if (feedback === "correct" && isCorrect) { bg = T.green; color = "white"; borderColor = T.green; }
          else if (feedback === "wrong" && isCorrect) { bg = T.green; color = "white"; borderColor = T.green; }
          else if (feedback === "wrong" && !isCorrect) { bg = T.card; color = T.textDim; }
          return (
            <button key={idx} onClick={() => pick(idx)} disabled={!!feedback} style={{
              padding: "18px 12px", borderRadius: 14,
              border: `2px solid ${borderColor}`,
              background: bg, color,
              fontSize: 15, fontWeight: 800, cursor: feedback ? "default" : "pointer",
              transition: "all 0.2s", boxShadow: T.shadow,
              lineHeight: 1.3
            }}>
              {o[q.aField]}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div style={{
          textAlign: "center", marginTop: 14, padding: "10px 16px",
          borderRadius: 12, fontSize: 14, fontWeight: 900,
          background: feedback === "correct" ? T.greenLight : T.redLight,
          color: feedback === "correct" ? T.green : T.red
        }}>
          {feedback === "correct"
            ? `✓ 정답! ${isKo2En ? q.en : q.ko}`
            : `✗ 정답은 "${isKo2En ? q.en : q.ko}" 이에요`
          }
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 게임 2: 스펠링
// ──────────────────────────────────────────────────────────────────────────
export function SpellingGame({ name, setStudents, student, onExit, levelId = "all" }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const awardedRef = useRef(false);

  const questions = useMemo(() => shuffle(getGameWordPool(levelId, student)).slice(0, 8), [levelId, student?.wordHomework]);

  useEffect(() => {
    if (awardedRef.current) return;
    if (questions.length === 0 || round < questions.length) return;
    awardedRef.current = true;
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: "스펠링",
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 15
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, questions.length]);

  if (round >= questions.length) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>🔤</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{score} / {questions.length}</div>
        <Card style={{ maxWidth: 320, margin: "20px auto 14px", background: T.yellowLight }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>⭐ +{score * 15} 포인트</div>
        </Card>
        <div style={{ display: "flex", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <Btn v="secondary" size="lg" onClick={() => { setRound(0); setScore(0); setInput(""); setFeedback(null); awardedRef.current = false; }} style={{ flex: 1 }}>
            🔄 다시하기
          </Btn>
          <Btn v="primary" size="lg" onClick={onExit} style={{ flex: 1 }}>홈으로</Btn>
        </div>
      </div>
    );
  }

  const q = questions[round];

  const submit = () => {
    if (feedback) return;
    const isCorrect = input.trim().toLowerCase() === q.en.toLowerCase();
    recordWordEncounter(name, q, isCorrect);
    if (isCorrect) {
      setScore(score + 1); setFeedback("correct");
    } else setFeedback("wrong");
    if (levelId === "homework") updateWordMastery(setStudents, name, q.en, isCorrect);
    setTimeout(() => { setFeedback(null); setInput(""); setRound(round + 1); }, 1200);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="blue">{round + 1} / {questions.length}</Tag>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      <Card style={{ marginBottom: 16, textAlign: "center", padding: 28, background: T.greenLight }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>이 단어의 영어 스펠링은?</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: T.green }}>{q.ko}</div>
        <div style={{ fontSize: 11, color: T.textMid, marginTop: 6 }}>힌트: {q.en.length}글자, {q.en[0]}로 시작</div>
      </Card>

      <Input value={input} onChange={e => setInput(e.target.value)} placeholder="영어로 입력하세요" style={{ fontSize: 22, textAlign: "center", marginBottom: 12 }} />
      <Btn v="primary" size="lg" onClick={submit} style={{ width: "100%" }} disabled={!input.trim()}>확인</Btn>

      {feedback && (
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 18, fontWeight: 900,
          color: feedback === "correct" ? T.green : T.red }}>
          {feedback === "correct" ? "✓ 정답!" : `✗ 정답: ${q.en}`}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 게임 3: 스피드 퀴즈 (10초 + 방향 선택)
// ──────────────────────────────────────────────────────────────────────────
export function SpeedQuiz({ name, setStudents, student, onExit, levelId = "all" }) {
  const [mode, setMode] = useState(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(10);
  const awardedRef = useRef(false);

  const questions = useMemo(() => {
    if (!mode) return [];
    const pool = getGameWordPool(levelId, student);
    const picked = shuffle(pool).slice(0, 10);
    return picked.map(w => {
      const dir = mode === "mixed" ? (Math.random() < 0.5 ? "ko2en" : "en2ko") : mode;
      const qField = dir === "ko2en" ? "ko" : "en";
      const aField = dir === "ko2en" ? "en" : "ko";
      const wrongs = shuffle(pool.filter(x => x.en !== w.en)).slice(0, 3);
      const opts = shuffle([w, ...wrongs]);
      return { ...w, dir, qField, aField, opts, ansIdx: opts.findIndex(o => o.en === w.en) };
    });
  }, [mode, levelId, student?.wordHomework]);

  useEffect(() => {
    if (!mode || round >= questions.length) return;
    setTime(10);
    const interval = setInterval(() => {
      setTime(t => {
        if (t <= 1) { clearInterval(interval); setRound(r => r + 1); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [round, mode, questions.length]);

  useEffect(() => {
    if (!mode || awardedRef.current) return;
    if (questions.length === 0 || round < questions.length) return;
    awardedRef.current = true;
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: "스피드 퀴즈",
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 12
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, round, questions.length]);

  if (!mode) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        </div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>스피드 퀴즈</div>
          <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>어떤 방향으로 풀까요? (10초 제한!)</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400, margin: "0 auto" }}>
          {[
            { id: "ko2en", label: "한글 → 영어", icon: "🇰🇷→🇺🇸", bg: T.accentLight, color: T.accent },
            { id: "en2ko", label: "영어 → 한글", icon: "🇺🇸→🇰🇷", bg: T.greenLight, color: T.green },
            { id: "mixed", label: "랜덤 섞기",   icon: "🔀",      bg: T.yellowLight, color: T.yellow },
          ].map(m => (
            <Card key={m.id} onClick={() => setMode(m.id)} style={{
              padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer"
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: m.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 900, color: m.color, flexShrink: 0
              }}>{m.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{m.label}</div>
              <div style={{ marginLeft: "auto", fontSize: 20, color: T.textDim }}>›</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (round >= questions.length) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>⚡</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{score} / {questions.length}</div>
        <Card style={{ maxWidth: 320, margin: "20px auto 14px", background: T.yellowLight }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>⭐ +{score * 12} 포인트</div>
        </Card>
        <div style={{ display: "flex", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <Btn v="secondary" size="lg" onClick={() => { setMode(null); setRound(0); setScore(0); awardedRef.current = false; }} style={{ flex: 1 }}>🔄</Btn>
          <Btn v="primary" size="lg" onClick={onExit} style={{ flex: 1 }}>홈으로</Btn>
        </div>
      </div>
    );
  }

  const q = questions[round];
  const isKo2En = q.dir === "ko2en";

  const pick = (idx) => {
    const isCorrect = idx === q.ansIdx;
    recordWordEncounter(name, q, isCorrect);
    if (isCorrect) setScore(score + 1);
    if (levelId === "homework") updateWordMastery(setStudents, name, q.en, isCorrect);
    setRound(round + 1);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color={time <= 3 ? "red" : "yellow"}>⏱️ {time}초</Tag>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      <div style={{ height: 6, background: T.border, borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${time * 10}%`, background: time <= 3 ? T.red : T.yellow, transition: "width 1s linear" }} />
      </div>

      <Card style={{ marginBottom: 14, textAlign: "center", padding: 28, background: T.yellowLight }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>
          {isKo2En ? "다음 뜻의 영어 단어는?" : "이 영어 단어의 뜻은?"}
          {!isKo2En && <span style={{ color: T.accent, fontWeight: 800 }}> (단어 탭하면 발음!)</span>}
        </div>
        <div
          onClick={() => !isKo2En && speak(q.en)}
          style={{
            fontSize: 36, fontWeight: 900, color: T.yellow, marginBottom: 8,
            cursor: !isKo2En ? "pointer" : "default",
            userSelect: "none",
            transition: "transform 0.1s",
            display: "inline-block",
          }}
          onMouseDown={e => !isKo2En && (e.currentTarget.style.transform = "scale(0.94)")}
          onMouseUp={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={e => !isKo2En && (e.currentTarget.style.transform = "scale(0.94)")}
          onTouchEnd={e => !isKo2En && (e.currentTarget.style.transform = "scale(1)")}
          title={!isKo2En ? "탭하면 발음을 들을 수 있어요" : ""}
        >{q[q.qField]}</div>
        {!isKo2En && (
          <div>
            <button onClick={(e) => { e.stopPropagation(); speak(q.en); }} style={{
              background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 10,
              padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.yellow
            }}>🔊 발음 듣기</button>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {q.opts.map((o, idx) => (
          <button key={idx} onClick={() => pick(idx)} style={{
            padding: "18px 12px", borderRadius: 14, border: `2px solid ${T.border}`,
            background: T.card, fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: T.shadow, lineHeight: 1.3
          }}>{o[q.aField]}</button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 게임 4: 플래시카드 (발음 자동)
// ──────────────────────────────────────────────────────────────────────────
export function FlashCard({ name, setStudents, student, onExit, levelId = "all" }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = useMemo(() => shuffle(getGameWordPool(levelId, student)).slice(0, 10), [levelId, student?.wordHomework]);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [studied, setStudied] = useState(0);

  useEffect(() => {
    if (cards[idx]) {
      speak(cards[idx].en);
      recordWordEncounter(name, cards[idx], true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (!cards[idx]) return;
    let cancelled = false;
    isInWordbook(name, cards[idx].en).then(result => {
      if (!cancelled) setIsFav(result);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const toggleFav = async () => {
    if (favLoading || !cards[idx]) return;
    setFavLoading(true);
    if (isFav) {
      await removeFromWordbook(name, cards[idx].en);
      setIsFav(false);
    } else {
      await addToWordbook(name, cards[idx]);
      setIsFav(true);
    }
    setFavLoading(false);
  };

  const next = () => {
    if (idx < cards.length - 1) { setIdx(idx + 1); setFlipped(false); setStudied(studied + 1); }
    else {
      saveStudentRecord(setStudents, name, {
        type: "game", gameType: "플래시카드",
        score: studied + 1, total: cards.length,
        category: cards[0]?.cat || "기타",
        points: cards.length * 5
      });
      onExit();
    }
  };

  const prev = () => { if (idx > 0) { setIdx(idx - 1); setFlipped(false); } };
  const c = cards[idx];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="purple">{idx + 1} / {cards.length}</Tag>
      </div>

      <div onClick={() => setFlipped(!flipped)} style={{
        background: flipped ? T.purple : T.card, borderRadius: 20, padding: "60px 20px",
        textAlign: "center", color: flipped ? "white" : T.text, marginBottom: 12,
        cursor: "pointer", boxShadow: T.shadowLg, minHeight: 220, display: "flex",
        flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative"
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
          {flipped ? "뜻" : "단어"} · 탭하여 뒤집기
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 6 }}>{flipped ? c.ko : c.en}</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
          {flipped ? c.en : c.ko} <span style={{ opacity: 0.5 }}>· {c.cat}</span>
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); toggleFav(); }} disabled={favLoading} style={{
        width: "100%", marginBottom: 8, padding: "10px",
        background: isFav ? "#fef3c7" : "white",
        color: isFav ? "#f59e0b" : T.textMid,
        border: `2px solid ${isFav ? "#f59e0b" : T.border}`,
        borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: favLoading ? "wait" : "pointer",
      }}>
        {isFav ? "⭐ 내 단어장에 있어요" : "☆ 내 단어장에 추가"}
      </button>

      <Btn v="secondary" size="lg" onClick={(e) => { e.stopPropagation(); speak(c.en); }} style={{ width: "100%", marginBottom: 12 }}>
        🔊 발음 듣기
      </Btn>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn v="secondary" size="lg" onClick={prev} style={{ flex: 1 }} disabled={idx === 0}>← 이전</Btn>
        <Btn v="primary" size="lg" onClick={next} style={{ flex: 1 }}>{idx === cards.length - 1 ? "완료" : "다음 →"}</Btn>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 레벨 선택 화면 (게임 시작 전)
// ──────────────────────────────────────────────────────────────────────────
export function LevelSelect({ gameInfo, onSelect, onCancel }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <Btn v="ghost" size="sm" onClick={onCancel}>← 뒤로</Btn>
      </div>

      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{
          width: 70, height: 70, borderRadius: 18, background: gameInfo.bg, margin: "0 auto 10px",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38
        }}>{gameInfo.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{gameInfo.name}</div>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>수준을 선택해 주세요</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "0 auto" }}>
        {Object.values(WORD_LEVELS).map(lv => {
          const count = getWordsByLevel(lv.id).length;
          return (
            <Card key={lv.id} onClick={() => onSelect(lv.id)} style={{
              padding: 16, display: "flex", alignItems: "center", gap: 14,
              background: lv.color, border: `2px solid ${lv.accent}33`
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14, background: "white",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0
              }}>{lv.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{lv.label}</div>
                <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{lv.desc} · 실제 사용 {count}개</div>
              </div>
              <div style={{ fontSize: 22, color: lv.accent, fontWeight: 900 }}>›</div>
            </Card>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: T.textDim }}>
        💡 낮은 수준을 선택하면 그 단계까지의 단어가 모두 포함돼요
      </div>
    </div>
  );
}
