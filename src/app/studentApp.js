"use client";
import { useState, useMemo, useEffect } from "react";
import {
  T, MARKS, Btn, Tag, Card, saveStudentRecord
} from "./theme";
import {
  WordMatchGame, SpellingGame, SpeedQuiz, FlashCard, LevelSelect
} from "./coreGames";
import {
  BadgeDisplay, BadgeCelebration, getEarnedBadges,
  NoticeBanner, StudentGoalWidget, SentenceGame,
  ScheduleBanner,
  WordHomeworkBanner,
  CustomExamBanner, CustomExamPlay
} from "./features";
import {
  MemoryCardGame, DailyChallenge, WrongNoteGame, AnagramGame,
  TypingRace, WordRelay, WordTwenty, WordWorldRPG,
  PictureWordGame, WordMatchLines, WordSearchGame, DictationGame
} from "./games";
import { MyWordbook } from "./MyWordbook";
import { ReviewCard } from "./ReviewCard";
import { PronunciationGame } from "./PronunciationGame";
import { PronunciationWidget } from "./PronunciationWidget";

// ══════════════════════════════════════════════════════════════════════════
//   🧒 STUDENT APP — 학생 모드 화면
//   - StudentHome:  학생 홈 (게임 선택, 과제, 단어장 등)
//   - StudentQuiz:  과제 풀기 화면
// ══════════════════════════════════════════════════════════════════════════

export function StudentHome({ name, bank, setStudents, students, onLogout, darkMode, setDarkMode }) {
  const [screen, setScreen] = useState("home");
  const [quizSet, setQuizSet] = useState(null);
  const [pendingGame, setPendingGame] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [reviewWords, setReviewWords] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [tab, setTab] = useState("game");

  const me = students[name] || {};
  const points = me.points || 0;

  // SSR 안전: useEffect 내에서 읽거나 isBrowser 체크
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

  // 키보드 단축키: Alt+← 뒤로가기
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === "ArrowLeft") exitGame();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, []);

  if (screen === "level-select" && pendingGame) return <LevelSelect gameInfo={pendingGame} onSelect={onLevelSelected} onCancel={exitGame} student={me} />;
  if (screen === "game-match")    return <WordMatchGame name={name} setStudents={setStudents} student={selectedLevel === "review" ? { ...me, reviewWords } : me} onExit={() => { exitGame(); setReviewWords(null); }} levelId={selectedLevel} />;
  if (screen === "game-spell")    return <SpellingGame  name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-speed")    return <SpeedQuiz     name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-flash")    return <FlashCard     name={name} setStudents={setStudents} student={me} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "wordbook") return <MyWordbook studentName={name} onExit={exitGame} />;
  if (screen === "custom-exam-play") return <CustomExamPlay student={me} name={name} setStudents={setStudents} onExit={() => setScreen("home")} />;
  if (screen === "game-sentence") return <SentenceGame  name={name} setStudents={setStudents} onExit={exitGame} />;
  // 신규 8개 게임
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
  if (screen === "quiz" && quizSet) return <StudentQuiz name={name} setStudents={setStudents} qset={quizSet} onExit={() => { setScreen("home"); setQuizSet(null); }} />;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <>
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 40 }}>

      {/* 상단 헤더 — 항상 표시 */}
      <div className="topbar" style={{ background: T.card, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
       <div className="top-bar-inner">
        <div style={{ fontSize: 18 }}>🧒</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>{name}님</div>
          <div style={{ fontSize: 10, color: T.textDim }}>⭐ {points}p</div>
        </div>
        <button onClick={() => setDarkMode && setDarkMode(d => !d)} title={darkMode?"라이트":"다크"} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"4px 6px", borderRadius:8 }}>
          {darkMode ? "☀️" : "🌙"}
        </button>
        <Btn v="ghost" size="sm" onClick={onLogout} style={{ fontSize: 11 }}>로그아웃</Btn>
       </div>
      </div>

      <div style={{
        background: `linear-gradient(135deg, ${T.pink} 0%, ${T.accent} 100%)`,
        padding: "16px 16px 24px", color: "white"
      }}>
       <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{greet} 👋</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{name}님</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>오늘도 영어 공부 화이팅!</div>
          </div>
          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{points}</div>
            <div style={{ fontSize: 10, opacity: 0.85 }}>⭐ 포인트</div>
          </div>
        </div>
       </div>
      </div>

      {/* 공지/일정 배너 */}
      <NoticeBanner notices={notices} />
      <ScheduleBanner schedules={schedules} />

      <div className="app-container">
        {/* 🎤 이번 주 발음 위젯 (Phase 3) */}
        <PronunciationWidget studentName={name} onStart={() => setScreen("game-pronunciation")} />

       {/* 🔔 오늘의 복습 (Phase 2: 망각 곡선) */}
        <ReviewCard studentName={name} onStartReview={(words) => {
          setReviewWords(words);
          setSelectedLevel("review");
          setScreen("game-match");
        }} />

        {/* 단어 숙제 배너 — 진행 중인 숙제가 있으면 최상단에 표시 */}
        <WordHomeworkBanner student={me} onStart={() => {
          setSelectedLevel("homework");
          setPendingGame({ id: "game-match", name: "단어 맞추기" });
          setScreen("game-match");
        }} />

        {/* 맞춤 시험지 배너 — 진행 중인 시험이 있으면 표시 */}
        <CustomExamBanner student={me} onStart={() => setScreen("custom-exam-play")} />

        {/* 배정된 과제 */}
        {(() => {
          const myAssigns = (typeof window !== "undefined"
            ? (()=>{try{return JSON.parse(localStorage.getItem("angela_assignments")||"[]");}catch{return [];}})()
            : []).filter(a => a.studentName === name);
          const assignedBankIds = myAssigns.map(a => a.bankId);
          const assignedSets = assignedBankIds.map(id => bank[id]).filter(Boolean);
          const otherSets = Object.values(bank).filter(s => !assignedBankIds.includes(s.id));

          return (
            <>
              {assignedSets.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.red, marginBottom: 8, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                    📬 선생님이 배정한 과제
                    <span style={{ background: T.red, color: "white", fontSize: 10, fontWeight: 900, borderRadius: 8, padding: "2px 7px" }}>{assignedSets.length}</span>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    {assignedSets.map(s => {
                      const assign = myAssigns.find(a => a.bankId === s.id);
                      const isOverdue = assign?.dueDate && new Date(assign.dueDate) < new Date();
                      return (
                        <Card key={s.id} onClick={() => { setQuizSet({ ...s, assignmentId: assign?.id }); setScreen("quiz"); }}
                          style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, border: `2px solid ${T.red}33`, background: T.redLight }}>
                          <div style={{ width: 42, height: 42, background: T.red, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📬</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: T.textMid }}>
                              {s.grade} · {s.questions.length}문항
                              {assign?.dueDate && <span style={{ color: isOverdue ? T.red : T.yellow, marginLeft: 6 }}>마감 {assign.dueDate}</span>}
                            </div>
                          </div>
                          <Btn v="primary" size="sm" onClick={e => { e.stopPropagation(); setQuizSet({ ...s, assignmentId: assign?.id }); setScreen("quiz"); }}>풀기</Btn>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              {otherSets.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>📚 자유 풀기</div>
                  <div style={{ marginBottom: 18 }}>
                    {otherSets.map(s => (
                      <Card key={s.id} onClick={() => { setQuizSet(s); setScreen("quiz"); }} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, background: T.pinkLight, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📝</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: T.textMid }}>{s.grade} · {s.questions.length}문항</div>
                        </div>
                        <div style={{ fontSize: 18, color: T.textDim }}>›</div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* 탭 선택 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.card, padding: 5, borderRadius: 12, boxShadow: T.shadow }}>
          {[{ id:"game", label:"🎮 게임" }, { id:"badge", label:"🏅 내 뱃지" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 800,
              background: tab === t.id ? T.accent : "transparent",
              color: tab === t.id ? "white" : T.textMid
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "game" && (
          <>
          {/* 📚 내 단어장 빠른 진입 */}
            <Card onClick={() => setScreen("wordbook")} style={{
              marginBottom: 14, padding: "14px 16px",
              background: `linear-gradient(135deg, ${T.purple}, ${T.accent})`,
              color: "white", cursor: "pointer", border: "none",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 32 }}>📚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>내 단어장</div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>⭐ 모은 단어로 복습하기</div>
              </div>
              <div style={{ fontSize: 20, opacity: 0.7 }}>›</div>
            </Card>
            {/* 목표 위젯 */}
            <StudentGoalWidget studentName={name} goals={goals} />

            {/* 게임 모음 */}
            <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>🎮 게임</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              {[
                // 기본 단어 학습 게임
                { id:"game-match",    icon:"🎯", name:"단어 맞추기",   sub:"뜻↔영어 선택",     bg:T.accentLight, isLevel:true },
                { id:"game-spell",    icon:"🔤", name:"스펠링",         sub:"철자 직접 입력",    bg:T.greenLight,  isLevel:true },
                { id:"game-speed",    icon:"⚡", name:"스피드 퀴즈",   sub:"10초 안에!",        bg:T.yellowLight, isLevel:true },
                { id:"game-flash",    icon:"🧩", name:"플래시카드",    sub:"🔊 발음 포함",      bg:T.pinkLight,   isLevel:true },
                // 매일/도전 게임 (배지 표시)
                { id:"game-daily",    icon:"📅", name:"데일리 챌린지", sub:"오늘의 5단어",      bg:T.yellowLight, badge:"매일 새로워요!" },
                { id:"game-rpg",      icon:"🗺️", name:"단어 월드 RPG", sub:"보스를 물리쳐요!", bg:T.purpleLight, badge:"🔥 인기" },
                // 신규 게임들
                { id:"game-sentence", icon:"📝", name:"문장 빈칸",     sub:"문장 속 단어 찾기", bg:T.purpleLight },
                { id:"game-memory",   icon:"🧠", name:"메모리 카드",   sub:"짝 맞추기",         bg:T.accentLight },
                { id:"game-anagram",  icon:"🔤", name:"철자 조립",     sub:"섞인 철자 맞추기",  bg:T.greenLight },
                { id:"game-typing",   icon:"⌨️", name:"타이핑 레이스", sub:"단어가 내려와요!",  bg:T.pinkLight },
                { id:"game-relay",    icon:"🔗", name:"단어 릴레이",   sub:"콤보를 이어가요!",  bg:T.tealLight },
                { id:"game-twenty",   icon:"🔍", name:"단어 스무고개", sub:"힌트로 추리해요!",  bg:T.orangeLight },
                { id:"game-picture",  icon:"🖼️", name:"그림 단어",     sub:"그림 보고 맞추기",  bg:T.yellowLight },
                { id:"game-lines",    icon:"🔗", name:"단어 연결",     sub:"영어-한글 매칭",    bg:T.purpleLight },
                { id:"game-search",   icon:"🔍", name:"단어 찾기",     sub:"숨겨진 단어 찾기",  bg:T.greenLight },
                { id:"game-dictation",icon:"🎤", name:"받아쓰기",      sub:"듣고 받아써요",     bg:T.accentLight },
                { id:"game-pronunciation", icon:"🗣️", name:"발음 챌린지", sub:"🎤 AI 발음 채점!", bg:T.purpleLight, badge:"🆕 NEW" },
                { id:"game-wrong",    icon:"📒", name:"오답 노트",     sub:"틀린 단어 복습",    bg:T.redLight },
              ].map(g => (
                <Card key={g.id}
                  onClick={() => {
                    if (g.isLevel) startGame(g);
                    else setScreen(g.id);
                  }}
                  style={{ padding: 14, textAlign: "center", position: "relative" }}>
                  {g.badge && (
                    <div style={{ position: "absolute", top: 6, right: 6, background: T.accent, color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>{g.badge}</div>
                  )}
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: g.bg, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{g.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>{g.sub}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "badge" && (
          <BadgeDisplay student={me} />
        )}

        <Btn v="ghost" size="md" onClick={onLogout} style={{ width: "100%", marginTop: 20, color: T.textDim, fontSize: 12 }}>← 로그아웃</Btn>
      </div>
    </div>

    {/* 뱃지 획득 축하 */}
    {newBadges.length > 0 && (
      <BadgeCelebration badges={newBadges} onClose={() => setNewBadges([])} />
    )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   📝 STUDENT QUIZ — 학생 퀴즈 (과제 풀기)
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
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{score === qset.questions.length ? "🏆" : score >= qset.questions.length * 0.7 ? "🎉" : "💪"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{score} / {qset.questions.length}</div>
          <Card style={{ maxWidth: 320, margin: "14px auto", background: T.yellowLight }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>⭐ +{score * 8} 포인트 획득!</div>
          </Card>
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {qset.questions.map((q, i) => {
            const ok = picks[q.id] === q.ans;
            return (
              <Card key={q.id} style={{ marginBottom: 8, background: ok ? T.greenLight : T.redLight }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Tag color={ok ? "green" : "red"}>{ok ? "✓" : "✗"} Q{i + 1}</Tag>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{q.q}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid, marginLeft: 4 }}>
                  내 답: {MARKS[picks[q.id]] || "—"} / 정답: <strong style={{ color: T.green }}>{MARKS[q.ans]} {q.opts[q.ans]}</strong>
                  {q.exp && <div style={{ marginTop: 2, fontSize: 11 }}>💡 {q.exp}</div>}
                </div>
              </Card>
            );
          })}
          <Btn v="primary" size="lg" onClick={onExit} style={{ width: "100%", marginTop: 10 }}>홈으로</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="blue">{idx + 1} / {qset.questions.length}</Tag>
      </div>

      <div style={{ height: 4, background: T.border, borderRadius: 2, marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${(idx + 1) / qset.questions.length * 100}%`, background: T.accent, borderRadius: 2, transition: "width 0.3s" }} />
      </div>

      <Card style={{ marginBottom: 14, padding: 20 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 6 }}>문제 {idx + 1}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>{q.q}</div>
        {q.opts.filter(o => o).map((o, i) => (
          <button key={i} onClick={() => setPicks({ ...picks, [q.id]: i })} style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "12px 14px", marginBottom: 8, borderRadius: 12,
            border: picks[q.id] === i ? `2px solid ${T.accent}` : `2px solid ${T.border}`,
            background: picks[q.id] === i ? T.accentLight : T.card,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            color: T.text
          }}>
            <span style={{ marginRight: 8, fontWeight: 800, color: T.accent }}>{MARKS[i]}</span>{o}
          </button>
        ))}
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" size="md" onClick={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0} style={{ flex: 1 }}>← 이전</Btn>
        {idx < qset.questions.length - 1
          ? <Btn v="primary" size="md" onClick={() => setIdx(idx + 1)} style={{ flex: 1 }}>다음 →</Btn>
          : <Btn v="success" size="md" onClick={finish} style={{ flex: 1 }}>제출하기 ✓</Btn>
        }
      </div>
    </div>
  );
}
