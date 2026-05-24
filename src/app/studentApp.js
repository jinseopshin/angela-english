"use client";
import { useState, useMemo, useEffect } from "react";
import {
  T, MARKS, Btn, Tag, Card, MenuCard, StatBox, saveStudentRecord
} from "./theme";
import {
  WordMatchGame, SpellingGame, SpeedQuiz, FlashCard, LevelSelect
} from "./coreGames";
import {
  BadgeDisplay, BadgeCelebration, getEarnedBadges,
  NoticeBanner, StudentGoalWidget, SentenceGame,
  ScheduleBanner,
  CustomExamBanner, CustomExamPlay
} from "./features";
import { WordHomeworkBanner } from "./WordHomework";
import {
  MemoryCardGame, DailyChallenge, WrongNoteGame, AnagramGame,
  TypingRace, WordRelay, WordTwenty, WordWorldRPG,
  PictureWordGame, WordMatchLines, WordSearchGame, DictationGame
} from "./games";
import { MyWordbook } from "./MyWordbook";
import { PhonicsMenu } from "./PhonicsGames";
import { PronunciationGame } from "./PronunciationGame";
import { PronunciationWidget } from "./PronunciationWidget";
import { SentenceBuilderMenu } from "./SentenceBuilderGame";
import { getTodayReviewWords } from "./studentWords";
import { isSoundEnabled, setSoundEnabled, getVolume, setVolume, playClick } from "./soundEffects";

// ══════════════════════════════════════════════════════════════════════════
//   🧒 STUDENT APP v2.0 — 학생 모드 화면
//   - 새 디자인 시스템 적용
//   - 학습 흐름 기반 메뉴 재구성
//   - 더 둥글고 부드럽고 귀엽게
// ══════════════════════════════════════════════════════════════════════════

export function StudentHome({ name, bank, setStudents, students, onLogout, darkMode, setDarkMode }) {
  // ── 게임/화면 state ──
  const [screen, setScreen] = useState("home");
  const [quizSet, setQuizSet] = useState(null);
  const [pendingGame, setPendingGame] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [reviewWords, setReviewWords] = useState(null);
  const [newBadges, setNewBadges] = useState([]);

  // ── 환영 토스트 / PIN 변경 / 복습 카운트 / 자유풀기 접기 ──
  const [welcomeToast, setWelcomeToast] = useState({ show: false, message: "", icon: "" });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pinChangeStep, setPinChangeStep] = useState("new");
  const [pinChangeData, setPinChangeData] = useState({ newPin: "", confirmPin: "", error: "" });
  const [reviewCount, setReviewCount] = useState(0);
  const [showFreeQuiz, setShowFreeQuiz] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("angela_free_quiz_open_" + name) === "true"; }
    catch { return false; }
  });
  const [showBadges, setShowBadges] = useState(false);
  const [gameCategory, setGameCategory] = useState("learning"); // learning | challenge | special

  // ── 설정 / 도움말 / 투어 ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [soundOn, setSoundOnState] = useState(() => {
    if (typeof window === "undefined") return true;
    return isSoundEnabled();
  });
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.6;
    return getVolume();
  });
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const me = students[name] || {};
  const points = me.points || 0;

  // 첫 로그인 자동 투어
  useEffect(() => {
    if (!name) return;
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem("angela_tour_seen_" + name);
      if (!seen) {
        const t = setTimeout(() => {
          setShowTour(true);
          setTourStep(0);
        }, 3500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [name]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("angela_free_quiz_open_" + name, String(showFreeQuiz)); } catch {}
  }, [showFreeQuiz, name]);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    getTodayReviewWords(name, 50).then(words => {
      if (!cancelled) setReviewCount(words?.length || 0);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [name, screen]);

  // 환영 메시지
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const words = await getTodayReviewWords(name, 100);
        const count = words?.length || 0;
        if (cancelled) return;
        let icon, message;
        if (count >= 30) { icon = "🔥"; message = `오늘 복습 ${count}개! 잊기 전에 해봐요`; }
        else if (count >= 10) { icon = "📚"; message = `오늘 복습 ${count}개 있어요`; }
        else if (count >= 1) { icon = "🌱"; message = `오늘 복습 ${count}개 있어요`; }
        else { icon = "✨"; message = "오늘은 새 단어를 배워볼까요?"; }
        setWelcomeToast({ show: true, message, icon });
        setTimeout(() => {
          if (!cancelled) setWelcomeToast(t => ({ ...t, show: false }));
        }, 3000);
      } catch (e) {
        console.warn("환영 메시지 실패:", e);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notices   = useMemo(()=>{ if (typeof window==="undefined") return []; try { return JSON.parse(localStorage.getItem("angela_notices")||"[]"); } catch { return []; } },[screen]);
  const schedules = useMemo(()=>{ if (typeof window==="undefined") return []; try { return JSON.parse(localStorage.getItem("angela_schedules")||"[]"); } catch { return []; } },[screen]);
  const goals     = useMemo(()=>{ if (typeof window==="undefined") return []; try { return JSON.parse(localStorage.getItem("angela_goals")||"[]"); } catch { return []; } },[screen]);

  useEffect(()=>{
    if (!me.name || screen !== "home" || typeof window==="undefined") return;
    try {
      const alreadyKey = "angela_earned_badges_" + name;
      const already = new Set(JSON.parse(localStorage.getItem(alreadyKey)||"[]"));
      const nowBadges = getEarnedBadges(me);
      const fresh = nowBadges.filter(b => !already.has(b.id));
      if (fresh.length) {
        setNewBadges(fresh);
        localStorage.setItem(alreadyKey, JSON.stringify(nowBadges.map(b=>b.id)));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen, points]);

  const startGame = (gameInfo) => { setPendingGame(gameInfo); setScreen("level-select"); };
  const onLevelSelected = (levelId) => { setSelectedLevel(levelId); setScreen(pendingGame.id); };
  const exitGame = () => { setScreen("home"); setPendingGame(null); };

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === "ArrowLeft") exitGame();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, []);

  // ── PIN 변경 화면 ──────────────────────────────────────────────────
  if (showPasswordChange) {
    const currentPin = me.password || "0000";

    const handleNewPin = (digit) => {
      if (pinChangeStep === "new") {
        if (pinChangeData.newPin.length >= 4) return;
        const next = pinChangeData.newPin + digit;
        setPinChangeData(d => ({ ...d, newPin: next, error: "" }));
        if (next.length === 4) {
          setTimeout(() => setPinChangeStep("confirm"), 150);
        }
      } else if (pinChangeStep === "confirm") {
        if (pinChangeData.confirmPin.length >= 4) return;
        const next = pinChangeData.confirmPin + digit;
        setPinChangeData(d => ({ ...d, confirmPin: next, error: "" }));
        if (next.length === 4) {
          setTimeout(() => {
            if (next === pinChangeData.newPin) {
              if (next === currentPin) {
                setPinChangeData({ newPin: "", confirmPin: "", error: "현재 비밀번호와 같아요. 새 비밀번호를 입력해주세요." });
                setPinChangeStep("new");
                return;
              }
              setStudents(prev => ({
                ...prev,
                [name]: { ...prev[name], password: next }
              }));
              setPinChangeStep("done");
              setTimeout(() => {
                setShowPasswordChange(false);
                setPinChangeStep("new");
                setPinChangeData({ newPin: "", confirmPin: "", error: "" });
              }, 1800);
            } else {
              setPinChangeData({ newPin: "", confirmPin: "", error: "두 비밀번호가 달라요. 다시 입력해주세요." });
              setPinChangeStep("new");
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
            }
          }, 150);
        }
      }
    };

    const handleBack = () => {
      if (pinChangeStep === "new") {
        setPinChangeData(d => ({ ...d, newPin: d.newPin.slice(0, -1), error: "" }));
      } else if (pinChangeStep === "confirm") {
        setPinChangeData(d => ({ ...d, confirmPin: d.confirmPin.slice(0, -1), error: "" }));
      }
    };

    const cancelChange = () => {
      setShowPasswordChange(false);
      setPinChangeStep("new");
      setPinChangeData({ newPin: "", confirmPin: "", error: "" });
    };

    const displayedPin = pinChangeStep === "new" ? pinChangeData.newPin : pinChangeData.confirmPin;
    const stepTitle = pinChangeStep === "new" ? "새 비밀번호 4자리" : pinChangeStep === "confirm" ? "한 번 더 입력해주세요" : "변경 완료!";
    const stepIcon = pinChangeStep === "done" ? "✅" : pinChangeStep === "confirm" ? "🔁" : "🔑";

    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${T.purpleLight} 0%, ${T.pinkLight} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20
      }}>
        <Card style={{ maxWidth: 380, width: "100%", padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{stepIcon}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: T.text }}>비밀번호 변경</div>
            <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>{stepTitle}</div>
          </div>

          {pinChangeStep === "done" ? (
            <div style={{
              textAlign: "center", padding: "20px 10px",
              background: T.greenLight, borderRadius: T.radius, marginBottom: 12
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.green }}>비밀번호가 변경되었어요!</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 4 }}>잊지 않게 잘 기억해주세요 🤫</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: displayedPin.length > i ? T.accent : "transparent",
                    border: `2px solid ${displayedPin.length > i ? T.accent : T.border}`,
                    transition: "all 0.15s",
                  }} />
                ))}
              </div>

              {pinChangeData.error && (
                <div style={{
                  textAlign: "center", color: T.red, fontSize: 12, fontWeight: 700,
                  marginBottom: 12, padding: "8px 10px", background: T.redLight, borderRadius: T.radiusSm
                }}>
                  ⚠️ {pinChangeData.error}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                {["1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} onClick={() => handleNewPin(d)}
                    style={{
                      padding: "16px 0", borderRadius: T.radius,
                      background: T.bg, border: `2px solid ${T.border}`,
                      fontSize: 22, fontWeight: 800, color: T.text,
                      cursor: "pointer", transition: "all 0.1s"
                    }}
                  >{d}</button>
                ))}
                <button onClick={handleBack}
                  style={{
                    padding: "16px 0", borderRadius: T.radius,
                    background: T.bg, border: `2px solid ${T.border}`,
                    fontSize: 18, fontWeight: 800, color: T.textMid,
                    cursor: "pointer"
                  }}>←</button>
                <button onClick={() => handleNewPin("0")}
                  style={{
                    padding: "16px 0", borderRadius: T.radius,
                    background: T.bg, border: `2px solid ${T.border}`,
                    fontSize: 22, fontWeight: 800, color: T.text,
                    cursor: "pointer"
                  }}>0</button>
                <button onClick={() => {
                  if (pinChangeStep === "new") setPinChangeData(d => ({ ...d, newPin: "", error: "" }));
                  else setPinChangeData(d => ({ ...d, confirmPin: "", error: "" }));
                }}
                  style={{
                    padding: "16px 0", borderRadius: T.radius,
                    background: T.bg, border: `2px solid ${T.border}`,
                    fontSize: 11, fontWeight: 800, color: T.textMid,
                    cursor: "pointer"
                  }}>지우기</button>
              </div>

              <Btn v="ghost" size="md" onClick={cancelChange} style={{ width: "100%" }}>
                취소
              </Btn>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ── 게임/화면 라우팅 (모두 기존 유지) ──────────────────────────────
  if (screen === "level-select" && pendingGame) return <LevelSelect gameInfo={pendingGame} onSelect={onLevelSelected} onCancel={exitGame} student={me} />;
  if (screen === "game-match")    return <WordMatchGame name={name} setStudents={setStudents} student={selectedLevel === "review" ? { ...me, reviewWords } : me} onExit={() => { exitGame(); setReviewWords(null); }} levelId={selectedLevel} />;
  if (screen === "game-spell")    return <SpellingGame  name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-speed")    return <SpeedQuiz     name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-flash")    return <FlashCard     name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "wordbook") return <MyWordbook studentName={name} onExit={exitGame} />;
  if (screen === "phonics") return <PhonicsMenu studentName={name} onExit={exitGame} />;
  if (screen === "custom-exam-play") return <CustomExamPlay student={me} name={name} setStudents={setStudents} onExit={() => setScreen("home")} />;
  if (screen === "game-sentence") return <SentenceGame  name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-memory")   return <MemoryCardGame name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-daily")    return <DailyChallenge name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-wrong")    return <WrongNoteGame  name={name} students={students} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-anagram")  return <AnagramGame    name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-typing")   return <TypingRace     name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-relay")    return <WordRelay      name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-twenty")   return <WordTwenty     name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-rpg")      return <WordWorldRPG   name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-picture")  return <PictureWordGame name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-lines")    return <WordMatchLines  name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-search")   return <WordSearchGame  name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-dictation")return <DictationGame   name={name} setStudents={setStudents} onExit={exitGame} />;
  if (screen === "game-pronunciation") return <PronunciationGame name={name} setStudents={setStudents} student={me} onExit={exitGame} />;
  if (screen === "sentence-builder") return <SentenceBuilderMenu studentName={name} onExit={exitGame} />;
  if (screen === "quiz" && quizSet) return <StudentQuiz name={name} setStudents={setStudents} qset={quizSet} onExit={() => { setScreen("home"); setQuizSet(null); }} />;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const greetIcon = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";

  // 배정 과제 / 자유 풀기 분류
  const myAssigns = (typeof window !== "undefined"
    ? (()=>{try{return JSON.parse(localStorage.getItem("angela_assignments")||"[]");}catch{return [];}})()
    : []).filter(a => a.studentName === name);
  const assignedBankIds = myAssigns.map(a => a.bankId);
  const assignedSets = assignedBankIds.map(id => bank[id]).filter(Boolean);
  const otherSets = Object.values(bank).filter(s => !assignedBankIds.includes(s.id));

  // 게임 분류 (학습 / 도전 / 특별)
  const GAME_GROUPS = {
    learning: {
      label: "🎯 단어 학습",
      desc: "기본 단어부터 차근차근",
      games: [
        { id:"game-match",    icon:"🎯", name:"단어 맞추기",   sub:"뜻↔영어 선택",     color:"accent", isLevel:true },
        { id:"game-spell",    icon:"🔤", name:"스펠링",         sub:"철자 직접 입력",    color:"green",  isLevel:true },
        { id:"game-speed",    icon:"⚡", name:"스피드 퀴즈",   sub:"10초 안에!",        color:"yellow", isLevel:true },
        { id:"game-flash",    icon:"🧩", name:"플래시카드",    sub:"🔊 발음 포함",      color:"pink",   isLevel:true },
        { id:"game-lines",    icon:"🔗", name:"단어 연결",     sub:"영어-한글 매칭",    color:"purple" },
        { id:"game-anagram",  icon:"🔤", name:"철자 조립",     sub:"섞인 철자 맞추기",  color:"teal" },
        { id:"game-picture",  icon:"🖼️", name:"그림 단어",     sub:"그림 보고 맞추기",  color:"orange" },
        { id:"game-memory",   icon:"🧠", name:"메모리 카드",   sub:"짝 맞추기",         color:"blue" },
      ]
    },
    challenge: {
      label: "🔥 도전 게임",
      desc: "더 어려운 도전!",
      games: [
        { id:"game-daily",    icon:"📅", name:"데일리 챌린지", sub:"오늘의 5단어",      color:"yellow", badge:"매일 NEW" },
        { id:"game-rpg",      icon:"🗺️", name:"단어 월드 RPG", sub:"보스를 물리쳐요!", color:"purple", badge:"🔥 인기" },
        { id:"game-typing",   icon:"⌨️", name:"타이핑 레이스", sub:"단어가 내려와요!",  color:"pink" },
        { id:"game-relay",    icon:"🔗", name:"단어 릴레이",   sub:"콤보를 이어가요!",  color:"teal" },
        { id:"game-twenty",   icon:"🔍", name:"단어 스무고개", sub:"힌트로 추리해요!",  color:"orange" },
        { id:"game-search",   icon:"🔍", name:"단어 찾기",     sub:"숨겨진 단어 찾기",  color:"green" },
        { id:"game-sentence", icon:"📝", name:"문장 빈칸",     sub:"문장 속 단어 찾기", color:"purple" },
        { id:"game-wrong",    icon:"📒", name:"오답 노트",     sub:"틀린 단어 복습",    color:"red" },
      ]
    },
    special: {
      label: "✨ 특별 학습",
      desc: "발음과 듣기 연습",
      games: [
        { id:"game-pronunciation", icon:"🗣️", name:"발음 챌린지", sub:"🎤 AI 발음 채점", color:"purple", badge:"🆕 NEW" },
        { id:"game-dictation",     icon:"🎤", name:"받아쓰기",    sub:"듣고 받아써요",   color:"blue" },
      ]
    }
  };

  const currentGames = GAME_GROUPS[gameCategory] || GAME_GROUPS.learning;

  return (
    <>
    <style>{`
      @keyframes slideDownFade {
        from { transform: translateY(-20px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      @keyframes shake {
        0%,100% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        75% { transform: translateX(6px); }
      }
      .game-card-hover:hover {
        transform: translateY(-3px);
      }
    `}</style>

    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 40 }}>
      
      {/* ╔══════════════════════════════════════════════════════════════╗
          ║   환영 토스트 / 설정 / 도움말 / 투어 (모달들 - 기존 그대로)  ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      
      {welcomeToast.show && (
        <div style={{
          position: "fixed",
          top: 70, right: 16, left: 16,
          maxWidth: 380, margin: "0 auto",
          background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
          color: "white",
          padding: "14px 18px",
          borderRadius: T.radiusLg,
          boxShadow: T.shadowXl,
          zIndex: 100,
          display: "flex", alignItems: "center", gap: 12,
          animation: "slideDownFade 0.4s ease-out",
        }}>
          <div style={{ fontSize: 28 }}>{welcomeToast.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 2 }}>{name}님 환영해요! 👋</div>
            <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.4 }}>{welcomeToast.message}</div>
          </div>
          <button onClick={() => setWelcomeToast(t => ({ ...t, show: false }))}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none",
              borderRadius: T.radiusSm, color: "white", padding: "6px 10px",
              fontSize: 16, fontWeight: 800, cursor: "pointer",
              flexShrink: 0
            }}>×</button>
        </div>
      )}

      {/* ⚙️ 설정 모달 */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: T.radiusLg, padding: 24,
            maxWidth: 380, width: "100%", maxHeight: "85vh", overflowY: "auto",
            boxShadow: T.shadowXl
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>⚙️ 설정</div>
              <button onClick={() => setShowSettings(false)} style={{
                background: T.bgSoft, border: "none", fontSize: 18, cursor: "pointer", color: T.textMid,
                width: 32, height: 32, borderRadius: T.radiusFull
              }}>✕</button>
            </div>

            {/* 사운드 토글 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius, marginBottom: 10
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 26 }}>{soundOn ? "🔊" : "🔇"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>사운드</div>
                  <div style={{ fontSize: 11, color: T.textMid }}>{soundOn ? "켜짐" : "꺼짐"}</div>
                </div>
              </div>
              <button onClick={() => {
                const next = !soundOn;
                setSoundEnabled(next);
                setSoundOnState(next);
                if (next) playClick();
              }} style={{
                width: 52, height: 30, borderRadius: 15, border: "none",
                background: soundOn ? T.green : T.border, cursor: "pointer",
                position: "relative", transition: "all 0.2s"
              }}>
                <div style={{
                  position: "absolute", top: 3, left: soundOn ? 25 : 3,
                  width: 24, height: 24, borderRadius: "50%", background: "white",
                  transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }} />
              </button>
            </div>

            {soundOn && (
              <div style={{
                padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius, marginBottom: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 26 }}>🔉</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>볼륨</div>
                      <div style={{ fontSize: 11, color: T.textMid }}>{Math.round(volume * 100)}%</div>
                    </div>
                  </div>
                </div>
                <input type="range" min="0" max="100" step="5"
                  value={Math.round(volume * 100)}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10) / 100;
                    setVolume(v);
                    setVolumeState(v);
                  }}
                  onMouseUp={() => playClick()}
                  onTouchEnd={() => playClick()}
                  style={{ width: "100%", accentColor: T.accent }}
                />
              </div>
            )}

            {setDarkMode && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius, marginBottom: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{darkMode ? "🌙" : "☀️"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>화면 모드</div>
                    <div style={{ fontSize: 11, color: T.textMid }}>{darkMode ? "다크" : "라이트"}</div>
                  </div>
                </div>
                <button onClick={() => { playClick(); setDarkMode(d => !d); }} style={{
                  width: 52, height: 30, borderRadius: 15, border: "none",
                  background: darkMode ? T.purple : T.border, cursor: "pointer",
                  position: "relative", transition: "all 0.2s"
                }}>
                  <div style={{
                    position: "absolute", top: 3, left: darkMode ? 25 : 3,
                    width: 24, height: 24, borderRadius: "50%", background: "white",
                    transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }} />
                </button>
              </div>
            )}

            <button onClick={() => { playClick(); setShowSettings(false); setShowPasswordChange(true); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius, marginBottom: 10,
              border: "none", cursor: "pointer", textAlign: "left"
            }}>
              <span style={{ fontSize: 26 }}>🔑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>비밀번호 변경</div>
                <div style={{ fontSize: 11, color: T.textMid }}>4자리 PIN 변경</div>
              </div>
              <span style={{ fontSize: 18, color: T.textDim }}>›</span>
            </button>

            <button onClick={() => { playClick(); setShowSettings(false); setShowHelp(true); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius, marginBottom: 10,
              border: "none", cursor: "pointer", textAlign: "left"
            }}>
              <span style={{ fontSize: 26 }}>❓</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>도움말</div>
                <div style={{ fontSize: 11, color: T.textMid }}>기능 안내 보기</div>
              </div>
              <span style={{ fontSize: 18, color: T.textDim }}>›</span>
            </button>

            <button onClick={() => {
              playClick();
              setShowSettings(false);
              setTourStep(0);
              setShowTour(true);
            }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", background: T.bgSoft, borderRadius: T.radius,
              border: "none", cursor: "pointer", textAlign: "left"
            }}>
              <span style={{ fontSize: 26 }}>🎓</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>처음 시작 안내 다시 보기</div>
                <div style={{ fontSize: 11, color: T.textMid }}>주요 기능 둘러보기</div>
              </div>
              <span style={{ fontSize: 18, color: T.textDim }}>›</span>
            </button>
          </div>
        </div>
      )}

      {/* ❓ 도움말 모달 */}
      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: T.radiusLg, padding: 24,
            maxWidth: 400, width: "100%", maxHeight: "85vh", overflowY: "auto",
            boxShadow: T.shadowXl
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>❓ 도움말</div>
              <button onClick={() => setShowHelp(false)} style={{
                background: T.bgSoft, border: "none", fontSize: 18, cursor: "pointer", color: T.textMid,
                width: 32, height: 32, borderRadius: T.radiusFull
              }}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8 }}>
              {[
                { icon: "🔤", title: "파닉스 학습", desc: "알파벳부터 차근차근, 5단계로 단어를 배워요" },
                { icon: "📝", title: "문장 만들기", desc: "섞인 단어를 순서대로 클릭해 문장을 완성해요" },
                { icon: "🔔", title: "오늘의 복습", desc: "전에 배운 단어 중 잊을 만한 것을 다시 풀어요" },
                { icon: "📚", title: "내 단어장", desc: "내가 모은 단어로 자유롭게 복습할 수 있어요" },
                { icon: "📬", title: "선생님 과제", desc: "선생님이 배정한 단어/시험 숙제를 풀어요" },
                { icon: "🎮", title: "다양한 게임", desc: "단어 맞추기, 스펠링, 스피드 퀴즈 등 즐겁게 배워요" },
                { icon: "🎤", title: "발음 챌린지", desc: "AI가 발음을 채점해줘요" },
                { icon: "🏅", title: "내 뱃지", desc: "꾸준히 학습하면 뱃지를 받을 수 있어요" },
                { icon: "🔥", title: "콤보", desc: "연속으로 맞추면 더 큰 점수와 뱃지를 받아요" },
              ].map((h, i, arr) => (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: "12px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none"
                }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{h.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: T.text, marginBottom: 2 }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.5 }}>{h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <Btn v="primary" size="lg" onClick={() => setShowHelp(false)} style={{ width: "100%", marginTop: 18 }}>
              닫기
            </Btn>
          </div>
        </div>
      )}

      {/* 🎓 투어 */}
      {showTour && (() => {
        const TOUR = [
          { icon: "👋", title: `${name}님, 환영해요!`, desc: "Angela's English Academy에 오신 걸 환영합니다. 함께 영어를 즐겁게 배워봐요!" },
          { icon: "🔤", title: "파닉스부터 차근차근", desc: "유치부라면 파닉스 학습부터 시작하세요. 알파벳 소리부터 배워요." },
          { icon: "🔔", title: "오늘의 복습", desc: "복습 카드가 있으면 먼저 풀어보세요. 잊기 전에 다시 보면 오래 기억돼요." },
          { icon: "🎮", title: "다양한 게임", desc: "단어 맞추기, 스펠링, 스피드 퀴즈 등 여러 게임으로 즐겁게 배워요." },
          { icon: "🔥", title: "콤보를 쌓아요", desc: "연속으로 정답을 맞추면 콤보! 화려한 효과와 함께 점수가 올라가요." },
          { icon: "⚙️", title: "설정과 도움말", desc: "우측 상단 ⚙️ 버튼을 누르면 사운드, 비밀번호, 도움말 등을 볼 수 있어요." },
        ];
        const total = TOUR.length;
        const current = TOUR[tourStep];
        const close = () => {
          setShowTour(false);
          try { window.localStorage.setItem("angela_tour_seen_" + name, "1"); } catch {}
        };
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}>
            <div style={{
              background: T.card, borderRadius: T.radiusXl, padding: 32,
              maxWidth: 380, width: "100%", textAlign: "center",
              boxShadow: T.shadowXl
            }}>
              <div style={{ fontSize: 64, marginBottom: 14 }}>{current.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginBottom: 10 }}>
                {current.title}
              </div>
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 20 }}>
                {current.desc}
              </div>

              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
                {TOUR.map((_, i) => (
                  <div key={i} style={{
                    width: i === tourStep ? 20 : 6,
                    height: 6, borderRadius: 3,
                    background: i === tourStep ? T.accent : T.border,
                    transition: "all 0.2s"
                  }} />
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn v="ghost" size="md" onClick={close} style={{ flex: 1 }}>
                  안 보고 시작
                </Btn>
                {tourStep < total - 1 ? (
                  <Btn v="primary" size="md" onClick={() => { playClick(); setTourStep(s => s + 1); }} style={{ flex: 2 }}>
                    다음 ({tourStep + 1}/{total})
                  </Btn>
                ) : (
                  <Btn v="success" size="md" onClick={() => { playClick(); close(); }} style={{ flex: 2 }}>
                    시작하기 ✨
                  </Btn>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║                      상단 헤더                               ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <div className="topbar" style={{ 
        background: T.card, 
        borderBottom: `1px solid ${T.border}`, 
        position: "sticky", top: 0, zIndex: 50 
      }}>
        <div className="top-bar-inner" style={{ alignItems: "center" }}>
          <div style={{
            width: 38, height: 38, borderRadius: T.radiusFull,
            background: T.accentLight,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0
          }}>{me.avatar || "🧒"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>{name}님</div>
            <div style={{ fontSize: 11, color: T.pink, fontWeight: 800 }}>⭐ {points.toLocaleString()}p</div>
          </div>
          <button onClick={() => { playClick(); setShowSettings(true); }} title="설정"
            style={{ 
              background: T.bgSoft, border: "none", cursor: "pointer", 
              fontSize: 18, padding: "8px 10px", borderRadius: T.radiusFull,
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
            ⚙️
          </button>
          <Btn v="ghost" size="sm" onClick={onLogout} style={{ fontSize: 12 }}>로그아웃</Btn>
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║          환영 배너 (인사 + 포인트 + 동기부여 메시지)         ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <div style={{
        background: `linear-gradient(135deg, ${T.pinkLight} 0%, ${T.purpleLight} 50%, ${T.accentLight} 100%)`,
        padding: "20px 16px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: 12, 
                color: T.purple, 
                fontWeight: 800,
                marginBottom: 2
              }}>{greet} {greetIcon}</div>
              <div style={{ 
                fontSize: 22, 
                fontWeight: 900, 
                color: T.text,
                marginBottom: 4
              }}>{name}님! 👋</div>
              <div style={{ 
                fontSize: 12, 
                color: T.textMid,
                fontWeight: 600
              }}>오늘도 영어 공부 화이팅!</div>
            </div>
            <div style={{
              background: T.card,
              borderRadius: T.radiusLg,
              padding: "12px 18px",
              textAlign: "center",
              boxShadow: T.shadow,
              minWidth: 90
            }}>
              <div style={{ 
                fontSize: 22, 
                fontWeight: 900, 
                color: T.pink,
                lineHeight: 1
              }}>{points.toLocaleString()}</div>
              <div style={{ 
                fontSize: 10, 
                color: T.textMid,
                fontWeight: 700,
                marginTop: 4
              }}>⭐ 포인트</div>
            </div>
          </div>
        </div>
      </div>

      {/* 공지/일정 배너 (기존 컴포넌트 그대로) */}
      <NoticeBanner notices={notices} />
      <ScheduleBanner schedules={schedules} />

      <div className="app-container" style={{ padding: "16px" }}>
        
        {/* ╔══════════════════════════════════════════════════════════╗
            ║   🎤 발음 위젯 (기존 컴포넌트 - 자동 노출/숨김)        ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <PronunciationWidget studentName={name} onStart={() => setScreen("game-pronunciation")} />

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   📬 알림: 선생님 배정 과제 (있을 때만 표시)             ║
            ╚══════════════════════════════════════════════════════════╝ */}
        {assignedSets.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 900, 
              color: T.red, 
              marginBottom: 10,
              display: "flex", 
              alignItems: "center", 
              gap: 8 
            }}>
              <span style={{ fontSize: 18 }}>📬</span>
              <span>선생님이 배정한 과제</span>
              <span style={{ 
                background: T.red, 
                color: "white", 
                fontSize: 11, 
                fontWeight: 900, 
                borderRadius: T.radiusFull, 
                padding: "3px 10px" 
              }}>{assignedSets.length}</span>
            </div>
            {assignedSets.map(s => {
              const assign = myAssigns.find(a => a.bankId === s.id);
              const isOverdue = assign?.dueDate && new Date(assign.dueDate) < new Date();
              return (
                <Card key={s.id} onClick={() => { setQuizSet({ ...s, assignmentId: assign?.id }); setScreen("quiz"); }}
                  color="red"
                  style={{ 
                    marginBottom: 8, 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 12,
                    background: T.redLight + "55",
                  }}>
                  <div style={{ 
                    width: 48, height: 48, 
                    background: T.red, 
                    borderRadius: T.radius, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    fontSize: 24,
                    flexShrink: 0
                  }}>📬</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
                      {s.grade} · {s.questions.length}문항
                      {assign?.dueDate && (
                        <span style={{ color: isOverdue ? T.red : T.orange, marginLeft: 6, fontWeight: 700 }}>
                          · 마감 {assign.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <Btn v="danger" size="sm" onClick={e => { e.stopPropagation(); setQuizSet({ ...s, assignmentId: assign?.id }); setScreen("quiz"); }}>
                    풀기
                  </Btn>
                </Card>
              );
            })}
          </div>
        )}

        {/* 단어 숙제 배너 + 시험 배너 (기존 컴포넌트 그대로) */}
        <WordHomeworkBanner student={me} onStart={() => {
          setSelectedLevel("homework");
          setPendingGame({ id: "game-match", name: "단어 맞추기" });
          setScreen("game-match");
        }} />
        <CustomExamBanner student={me} onStart={() => setScreen("custom-exam-play")} />

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   📚 메인 학습 (파닉스 + 문장 만들기)                    ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <div style={{ 
          fontSize: 13, 
          fontWeight: 900, 
          color: T.text, 
          marginBottom: 10,
          marginTop: 4,
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <span style={{ fontSize: 16 }}>📚</span>
          <span>오늘 무엇을 배울까요?</span>
        </div>

        <MenuCard
          icon="🔤"
          title="파닉스 학습"
          desc="알파벳부터 차근차근 · 5단계 · 5게임"
          color="yellow"
          onClick={() => setScreen("phonics")}
          style={{ marginBottom: 10 }}
        />

        <MenuCard
          icon="📝"
          title="문장 만들기"
          desc="섞인 단어를 순서대로 클릭해 문장 완성"
          color="orange"
          onClick={() => setScreen("sentence-builder")}
          style={{ marginBottom: 18 }}
        />

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   🔄 복습 & 단어장 (2단 그리드)                          ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <div style={{ 
          fontSize: 13, 
          fontWeight: 900, 
          color: T.text, 
          marginBottom: 10,
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <span style={{ fontSize: 16 }}>🔄</span>
          <span>복습하기</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {/* 오늘의 복습 */}
          {reviewCount > 0 ? (
            <div onClick={async () => {
                const words = await getTodayReviewWords(name, 20);
                if (words && words.length > 0) {
                  setReviewWords(words);
                  setSelectedLevel("review");
                  setScreen("game-match");
                }
              }}
              style={{
                background: T.card,
                border: `2px solid ${T.redLight}`,
                borderRadius: T.radiusLg,
                padding: 16,
                cursor: "pointer",
                position: "relative",
                boxShadow: T.shadow,
                transition: "all 0.2s",
                minHeight: 120,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = T.shadowLg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = T.shadow;
              }}>
              <div style={{
                position: "absolute", top: 10, right: 10,
                background: T.red, color: "white",
                fontSize: 10, fontWeight: 900,
                padding: "3px 10px", borderRadius: T.radiusFull,
                animation: "pulse 2s infinite"
              }}>{reviewCount}</div>
              <div style={{
                width: 48, height: 48,
                background: T.redLight,
                borderRadius: T.radius,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, marginBottom: 8
              }}>🔔</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>오늘의 복습</div>
              <div style={{ fontSize: 10, color: T.textMid, marginTop: 3 }}>잊기 전에 다시 봐요!</div>
            </div>
          ) : (
            <div style={{
              background: T.greenLight,
              border: `2px solid ${T.greenSoft}`,
              borderRadius: T.radiusLg,
              padding: 16,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              cursor: "default"
            }}>
              <div style={{
                width: 48, height: 48,
                background: T.card,
                borderRadius: T.radius,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, marginBottom: 8
              }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.green }}>복습 완료!</div>
              <div style={{ fontSize: 10, color: T.textMid, marginTop: 3 }}>오늘 복습할 단어가 없어요</div>
            </div>
          )}

          {/* 내 단어장 */}
          <div onClick={() => setScreen("wordbook")}
            style={{
              background: T.card,
              border: `2px solid ${T.purpleLight}`,
              borderRadius: T.radiusLg,
              padding: 16,
              cursor: "pointer",
              boxShadow: T.shadow,
              transition: "all 0.2s",
              minHeight: 120,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = T.shadowLg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = T.shadow;
            }}>
            <div style={{
              width: 48, height: 48,
              background: T.purpleLight,
              borderRadius: T.radius,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, marginBottom: 8
            }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>내 단어장</div>
            <div style={{ fontSize: 10, color: T.textMid, marginTop: 3 }}>⭐ 모은 단어로 복습</div>
          </div>
        </div>

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   📝 자유 풀기 (접힘/펼침)                               ║
            ╚══════════════════════════════════════════════════════════╝ */}
        {otherSets.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <button
              onClick={() => { playClick(); setShowFreeQuiz(s => !s); }}
              style={{
                width: "100%",
                background: T.card,
                border: `2px solid ${T.border}`,
                borderRadius: T.radiusLg,
                padding: "14px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: showFreeQuiz ? 10 : 0,
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40,
                  background: T.pinkLight,
                  borderRadius: T.radiusSm,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22
                }}>📝</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>자유 풀기</div>
                  <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
                    {otherSets.length}개 문제집 · 원할 때 풀어보세요
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 14, color: T.textMid, fontWeight: 800,
                transition: "transform 0.2s",
                transform: showFreeQuiz ? "rotate(180deg)" : "rotate(0deg)",
              }}>▼</div>
            </button>

            {showFreeQuiz && (
              <div>
                {otherSets.map(s => (
                  <Card key={s.id} onClick={() => { setQuizSet(s); setScreen("quiz"); }} 
                    style={{ 
                      marginBottom: 8, 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12,
                      padding: 14
                    }}>
                    <div style={{ 
                      width: 44, height: 44, 
                      background: T.pinkLight, 
                      borderRadius: T.radius, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: 22 
                    }}>📝</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{s.grade} · {s.questions.length}문항</div>
                    </div>
                    <div style={{ fontSize: 20, color: T.pink, fontWeight: 900 }}>›</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 목표 위젯 (기존 컴포넌트) */}
        <StudentGoalWidget studentName={name} goals={goals} />

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   🎮 게임 모음 (카테고리 탭으로 정리)                    ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <div style={{ 
          fontSize: 13, 
          fontWeight: 900, 
          color: T.text, 
          marginBottom: 10,
          marginTop: 4,
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <span style={{ fontSize: 16 }}>🎮</span>
          <span>게임으로 배우기</span>
        </div>

        {/* 게임 카테고리 탭 */}
        <div style={{ 
          display: "flex", 
          gap: 6, 
          marginBottom: 14, 
          background: T.card, 
          padding: 5, 
          borderRadius: T.radius, 
          boxShadow: T.shadow 
        }}>
          {Object.entries(GAME_GROUPS).map(([key, group]) => (
            <button key={key} 
              onClick={() => { playClick(); setGameCategory(key); }} 
              style={{
                flex: 1, 
                padding: "10px 6px", 
                borderRadius: T.radiusSm, 
                border: "none", 
                cursor: "pointer",
                fontSize: 12, 
                fontWeight: 800,
                background: gameCategory === key ? T.accent : "transparent",
                color: gameCategory === key ? "white" : T.textMid,
                transition: "all 0.15s",
                boxShadow: gameCategory === key ? T.shadow : "none"
              }}>
              {group.label}
            </button>
          ))}
        </div>

        {/* 게임 카테고리 설명 */}
        <div style={{ 
          fontSize: 11, 
          color: T.textMid, 
          marginBottom: 12,
          paddingLeft: 4,
          fontWeight: 600
        }}>
          {currentGames.desc}
        </div>

        {/* 게임 카드 그리드 (4-2단 반응형) */}
        <div className="grid-2" style={{ marginBottom: 18 }}>
          {currentGames.games.map(g => {
            const colorMap = {
              yellow: T.yellowLight,
              orange: T.orangeLight,
              red:    T.redLight,
              purple: T.purpleLight,
              blue:   T.blueLight,
              green:  T.greenLight,
              pink:   T.pinkLight,
              teal:   T.tealLight,
              accent: T.accentLight,
            };
            const colorMainMap = {
              yellow: T.yellow,
              orange: T.orange,
              red:    T.red,
              purple: T.purple,
              blue:   T.blue,
              green:  T.green,
              pink:   T.pink,
              teal:   T.teal,
              accent: T.accent,
            };
            const bgColor = colorMap[g.color] || T.accentLight;
            const mainColor = colorMainMap[g.color] || T.accent;
            
            return (
              <div key={g.id} 
                className="game-card-hover"
                onClick={() => {
                  playClick();
                  if (g.isLevel) startGame(g);
                  else setScreen(g.id);
                }}
                style={{ 
                  background: T.card,
                  borderRadius: T.radiusLg,
                  padding: 14,
                  textAlign: "center", 
                  position: "relative",
                  border: `2px solid ${T.border}`,
                  cursor: "pointer",
                  boxShadow: T.shadow,
                  transition: "all 0.2s ease",
                }}>
                {g.badge && (
                  <div style={{ 
                    position: "absolute", 
                    top: 8, right: 8, 
                    background: mainColor, 
                    color: "white", 
                    fontSize: 9, 
                    fontWeight: 900, 
                    padding: "3px 8px", 
                    borderRadius: T.radiusFull 
                  }}>{g.badge}</div>
                )}
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: T.radius, 
                  background: bgColor, 
                  margin: "0 auto 10px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 30 
                }}>{g.icon}</div>
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 800, 
                  color: T.text,
                  marginBottom: 3
                }}>{g.name}</div>
                <div style={{ 
                  fontSize: 10, 
                  color: T.textMid,
                  lineHeight: 1.4
                }}>{g.sub}</div>
              </div>
            );
          })}
        </div>

        {/* ╔══════════════════════════════════════════════════════════╗
            ║   🏅 내 뱃지 (접힘 섹션)                                 ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <button
          onClick={() => { playClick(); setShowBadges(s => !s); }}
          style={{
            width: "100%",
            background: T.card,
            border: `2px solid ${T.border}`,
            borderRadius: T.radiusLg,
            padding: "14px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: showBadges ? 14 : 18,
            transition: "all 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              background: T.yellowLight,
              borderRadius: T.radiusSm,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22
            }}>🏅</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>내 뱃지</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
                꾸준히 학습하면 뱃지를 받아요!
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 14, color: T.textMid, fontWeight: 800,
            transition: "transform 0.2s",
            transform: showBadges ? "rotate(180deg)" : "rotate(0deg)",
          }}>▼</div>
        </button>

        {showBadges && (
          <div style={{ marginBottom: 20 }}>
            <BadgeDisplay student={me} />
          </div>
        )}

        {/* 로그아웃 */}
        <Btn v="ghost" size="md" onClick={onLogout} 
          style={{ width: "100%", marginTop: 12, color: T.textDim, fontSize: 12 }}>
          ← 로그아웃
        </Btn>
      </div>
    </div>

    {/* 뱃지 획득 축하 (기존 컴포넌트) */}
    {newBadges.length > 0 && (
      <BadgeCelebration badges={newBadges} onClose={() => setNewBadges([])} />
    )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   📝 STUDENT QUIZ — 학생 퀴즈 (디자인 약간 정돈)
// ══════════════════════════════════════════════════════════════════════════
export function StudentQuiz({ name, setStudents, qset, onExit }) {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState({});
  const [done, setDone] = useState(false);

  const q = qset.questions[idx];

  const finish = () => {
    let score = 0;
    qset.questions.forEach(q => { if (picks[q.id] === q.ans) score++; });
    saveStudentRecord(setStudents, name, {
      type: "assignment",
      setId: qset.id,
      setTitle: qset.title,
      bankId: qset.id,
      assignmentId: qset.assignmentId || null,
      score, total: qset.questions.length,
      points: score * 8
    });
    setDone(true);
  };

  if (done) {
    const score = qset.questions.filter(q => picks[q.id] === q.ans).length;
    const pct = Math.round(score / qset.questions.length * 100);
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>
            {pct === 100 ? "🏆" : pct >= 70 ? "🎉" : "💪"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginBottom: 4 }}>
            {score} / {qset.questions.length}
          </div>
          <div style={{ fontSize: 13, color: T.textMid, marginBottom: 16 }}>
            정답률 {pct}%
          </div>
          <Card style={{ 
            maxWidth: 320, 
            margin: "0 auto", 
            background: T.yellowLight,
            border: `2px solid ${T.yellowSoft}`,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>
              ⭐ +{score * 8} 포인트 획득!
            </div>
          </Card>
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {qset.questions.map((q, i) => {
            const ok = picks[q.id] === q.ans;
            return (
              <Card key={q.id} style={{ 
                marginBottom: 10, 
                background: ok ? T.greenLight : T.redLight,
                border: `2px solid ${ok ? T.greenSoft : T.redSoft}`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Tag color={ok ? "green" : "red"}>{ok ? "✓" : "✗"} Q{i + 1}</Tag>
                  <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{q.q}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid, marginLeft: 4 }}>
                  내 답: {MARKS[picks[q.id]] || "—"} / 정답: <strong style={{ color: T.green }}>{MARKS[q.ans]} {q.opts[q.ans]}</strong>
                  {q.exp && <div style={{ marginTop: 4, fontSize: 11 }}>💡 {q.exp}</div>}
                </div>
              </Card>
            );
          })}
          <Btn v="primary" size="lg" onClick={onExit} style={{ width: "100%", marginTop: 14 }}>
            홈으로 →
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="blue">{idx + 1} / {qset.questions.length}</Tag>
      </div>

      <div style={{ 
        height: 6, 
        background: T.border, 
        borderRadius: 3, 
        marginBottom: 18,
        overflow: "hidden"
      }}>
        <div style={{ 
          height: "100%", 
          width: `${(idx + 1) / qset.questions.length * 100}%`, 
          background: T.accent, 
          borderRadius: 3, 
          transition: "width 0.3s" 
        }} />
      </div>

      <Card style={{ marginBottom: 16, padding: 22 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: 800, marginBottom: 8 }}>
          문제 {idx + 1}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 18, lineHeight: 1.5 }}>
          {q.q}
        </div>
        {q.opts.filter(o => o).map((o, i) => (
          <button key={i} onClick={() => setPicks({ ...picks, [q.id]: i })} style={{
            display: "block", 
            width: "100%", 
            textAlign: "left",
            padding: "14px 16px", 
            marginBottom: 10, 
            borderRadius: T.radius,
            border: picks[q.id] === i ? `2px solid ${T.accent}` : `2px solid ${T.border}`,
            background: picks[q.id] === i ? T.accentLight : T.card,
            fontSize: 14, 
            fontWeight: 600, 
            cursor: "pointer",
            color: T.text,
            transition: "all 0.15s"
          }}>
            <span style={{ marginRight: 10, fontWeight: 800, color: T.accent }}>{MARKS[i]}</span>{o}
          </button>
        ))}
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn v="secondary" size="md" onClick={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0} style={{ flex: 1 }}>
          ← 이전
        </Btn>
        {idx < qset.questions.length - 1
          ? <Btn v="primary" size="md" onClick={() => setIdx(idx + 1)} style={{ flex: 1 }}>다음 →</Btn>
          : <Btn v="success" size="md" onClick={finish} style={{ flex: 1 }}>제출하기 ✓</Btn>
        }
      </div>
    </div>
  );
}
