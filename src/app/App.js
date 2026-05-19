"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { QUESTION_BANK } from "./questionData";
import { WORD_LEVELS, ALL_WORDS, getWordsByLevel } from "./wordData";

// 게임에서 사용할 단어 풀 결정:
//  - levelId === "homework"이면 학생의 활성 단어 숙제(미마스터 단어) 사용
//  - 그 외엔 기존처럼 levelId로 단어 가져오기
function getGameWordPool(levelId, student) {
  if (levelId === "homework") {
    const hw = student?.wordHomework;
    if (hw?.active && hw.words?.length) {
      const notMastered = hw.words.filter(w => !w.mastered);
      return notMastered.length > 0 ? notMastered : hw.words; // 다 마스터하면 복습용으로 전체
    }
  }
  // 망각 곡선 복습 모드: student.reviewWords로 주입된 단어들 사용
  if (levelId === "review" && student?.reviewWords?.length) {
    return student.reviewWords;
  }
  return getWordsByLevel(levelId);
}
import {
  GroupManager, BadgeDisplay, BadgeCelebration, getEarnedBadges,
  NoticeManager, NoticeBanner, GoalManager, StudentGoalWidget,
  WeeklyLeague, SentenceGame, ParentViewer, ReportPrint,
  ScheduleManager, ScheduleBanner,
  StudentDetailReport, AttendanceManager,
  StatsDashboard, StudentDetailModal,
  computeStudentStats, getLevel, LEVEL_INFO,
  WordHomeworkManager, WordHomeworkPrint, WordHomeworkBanner,
  getActiveHomeworkWords, updateWordMastery,
  CustomExamManager, CustomExamPrint, CustomExamBanner, CustomExamPlay
} from "./features";
import {
  MemoryCardGame, DailyChallenge, WrongNoteGame, AnagramGame,
  TypingRace, WordRelay, WordTwenty, WordWorldRPG, recordWrong,
  PictureWordGame, WordMatchLines, WordSearchGame, DictationGame
} from "./games";
import { AIQuestionGenerator } from "./aiQuestions";
import { supabase, isSupabaseReady, testConnection, getAdapter } from "./supabaseClient";
import { SupabaseMigration } from "./SupabaseMigration";
import { MyWordbook } from "./MyWordbook";
import { ReviewCard } from "./ReviewCard";
import { StudentWordStatsCard } from "./StudentWordStatsCard";
import { PronunciationGame } from "./PronunciationGame";
import { PronunciationWidget } from "./PronunciationWidget";
import { recordWordEncounter } from "./studentWords";
import { addToWordbook, removeFromWordbook, isInWordbook } from "./studentWords";

// ── 음성 합성 (발음 기능) ─────────────────────────────────────────────────
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // 이전 재생 중지
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("Speech synthesis error:", e);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//   ANGELA'S ENGLISH ACADEMY - 통합 App.js
//   ✓ 선생님 모드: 문제은행 / 출제 / 시험지 / 학생 진도·통계 대시보드
//   ✓ 학생 모드: 과제 풀기 / 단어 게임 4종 (자동 기록 저장)
// ══════════════════════════════════════════════════════════════════════════

// ── THEME ─────────────────────────────────────────────────────────────────
const T = {
  bg: "#f0f7ff",
  card: "#ffffff",
  border: "#dce8ff",
  accent: "#4f8ef7",
  accentDark: "#2563eb",
  accentLight: "#e8f0ff",
  green: "#22c55e",
  greenLight: "#dcfce7",
  red: "#ef4444",
  redLight: "#fee2e2",
  yellow: "#f59e0b",
  yellowLight: "#fef3c7",
  purple: "#a855f7",
  purpleLight: "#f3e8ff",
  pink: "#ec4899",
  pinkLight: "#fce7f3",
  orange: "#f97316",
  orangeLight: "#fff7ed",
  teal: "#14b8a6",
  tealLight: "#ccfbf1",
  text: "#1e293b",
  textMid: "#64748b",
  textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
  shadowLg: "0 8px 32px rgba(79,142,247,0.18)",
};

const GRADES = ["초등3","초등4","초등5","초등6","중1","중2","중3"];
const TAGS = ["be동사","일반동사","조동사","시제","의문문","부정문","어휘","기타"];
const MARKS = ["①","②","③","④","⑤"];
const AVATARS = ["🦊","🐰","🐻","🦁","🐼","🐨","🦝","🐯","🐶","🐱","🐵","🦄"];

let _uid = Date.now();
const uid = () => (++_uid).toString(36);

// ── 화면 크기 감지 훅 (반응형) ────────────────────────────────────────────
// 모바일(<640) / 태블릿(640-1023) / 노트북(1024-1439) / 대형(≥1440)
function useResponsive() {
  const [size, setSize] = useState({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLarge: false,
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const w = window.innerWidth;
      setSize({
        width: w,
        isMobile: w < 640,
        isTablet: w >= 640 && w < 1024,
        isDesktop: w >= 1024 && w < 1440,
        isLarge: w >= 1440,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

// localStorage 훅 — SSR/hydration 안전 버전
// 서버와 클라이언트 첫 렌더를 항상 initial로 맞추고,
// 마운트 후 useEffect에서 localStorage 값으로 교체
function useStorage(key, initial) {
  const [val, setVal] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  const saveTimeoutRef = useRef(null);

  // 마운트 시: Supabase 우선, 실패 시 localStorage 폴백
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const adapter = getAdapter(key);
      // 1) Supabase 시도
      if (adapter && isSupabaseReady()) {
        try {
          const data = await adapter.fetch();
          if (!cancelled && data !== undefined && data !== null) {
            setVal(data);
            try { window.localStorage.setItem(key, JSON.stringify(data)); } catch {}
            setHydrated(true);
            return;
          }
        } catch (e) {
          console.warn(`Supabase 읽기 실패 (${key}), localStorage 폴백:`, e.message);
        }
      }
      // 2) localStorage 폴백
      try {
        const v = window.localStorage.getItem(key);
        if (!cancelled && v !== null) setVal(JSON.parse(v));
      } catch {}
      if (!cancelled) setHydrated(true);
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 값 변경 시: localStorage 즉시 저장 + Supabase는 500ms 디바운스
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
    const adapter = getAdapter(key);
    if (adapter && isSupabaseReady()) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await adapter.save(val);
        } catch (e) {
          console.warn(`Supabase 저장 실패 (${key}):`, e.message);
        }
      }, 500);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [key, val, hydrated]);

  return [val, setVal, hydrated];
}
// 학생 기록 저장 헬퍼
function saveStudentRecord(setStudents, name, record) {
  setStudents(prev => {
    const cur = prev[name] || {
      name,
      joinDate: new Date().toISOString().slice(0, 10),
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      grade: "초등5",
      points: 0,
      records: []
    };
    const updated = {
      ...cur,
      points: (cur.points || 0) + (record.points || 0),
      records: [
        ...(cur.records || []),
        { ...record, date: new Date().toISOString() }
      ].slice(-50) // 최근 50개만 유지
    };
    return { ...prev, [name]: updated };
  });
}

// ── 단어 게임용 단어 데이터 (wordData.js에서 import - 380개) ─────────────
const WORDS = ALL_WORDS;

// ── INIT 문제은행 (questionData.js에서 import - 900문제) ─────────────────
const INIT_BANK = QUESTION_BANK;

// ── UI 컴포넌트 ───────────────────────────────────────────────────────────
function Btn({ children, onClick, v = "primary", size = "md", style = {}, disabled, type = "button" }) {
  const variants = {
    primary: { bg: T.accent, color: "white", hover: T.accentDark },
    secondary: { bg: T.accentLight, color: T.accent, hover: "#d7e5ff" },
    danger: { bg: T.red, color: "white", hover: "#dc2626" },
    success: { bg: T.green, color: "white", hover: "#16a34a" },
    ghost: { bg: "transparent", color: T.textMid, hover: T.bg },
  };
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "9px 18px", fontSize: 13 },
    lg: { padding: "12px 22px", fontSize: 14 },
  };
  const vs = variants[v];
  const sz = sizes[size];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...sz, background: disabled ? "#cbd5e1" : vs.bg, color: vs.color,
      border: "none", borderRadius: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.15s", boxShadow: v === "primary" || v === "danger" || v === "success" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
      ...style
    }}>{children}</button>
  );
}

function Tag({ children, color = "blue" }) {
  const colors = {
    blue: { c: T.accent, b: T.accentLight },
    green: { c: T.green, b: T.greenLight },
    red: { c: T.red, b: T.redLight },
    yellow: { c: T.yellow, b: T.yellowLight },
    purple: { c: T.purple, b: T.purpleLight },
    pink: { c: T.pink, b: T.pinkLight },
    orange: { c: T.orange, b: T.orangeLight },
  };
  const cl = colors[color] || colors.blue;
  return <span style={{
    fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 7,
    color: cl.c, background: cl.b, letterSpacing: 0.3
  }}>{children}</span>;
}

function Card({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{
    background: T.card, borderRadius: 16, padding: 16,
    boxShadow: T.shadow, border: `1px solid ${T.border}`,
    cursor: onClick ? "pointer" : "default",
    ...style
  }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type = "text", style = {} }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
    padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`,
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
    transition: "border-color 0.15s",
    ...style
  }} onFocus={e => e.target.style.borderColor = T.accent}
     onBlur={e => e.target.style.borderColor = T.border} />;
}

// ══════════════════════════════════════════════════════════════════════════
//   LANDING & LOGIN
// ══════════════════════════════════════════════════════════════════════════

function Landing({ onTeacher, onStudent }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🎀</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "white", marginBottom: 4 }}>
          Angela's English Academy
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 40 }}>
          앤젤라 선생님의 영어 학원에 오신 걸 환영해요!
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card onClick={onTeacher} style={{
            padding: "28px 16px", textAlign: "center",
            transition: "all 0.2s", border: "2px solid transparent"
          }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>👩‍🏫</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>선생님</div>
            <div style={{ fontSize: 11, color: T.textMid }}>출제 · 학생 관리</div>
          </Card>

          <Card onClick={onStudent} style={{
            padding: "28px 16px", textAlign: "center",
            transition: "all 0.2s", border: "2px solid transparent"
          }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🧒</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>학생</div>
            <div style={{ fontSize: 11, color: T.textMid }}>과제 · 게임</div>
          </Card>
        </div>

        <div style={{ marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
          made with 💙 for Angela
        </div>
      </div>
    </div>
  );
}

function TeacherLogin({ savedPw, onSuccess, onBack }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (pw === savedPw) onSuccess();
    else { setErr("비밀번호가 틀려요!"); setPw(""); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <Card style={{ maxWidth: 380, width: "100%", padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>선생님 로그인</div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>비밀번호를 입력해주세요</div>
        </div>
        <Input
          type="password" value={pw}
          onChange={e => { setPw(e.target.value); setErr(""); }}
          placeholder="비밀번호"
          style={{ marginBottom: 8, fontSize: 18, textAlign: "center", letterSpacing: 4 }}
        />
        {err && <div style={{ color: T.red, fontSize: 12, textAlign: "center", marginBottom: 8 }}>{err}</div>}
        <Btn v="primary" size="lg" onClick={submit} style={{ width: "100%", marginTop: 8 }}>입장하기</Btn>
        <Btn v="ghost" size="md" onClick={onBack} style={{ width: "100%", marginTop: 8 }}>← 처음으로</Btn>
      </Card>
    </div>
  );
}

function StudentLogin({ onSuccess, onBack, students }) {
  const [search, setSearch] = useState("");
  const studentList = Object.values(students || {});
  const hasStudents = studentList.length > 0;

  // 학생이 많을 때만 검색창 표시
  const showSearch = studentList.length > 8;

  const filtered = showSearch && search.trim()
    ? studentList.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : studentList;

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${T.pink} 0%, ${T.accent} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <Card style={{ maxWidth: 520, width: "100%", padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>✨</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: T.text }}>내 이름을 골라주세요</div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>
            {hasStudents ? "오늘도 영어 공부 화이팅!" : "아직 등록된 학생이 없어요"}
          </div>
        </div>

        {/* 학생이 많으면 검색 표시 */}
        {showSearch && (
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 이름으로 찾기"
            style={{ marginBottom: 12, fontSize: 13 }}
          />
        )}

        {/* 등록된 학생 카드 목록 */}
        {hasStudents ? (
          <div style={{
            maxHeight: 380, overflowY: "auto", marginBottom: 16, padding: 2,
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10
          }}>
            {filtered.length === 0 ? (
              <div style={{ gridColumn: "1/-1", padding: 24, textAlign: "center", color: T.textDim, fontSize: 12 }}>
                검색 결과가 없어요
              </div>
            ) : filtered.map(s => (
              <button key={s.name} onClick={() => onSuccess(s.name)}
                style={{
                  background: T.card, border: `2px solid ${T.border}`,
                  borderRadius: 14, padding: "14px 8px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  transition: "all 0.12s"
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.accentLight; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; e.currentTarget.style.transform = "none"; }}>
                <div style={{ fontSize: 36 }}>{s.avatar || "🙂"}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, textAlign: "center", lineHeight: 1.2 }}>{s.name}</div>
                {s.grade && <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700 }}>{s.grade}</div>}
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            background: T.yellowLight, color: T.text, fontSize: 12,
            padding: 18, borderRadius: 10, marginBottom: 14, textAlign: "center", lineHeight: 1.6
          }}>
            💡 선생님께서 [학생 관리]에서<br/>먼저 등록해주셔야 입장할 수 있어요.
          </div>
        )}

        <Btn v="ghost" size="md" onClick={onBack} style={{ width: "100%" }}>← 처음으로</Btn>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   학생 진도 & 통계 대시보드 (선생님용)
// ══════════════════════════════════════════════════════════════════════════



// ── 학생 상세 모달 ────────────────────────────────────────────────────────
function QuestionBank({ bank, setBank }) {
  const [selId, setSelId] = useState(Object.keys(bank)[0] || null);
  const [editing, setEditing] = useState(null);
  const [aiMode, setAiMode] = useState(false); // AI 생성 화면 토글
  const sel = selId ? bank[selId] : null;

  // AI 생성 화면
  if (aiMode) {
    return <AIQuestionGenerator bank={bank} setBank={setBank} onBack={() => setAiMode(false)} />;
  }

  const addSet = () => {
    const id = uid();
    setBank({ ...bank, [id]: { id, title: "새 문제집", grade: "초등5", tag: "어휘", questions: [] } });
    setSelId(id);
  };

  const delSet = (id) => {
    if (!confirm("정말 삭제할까요?")) return;
    const nb = { ...bank };
    delete nb[id];
    setBank(nb);
    setSelId(Object.keys(nb)[0] || null);
  };

  const updSet = (k, v) => setBank({ ...bank, [selId]: { ...sel, [k]: v } });

  const addQ = () => {
    const nq = { id: Date.now(), q: "", opts: ["", "", "", "", ""], ans: 0, exp: "" };
    updSet("questions", [...sel.questions, nq]);
    setEditing(nq.id);
  };

  const updQ = (qid, k, v) => {
    updSet("questions", sel.questions.map(q => q.id === qid ? { ...q, [k]: v } : q));
  };

  const updOpt = (qid, idx, v) => {
    const q = sel.questions.find(q => q.id === qid);
    const opts = [...q.opts];
    opts[idx] = v;
    updQ(qid, "opts", opts);
  };

  const delQ = (qid) => updSet("questions", sel.questions.filter(q => q.id !== qid));

  return (
    <div>
      {/* AI 생성 배너 */}
      <div style={{background:`linear-gradient(135deg,${T.purple},${T.accent})`,borderRadius:14,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div style={{color:"white"}}>
          <div style={{fontSize:13,fontWeight:900}}>🤖 AI 문제 자동 생성</div>
          <div style={{fontSize:11,opacity:.85,marginTop:2}}>주제만 입력하면 Claude가 즉시 생성!</div>
        </div>
        <Btn v="secondary" size="sm" onClick={() => setAiMode(true)} style={{background:"rgba(255,255,255,0.9)",color:T.purple,fontWeight:900,flexShrink:0}}>
          AI 생성 →
        </Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {Object.values(bank).map(s => (
          <button key={s.id} onClick={() => setSelId(s.id)} style={{
            padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: selId === s.id ? T.accent : T.card,
            color: selId === s.id ? "white" : T.text,
            fontSize: 12, fontWeight: 700,
            boxShadow: selId === s.id ? T.shadow : "0 1px 4px rgba(0,0,0,0.05)"
          }}>{s.title}</button>
        ))}
        <Btn v="secondary" size="md" onClick={addSet}>+ 새 문제집</Btn>
      </div>

      {sel && (
        <Card>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Input value={sel.title} onChange={e => updSet("title", e.target.value)} style={{ flex: 1, minWidth: 200 }} placeholder="문제집 제목" />
            <select value={sel.grade} onChange={e => updSet("grade", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13 }}>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={sel.tag} onChange={e => updSet("tag", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13 }}>
              {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Btn v="danger" size="sm" onClick={() => delSet(sel.id)}>삭제</Btn>
          </div>

          <div style={{ marginBottom: 10, fontSize: 12, color: T.textMid, fontWeight: 700 }}>
            문항 {sel.questions.length}개
          </div>

          {sel.questions.map((q, i) => {
            const isEdit = editing === q.id;
            return (
              <Card key={q.id} style={{ marginBottom: 8, background: T.bg, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Tag color="blue">Q{i + 1}</Tag>
                  <div style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 600 }}>{q.q || "(질문 미입력)"}</div>
                  <Btn v="ghost" size="sm" onClick={() => setEditing(isEdit ? null : q.id)}>{isEdit ? "닫기" : "편집"}</Btn>
                  <Btn v="danger" size="sm" onClick={() => delQ(q.id)}>삭제</Btn>
                </div>
                {isEdit && (
                  <div style={{ marginTop: 10 }}>
                    <Input value={q.q} onChange={e => updQ(q.id, "q", e.target.value)} placeholder="문제" style={{ marginBottom: 6 }} />
                    {q.opts.map((o, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                        <button onClick={() => updQ(q.id, "ans", idx)} style={{
                          width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                          background: q.ans === idx ? T.green : T.card,
                          color: q.ans === idx ? "white" : T.textMid,
                          fontWeight: 800, fontSize: 12
                        }}>{MARKS[idx]}</button>
                        <Input value={o} onChange={e => updOpt(q.id, idx, e.target.value)} placeholder={`보기 ${idx + 1}`} style={{ flex: 1 }} />
                      </div>
                    ))}
                    <Input value={q.exp || ""} onChange={e => updQ(q.id, "exp", e.target.value)} placeholder="해설 (선택)" style={{ marginTop: 6 }} />
                  </div>
                )}
              </Card>
            );
          })}

          <Btn v="secondary" size="md" onClick={addQ} style={{ width: "100%", marginTop: 10 }}>+ 문항 추가</Btn>
        </Card>
      )}
    </div>
  );
}

function ExamBuilder({ bank, setExams, onNav }) {
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("초등5");
  const [selectedSets, setSelectedSets] = useState([]);
  const [timeLimit, setTimeLimit] = useState("");

  const toggle = (id) => setSelectedSets(selectedSets.includes(id)
    ? selectedSets.filter(x => x !== id)
    : [...selectedSets, id]);

  const totalQ = selectedSets.reduce((a, id) => a + (bank[id]?.questions.length || 0), 0);

  const create = () => {
    if (!title.trim() || selectedSets.length === 0) {
      alert("제목과 문제집을 선택해주세요!");
      return;
    }
    const questions = selectedSets.flatMap(id => bank[id]?.questions || []);
    const newExam = {
      id: uid(), title, grade, timeLimit: Number(timeLimit) || null,
      questions, setIds: selectedSets,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setExams(prev => [newExam, ...prev]);
    alert("시험지가 생성되었어요!");
    onNav("exams");
  };

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>📝 시험 정보</div>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="시험 제목" style={{ marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={grade} onChange={e => setGrade(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13 }}>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <Input value={timeLimit} onChange={e => setTimeLimit(e.target.value)} placeholder="시간(분, 선택)" type="number" style={{ flex: 1 }} />
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>📚 문제집 선택</div>
          <Tag color="blue">{selectedSets.length}개 / 총 {totalQ}문항</Tag>
        </div>
        {Object.values(bank).map(s => (
          <div key={s.id} onClick={() => toggle(s.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: 10, marginBottom: 6,
            background: selectedSets.includes(s.id) ? T.accentLight : T.bg,
            borderRadius: 10, cursor: "pointer",
            border: selectedSets.includes(s.id) ? `2px solid ${T.accent}` : "2px solid transparent"
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7,
              background: selectedSets.includes(s.id) ? T.accent : T.card,
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900
            }}>{selectedSets.includes(s.id) ? "✓" : ""}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.title}</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{s.grade} · {s.tag} · {s.questions.length}문항</div>
            </div>
          </div>
        ))}

        <Btn v="primary" size="lg" onClick={create} style={{ width: "100%", marginTop: 12 }} disabled={!title.trim() || selectedSets.length === 0}>
          ✨ 시험지 생성 ({totalQ}문항)
        </Btn>
      </Card>
    </div>
  );
}

function ExamList({ exams, setExams, onNav }) {
  const del = (id) => {
    if (!confirm("삭제할까요?")) return;
    setExams(exams.filter(e => e.id !== id));
  };

  if (exams.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>📭</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>아직 시험지가 없어요</div>
        <div style={{ fontSize: 12, color: T.textMid }}>"출제" 메뉴에서 새 시험지를 만들어보세요!</div>
      </Card>
    );
  }

  return (
    <div>
      {exams.map(e => (
        <Card key={e.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 6 }}>{e.title}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <Tag color="blue">{e.grade}</Tag>
                <Tag color="green">{e.questions.length}문항</Tag>
                {e.timeLimit && <Tag color="yellow">{e.timeLimit}분</Tag>}
                <Tag color="purple">{e.createdAt}</Tag>
              </div>
            </div>
            <Btn v="primary" size="sm" onClick={() => onNav("exam-view", e.id)}>🖨️ 출력</Btn>
            <Btn v="danger" size="sm" onClick={() => del(e.id)}>삭제</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExamPrintView({ exam, onBack }) {
  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Btn v="ghost" onClick={onBack}>← 목록</Btn>
        <Btn v="primary" onClick={() => window.print()}>🖨️ 인쇄 / PDF 저장</Btn>
      </div>
      <div style={{ background: "white", padding: 32, borderRadius: 12, fontFamily: "serif" }}>
        <div style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid #333", paddingBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{exam.title}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
            {exam.grade} · {exam.questions.length}문항 {exam.timeLimit ? `· 제한시간 ${exam.timeLimit}분` : ""}
          </div>
          <div style={{ marginTop: 14, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>이름: __________________</span>
            <span>점수: ______ / 100</span>
          </div>
        </div>
        {exam.questions.map((q, i) => (
          <div key={q.id} style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{i + 1}. {q.q}</div>
            {q.opts.filter(o => o).map((o, idx) => (
              <div key={idx} style={{ fontSize: 13, padding: "3px 0", paddingLeft: 16 }}>{MARKS[idx]} {o}</div>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 30, pageBreakBefore: "always" }}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, borderBottom: "1px solid #333", paddingBottom: 6 }}>정답 및 해설</div>
          {exam.questions.map((q, i) => (
            <div key={q.id} style={{ marginBottom: 8, fontSize: 12 }}>
              <strong>{i + 1}.</strong> 정답 {MARKS[q.ans]} {q.exp && <span style={{ color: "#555" }}>— {q.exp}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   TEACHER APP SHELL
// ══════════════════════════════════════════════════════════════════════════

const TEACHER_NAV = [
  { id: "dashboard",      icon: "🏠", label: "홈" },
  { id: "word-homework",  icon: "📚", label: "단어숙제" },
  { id: "manage",         icon: "👤", label: "학생관리" },
  { id: "assign",         icon: "📬", label: "과제배정" },
  { id: "more",           icon: "✨", label: "더보기" },
];

// ══════════════════════════════════════════════════════════════════════════
//   학생 관리 화면 (선생님용)
// ══════════════════════════════════════════════════════════════════════════
function StudentManager({ students, setStudents }) {
  const [mode, setMode] = useState("list"); // list | add | edit | csv
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name | grade | points | recent

  // 추가/편집 폼 상태
  const [form, setForm] = useState({ name: "", grade: "초등5", avatar: "🦊", memo: "" });
  const [formErr, setFormErr] = useState("");

  // CSV 일괄 등록 상태
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvMsg, setCsvMsg] = useState("");

  const studentList = Object.values(students || {});

  // ── CSV 파일 업로드 ─────────────────────────────────────────
  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // UTF-8 BOM 제거 (엑셀 호환)
      let text = ev.target.result || "";
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // CSV 파싱 (간단 버전 — 쉼표 구분, 줄바꿈으로 행 구분)
  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setCsvPreview([]); return; }

    // 첫 줄이 헤더인지 자동 감지 (이름/name 포함 여부)
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("이름") || firstLine.includes("name");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const rows = dataLines.map(line => {
      const cols = line.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        name: cols[0] || "",
        grade: cols[1] || "초등5",
        memo: cols[2] || "",
        // 중복 체크
        duplicate: !!students[cols[0]?.trim()],
        valid: cols[0]?.trim().length >= 2,
      };
    });
    setCsvPreview(rows);
  };

  // CSV로 일괄 등록 실행
  const applyCsv = () => {
    const validRows = csvPreview.filter(r => r.valid && !r.duplicate);
    if (validRows.length === 0) { setCsvMsg("등록할 학생이 없어요"); return; }
    if (!confirm(`${validRows.length}명의 학생을 등록할까요?`)) return;

    setStudents(prev => {
      const next = { ...prev };
      validRows.forEach(r => {
        next[r.name] = {
          name: r.name,
          grade: r.grade || "초등5",
          avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
          memo: r.memo || "",
          joinDate: new Date().toISOString().slice(0, 10),
          points: 0,
          records: []
        };
      });
      return next;
    });
    setCsvMsg(`✅ ${validRows.length}명 등록 완료!`);
    setTimeout(() => { setMode("list"); setCsvText(""); setCsvPreview([]); setCsvMsg(""); }, 1500);
  };

  // CSV 템플릿 다운로드
  const downloadTemplate = () => {
    const csv = "이름,학년,메모\n홍길동,초등3,영어초보\n김민수,초등5,발음좋음\n이서연,중1,단어부족";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학생명단_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 학습 기록 CSV 내보내기 (전체 학생 또는 한 명)
  const exportStudentsCSV = () => {
    const rows = [
      ["이름","학년","가입일","총 포인트","활동수","최근 활동","평균 정답률"],
    ];
    studentList.forEach(s => {
      const records = s.records || [];
      const accuracies = records.filter(r => r.total > 0).map(r => r.score / r.total);
      const avgAcc = accuracies.length > 0
        ? Math.round(accuracies.reduce((a,b) => a+b, 0) / accuracies.length * 100) + "%"
        : "-";
      const last = records.slice(-1)[0]?.date?.slice(0, 10) || "-";
      rows.push([
        s.name, s.grade || "-", s.joinDate || "-",
        s.points || 0, records.length, last, avgAcc
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `학생목록_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = studentList
    .filter(s => !search || s.name.includes(search))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "grade") return (a.grade || "").localeCompare(b.grade || "");
      if (sortBy === "points") return (b.points || 0) - (a.points || 0);
      if (sortBy === "recent") {
        const la = a.records?.slice(-1)[0]?.date || "";
        const lb = b.records?.slice(-1)[0]?.date || "";
        return lb.localeCompare(la);
      }
      return 0;
    });

  const openAdd = () => {
    setForm({ name: "", grade: "초등5", avatar: "🦊", memo: "" });
    setFormErr("");
    setMode("add");
  };

  const openEdit = (s) => {
    setForm({ name: s.name, grade: s.grade || "초등5", avatar: s.avatar || "🦊", memo: s.memo || "" });
    setEditTarget(s.name);
    setFormErr("");
    setMode("edit");
  };

  const saveAdd = () => {
    const n = form.name.trim();
    if (!n) { setFormErr("이름을 입력해주세요"); return; }
    if (n.length < 2) { setFormErr("이름은 2자 이상이어야 해요"); return; }
    if (students[n]) { setFormErr("이미 같은 이름의 학생이 있어요"); return; }
    setStudents(prev => ({
      ...prev,
      [n]: {
        name: n,
        grade: form.grade,
        avatar: form.avatar,
        memo: form.memo,
        joinDate: new Date().toISOString().slice(0, 10),
        points: 0,
        records: []
      }
    }));
    setMode("list");
  };

  const saveEdit = () => {
    const n = form.name.trim();
    if (!n) { setFormErr("이름을 입력해주세요"); return; }
    setStudents(prev => {
      const old = prev[editTarget];
      const updated = { ...old, grade: form.grade, avatar: form.avatar, memo: form.memo };
      // 이름이 바뀌면 key도 교체
      if (n !== editTarget) {
        if (prev[n]) { setFormErr("이미 같은 이름의 학생이 있어요"); return prev; }
        updated.name = n;
        const next = { ...prev };
        delete next[editTarget];
        next[n] = updated;
        return next;
      }
      return { ...prev, [editTarget]: updated };
    });
    setMode("list");
  };

  const deleteStudent = (name) => {
    if (!confirm(`"${name}" 학생을 삭제할까요?\n학습 기록도 모두 삭제됩니다.`)) return;
    setStudents(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const resetRecords = (name) => {
    if (!confirm(`"${name}" 학생의 학습 기록만 초기화할까요?`)) return;
    setStudents(prev => ({
      ...prev,
      [name]: { ...prev[name], records: [], points: 0 }
    }));
  };

  // ── 학생 추가/편집 폼 ──
  // ── CSV 일괄 등록 화면 ────────────────────────────────
  if (mode === "csv") {
    const validCount = csvPreview.filter(r => r.valid && !r.duplicate).length;
    const dupCount = csvPreview.filter(r => r.duplicate).length;
    const invalidCount = csvPreview.filter(r => !r.valid).length;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Btn v="ghost" size="sm" onClick={() => { setMode("list"); setCsvText(""); setCsvPreview([]); setCsvMsg(""); }}>← 뒤로</Btn>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>📥 CSV로 학생 일괄 등록</div>
        </div>

        <Card style={{ marginBottom: 12, padding: 14, background: T.accentLight }}>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>
            <strong>📋 사용 방법:</strong><br/>
            ① 엑셀에서 <strong>이름,학년,메모</strong> 순서로 적고 CSV로 저장<br/>
            ② 아래 버튼으로 파일 업로드 (또는 텍스트 직접 입력)<br/>
            ③ 미리보기 확인 후 등록
          </div>
          <button onClick={downloadTemplate} style={{
            marginTop: 10, background: T.card, border: `1px solid ${T.accent}`,
            borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: T.accent, cursor: "pointer"
          }}>📄 양식 다운로드 (CSV 파일)</button>
        </Card>

        <Card style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: T.text }}>1. 파일 업로드 또는 텍스트 붙여넣기</div>
          <label style={{
            display: "block", width: "100%", textAlign: "center", marginBottom: 8,
            background: T.accent, color: "white", border: "none", borderRadius: 10,
            padding: "10px", fontSize: 12, fontWeight: 800, cursor: "pointer"
          }}>
            📂 CSV 파일 선택
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ display: "none" }} />
          </label>
          <textarea
            value={csvText}
            onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
            placeholder={"또는 여기에 직접 입력 (한 줄에 한 명):\n이름,학년,메모\n홍길동,초등3,영어초보\n김민수,초등5,발음좋음"}
            style={{
              width: "100%", minHeight: 100, padding: 10, borderRadius: 8,
              border: `1px solid ${T.border}`, fontSize: 12, fontFamily: "monospace",
              background: T.bg, color: T.text, resize: "vertical"
            }}
          />
        </Card>

        {csvPreview.length > 0 && (
          <Card style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: T.text }}>2. 미리보기 ({csvPreview.length}행)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, fontSize: 11, flexWrap: "wrap" }}>
              <span style={{ background: T.greenLight, color: T.green, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>✅ 등록 가능 {validCount}</span>
              {dupCount > 0 && <span style={{ background: T.yellowLight, color: T.orange, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>⚠️ 중복 {dupCount}</span>}
              {invalidCount > 0 && <span style={{ background: T.redLight, color: T.red, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>❌ 오류 {invalidCount}</span>}
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead style={{ background: T.bg, position: "sticky", top: 0 }}>
                  <tr>
                    <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>상태</th>
                    <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>이름</th>
                    <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>학년</th>
                    <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((r, i) => (
                    <tr key={i} style={{
                      background: r.duplicate ? T.yellowLight : !r.valid ? T.redLight : "transparent",
                      borderBottom: `1px solid ${T.border}`
                    }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>
                        {!r.valid ? "❌" : r.duplicate ? "⚠️" : "✅"}
                      </td>
                      <td style={{ padding: 6, fontWeight: 700 }}>{r.name || "(빈 이름)"}</td>
                      <td style={{ padding: 6 }}>{r.grade}</td>
                      <td style={{ padding: 6, color: T.textMid }}>{r.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {csvPreview.length > 0 && (
          <button onClick={applyCsv} disabled={validCount === 0} style={{
            width: "100%", background: validCount === 0 ? T.border : T.green,
            color: "white", border: "none", borderRadius: 12, padding: 14,
            fontSize: 14, fontWeight: 900, cursor: validCount === 0 ? "not-allowed" : "pointer"
          }}>
            ✅ {validCount}명 등록하기
          </button>
        )}
        {csvMsg && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, fontWeight: 700,
            color: csvMsg.startsWith("✅") ? T.green : T.red }}>
            {csvMsg}
          </div>
        )}
      </div>
    );
  }

  if (mode === "add" || mode === "edit") {
    const isEdit = mode === "edit";
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Btn v="ghost" size="sm" onClick={() => setMode("list")}>← 뒤로</Btn>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>
            {isEdit ? "✏️ 학생 정보 수정" : "➕ 새 학생 추가"}
          </div>
        </div>

        <Card style={{ marginBottom: 14 }}>
          {/* 아바타 선택 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>아바타 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["🦊","🐰","🐻","🦁","🐼","🐨","🦝","🐯","🐶","🐱","🐵","🦄","🐸","🐧","🦋","🐬","🦉","🐺"].map(av => (
              <button key={av} onClick={() => setForm(f => ({ ...f, avatar: av }))} style={{
                width: 40, height: 40, borderRadius: 11, fontSize: 22, border: "none", cursor: "pointer",
                background: form.avatar === av ? T.accent + "30" : T.bg,
                outline: form.avatar === av ? `2.5px solid ${T.accent}` : "none",
                transition: "all 0.15s"
              }}>{av}</button>
            ))}
          </div>

          {/* 미리보기 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: T.accentLight, borderRadius: 12, marginBottom: 16
          }}>
            <div style={{ fontSize: 36 }}>{form.avatar}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{form.name || "이름 입력 전"}</div>
              <div style={{ fontSize: 11, color: T.textMid }}>{form.grade}</div>
            </div>
          </div>

          {/* 이름 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>학생 이름 *</div>
          <Input
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErr(""); }}
            placeholder="예: 김민준"
            style={{ marginBottom: 12 }}
          />

          {/* 학년 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>학년</div>
          <select
            value={form.grade}
            onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${T.border}`, fontSize: 14, marginBottom: 12,
              boxSizing: "border-box"
            }}
          >
            {["유치원","초등1","초등2","초등3","초등4","초등5","초등6","중1","중2","중3"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* 메모 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>메모 (선택)</div>
          <textarea
            value={form.memo}
            onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="특이사항, 학습 목표 등 자유롭게 적어주세요"
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${T.border}`, fontSize: 13, resize: "vertical",
              boxSizing: "border-box", fontFamily: "inherit"
            }}
          />

          {formErr && (
            <div style={{ color: T.red, fontSize: 12, fontWeight: 700, marginTop: 8 }}>⚠️ {formErr}</div>
          )}
        </Card>

        <Btn v="primary" size="lg" onClick={isEdit ? saveEdit : saveAdd} style={{ width: "100%" }}>
          {isEdit ? "✅ 수정 완료" : "✅ 학생 추가"}
        </Btn>
        {isEdit && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn v="secondary" size="md" onClick={() => resetRecords(editTarget)} style={{ flex: 1 }}>
              🔄 학습기록 초기화
            </Btn>
            <Btn v="danger" size="md" onClick={() => { deleteStudent(editTarget); setMode("list"); }} style={{ flex: 1 }}>
              🗑️ 학생 삭제
            </Btn>
          </div>
        )}
      </div>
    );
  }

  // ── 학생 목록 ──
  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>👤 학생 관리</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>총 {studentList.length}명 등록됨</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setMode("csv")} title="CSV로 일괄 등록"
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", color: T.text }}>
            📥 CSV 등록
          </button>
          {studentList.length > 0 && (
            <button onClick={exportStudentsCSV} title="학생 목록 엑셀로 내보내기"
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", color: T.text }}>
              📤 내보내기
            </button>
          )}
          <Btn v="primary" size="md" onClick={openAdd}>+ 학생 추가</Btn>
        </div>
      </div>

      {/* 검색 */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 이름으로 검색"
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 12px",
          borderRadius: 11, border: `1.5px solid ${T.border}`,
          fontSize: 13, marginBottom: 10, outline: "none"
        }}
      />

      {/* 정렬 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "name", label: "이름순" },
          { id: "grade", label: "학년순" },
          { id: "points", label: "포인트순" },
          { id: "recent", label: "최근활동순" },
        ].map(s => (
          <button key={s.id} onClick={() => setSortBy(s.id)} style={{
            padding: "5px 11px", borderRadius: 8, border: "none", fontSize: 11,
            fontWeight: 800, cursor: "pointer",
            background: sortBy === s.id ? T.accent : T.accentLight,
            color: sortBy === s.id ? "white" : T.accent,
          }}>{s.label}</button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            {studentList.length === 0 ? "등록된 학생이 없어요" : "검색 결과가 없어요"}
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginBottom: 16 }}>
            {studentList.length === 0
              ? "위 [+ 학생 추가] 버튼으로 학생을 등록해주세요.\n등록된 학생만 학생 모드로 입장 가능합니다."
              : "다른 이름으로 검색해보세요"}
          </div>
          {studentList.length === 0 && (
            <Btn v="primary" size="lg" onClick={openAdd}>+ 첫 번째 학생 추가하기</Btn>
          )}
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(s => {
            const stats = computeStudentStats(s);
            const lvl = LEVEL_INFO[stats.level];
            const lastDate = s.records?.slice(-1)[0]?.date?.slice(0, 10);
            const today = new Date().toISOString().slice(0, 10);
            const lastActive = !lastDate ? "기록없음"
              : lastDate === today ? "오늘"
              : (() => {
                  const diff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
                  return diff === 1 ? "어제" : `${diff}일 전`;
                })();

            return (
              <Card key={s.name} style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* 아바타 */}
                  <div style={{
                    width: 50, height: 50, borderRadius: 14, background: lvl.bg, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28
                  }}>{s.avatar || "🧑"}</div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{s.name}</span>
                      <Tag color="blue">{s.grade || "학년 미정"}</Tag>
                      <Tag color={stats.level === "A" ? "green" : stats.level === "B" ? "blue" : "orange"}>
                        {lvl.icon} {lvl.label}
                      </Tag>
                      {lastActive === "오늘" && <Tag color="green">● 활동중</Tag>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMid }}>
                      ⭐ {s.points || 0}p · 📝 {stats.totalAssign}과제 · 🎮 {stats.totalGames}게임 · {lastActive}
                    </div>
                    {s.memo && (
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 3, fontStyle: "italic" }}>
                        📌 {s.memo}
                      </div>
                    )}
                  </div>

                  {/* 편집 버튼 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <Btn v="secondary" size="sm" onClick={() => openEdit(s)}>✏️ 수정</Btn>
                    <Btn v="danger" size="sm" onClick={() => deleteStudent(s.name)}>🗑️</Btn>
                  </div>
                </div>

                {/* 진도바 */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMid, marginBottom: 3 }}>
                    <span>정답률</span>
                    <span style={{ fontWeight: 800, color: stats.accuracy >= 80 ? T.green : stats.accuracy >= 60 ? T.yellow : T.red }}>
                      {stats.accuracy}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, transition: "width 0.5s",
                      width: `${stats.accuracy}%`,
                      background: stats.accuracy >= 80 ? T.green : stats.accuracy >= 60 ? T.yellow : T.red
                    }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 전체 삭제 경고 영역 */}
      {studentList.length > 0 && (
        <div style={{ marginTop: 20, padding: 14, background: T.redLight, borderRadius: 12, border: `1px dashed ${T.red}` }}>
          <div style={{ fontSize: 12, color: T.red, fontWeight: 700, marginBottom: 6 }}>⚠️ 전체 초기화</div>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 10 }}>
            모든 학생 데이터와 학습 기록을 삭제합니다. 이 작업은 되돌릴 수 없어요.
          </div>
          <Btn v="danger" size="sm" onClick={() => {
            if (confirm("정말로 모든 학생 데이터를 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.")) {
              setStudents({});
            }
          }}>🗑️ 전체 학생 삭제</Btn>
        </div>
      )}
    </div>
  );
}

function TeacherHome({ bank, exams, students, onNav }) {
  const studentCount = Object.keys(students || {}).length;
  const questionCount = Object.values(bank).reduce((a, s) => a + s.questions.length, 0);
  const todayActive = Object.values(students || {}).filter(s => {
    const last = (s.records || []).slice(-1)[0]?.date?.slice(0, 10);
    return last === new Date().toISOString().slice(0, 10);
  }).length;

  // 진행중인 단어 숙제 통계
  const studentsArr = Object.values(students || {});
  const activeHomeworks = studentsArr.filter(s => s.wordHomework?.active);
  const activeHwCount = activeHomeworks.length;
  const completedHwCount = activeHomeworks.filter(s => {
    const hw = s.wordHomework;
    return hw?.words?.length > 0 && hw.words.every(w => w.mastered);
  }).length;

  // 진행중인 맞춤 시험 통계
  const activeExams = studentsArr.filter(s => s.customExam?.active);
  const activeExamCount = activeExams.length;
  const completedExamCount = activeExams.filter(s => s.customExam?.completed).length;

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
        borderRadius: 16, padding: "20px 18px", color: "white", marginBottom: 14,
        boxShadow: T.shadowLg
      }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>안녕하세요 👋</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Angela 선생님</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>오늘도 멋진 수업 화이팅!</div>
      </div>

      {/* 오늘의 현황 — 3개 통계 카드 */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 24 }}>👥</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>전체 학생</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{studentCount}명</div>
              <div style={{ fontSize: 9, color: T.green, fontWeight: 700 }}>오늘 {todayActive}명 활동</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 24 }}>📚</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>문제 은행</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{questionCount}문항</div>
              <div style={{ fontSize: 9, color: T.accent, fontWeight: 700 }}>{Object.keys(bank).length}개 문제집</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 24 }}>📖</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>진행중 단어숙제</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{activeHwCount}건</div>
              <div style={{ fontSize: 9, color: T.purple, fontWeight: 700 }}>완료 {completedHwCount}건</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 24 }}>📝</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>진행중 시험</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{activeExamCount}건</div>
              <div style={{ fontSize: 9, color: T.orange, fontWeight: 700 }}>완료 {completedExamCount}건</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 자주 쓰는 작업 — 핵심 액션 */}
      <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 10, letterSpacing: 0.5 }}>⚡ 자주 쓰는 작업</div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[
          { id: "word-homework", icon: "📚", label: "단어 숙제 만들기", desc: "학년별 단어 추천 + 배정",  color: T.accent, bg: T.accentLight },
          { id: "custom-exam",   icon: "📝", label: "맞춤 시험지 만들기", desc: "문제 골라서 시험 출제",    color: T.pink,   bg: T.pinkLight },
          { id: "manage",        icon: "👤", label: "학생 관리",        desc: "학생 등록 · 정보 수정",   color: T.green,  bg: T.greenLight },
          { id: "assign",        icon: "📬", label: "과제 배정",        desc: "문제집을 학생에게 배정",  color: T.orange, bg: T.orangeLight },
          { id: "students",      icon: "📈", label: "학생 통계 보기",   desc: "전체 학습 현황 분석",     color: T.purple, bg: T.purpleLight },
          { id: "bank",          icon: "🗂️", label: "문제 은행",        desc: "문제 추가 · 편집",        color: T.accent, bg: T.accentLight },
        ].map(m => (
          <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: m.bg, marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26
            }}>{m.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text, marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
          </Card>
        ))}
      </div>

      {/* 진행 중인 단어 숙제 — 있을 때만 표시 */}
      {activeHwCount > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 10, letterSpacing: 0.5 }}>📖 진행 중인 단어 숙제</div>
          <Card style={{ padding: 12, marginBottom: 12 }}>
            {activeHomeworks.slice(0, 5).map((s, i) => {
              const hw = s.wordHomework;
              const total = hw.words?.length || 0;
              const done = hw.words?.filter(w => w.mastered).length || 0;
              const pct = total ? Math.round(done/total*100) : 0;
              return (
                <div key={s.name} onClick={() => onNav("word-homework")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 4px", cursor: "pointer",
                    borderBottom: i < Math.min(activeHomeworks.length, 5) - 1 ? `1px solid ${T.border}` : "none"
                  }}>
                  <div style={{ fontSize: 22 }}>{s.avatar || "🙂"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: T.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hw.title}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: pct === 100 ? T.green : T.accent }}>{done}/{total}</div>
                    <div style={{ width: 60, height: 4, background: T.border, borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? T.green : T.accent }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {activeHomeworks.length > 5 && (
              <div onClick={() => onNav("word-homework")} style={{ textAlign: "center", padding: "8px 0 2px", fontSize: 11, fontWeight: 700, color: T.accent, cursor: "pointer" }}>
                전체 {activeHomeworks.length}건 보기 →
              </div>
            )}
          </Card>
        </>
      )}

      {/* 진행 중인 맞춤 시험 — 있을 때만 표시 */}
      {activeExamCount > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 10, letterSpacing: 0.5 }}>📝 진행 중인 시험</div>
          <Card style={{ padding: 12, marginBottom: 12 }}>
            {activeExams.slice(0, 5).map((s, i) => {
              const ex = s.customExam;
              const total = ex.questions?.length || 0;
              const done = ex.completed;
              const score = ex.score;
              return (
                <div key={s.name} onClick={() => onNav("custom-exam")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 4px", cursor: "pointer",
                    borderBottom: i < Math.min(activeExams.length, 5) - 1 ? `1px solid ${T.border}` : "none"
                  }}>
                  <div style={{ fontSize: 22 }}>{s.avatar || "🙂"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: T.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: done ? T.green : T.orange }}>
                      {done ? `${score}/${total}` : `${total}문항`}
                    </div>
                    <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>
                      {done ? "완료" : "대기 중"}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeExams.length > 5 && (
              <div onClick={() => onNav("custom-exam")} style={{ textAlign: "center", padding: "8px 0 2px", fontSize: 11, fontWeight: 700, color: T.pink, cursor: "pointer" }}>
                전체 {activeExams.length}건 보기 →
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function TeacherSettings({ savedPw, setSavedPw, darkMode, setDarkMode }) {
  const [cur, setCur] = useState("");
  const [neu, setNeu] = useState("");
  const [msg, setMsg] = useState("");
  const [backupMsg, setBackupMsg] = useState("");

  const change = () => {
    if (cur !== savedPw) { setMsg("현재 비밀번호가 틀려요!"); return; }
    if (neu.length < 4) { setMsg("4자 이상 입력해주세요!"); return; }
    setSavedPw(neu);
    setCur(""); setNeu("");
    setMsg("✅ 변경되었어요!");
    setTimeout(() => setMsg(""), 2000);
  };

  // ── 데이터 백업 (JSON 다운로드) ─────────────────────────────
  const exportData = () => {
    if (typeof window === "undefined") return;
    const allKeys = [
      "angela_students", "angela_bank", "angela_exams",
      "angela_assignments", "angela_groups", "angela_notices",
      "angela_goals", "angela_schedules", "angela_attendance",
    ];
    const data = {};
    allKeys.forEach(k => {
      try { data[k] = JSON.parse(localStorage.getItem(k) || "null"); } catch { data[k] = null; }
    });
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "Angela's English Academy",
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angela-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupMsg("✅ 백업 파일이 다운로드되었어요");
    setTimeout(() => setBackupMsg(""), 3000);
  };

  // ── 데이터 복원 (JSON 업로드) ─────────────────────────────
  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ 복원하면 현재 모든 데이터가 백업 파일로 교체됩니다.\n계속할까요?\n\n(혹시 모르니 먼저 백업 다운로드 받아두시는 걸 권장해요)")) {
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup.data || backup.app !== "Angela's English Academy") {
          throw new Error("올바른 백업 파일이 아니에요");
        }
        Object.entries(backup.data).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
        setBackupMsg("✅ 복원 완료! 새로고침합니다...");
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        setBackupMsg("❌ 복원 실패: " + err.message);
        setTimeout(() => setBackupMsg(""), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // 데이터 통계
  const stats = (typeof window !== "undefined") ? (() => {
    try {
      const students = JSON.parse(localStorage.getItem("angela_students") || "{}");
      const bank = JSON.parse(localStorage.getItem("angela_bank") || "{}");
      const exams = JSON.parse(localStorage.getItem("angela_exams") || "[]");
      return {
        students: Object.keys(students).length,
        banks: Object.keys(bank).length,
        questions: Object.values(bank).reduce((a, b) => a + (b.questions?.length || 0), 0),
        exams: exams.length,
      };
    } catch { return null; }
  })() : null;

  return (
    <div>
      {/* 다크모드 토글 */}
      <Card style={{ marginBottom: 12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>🌙 다크 모드</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>눈이 편한 어두운 화면</div>
        </div>
        <button onClick={() => setDarkMode && setDarkMode(d => !d)} style={{
          width: 50, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
          background: darkMode ? T.accent : T.border, position: "relative", transition: "background 0.2s"
        }}>
          <div style={{
            position: "absolute", top: 3, transition: "left 0.2s",
            left: darkMode ? 25 : 3, width: 22, height: 22,
            borderRadius: "50%", background: "white"
          }} />
        </button>
      </Card>

{/* Supabase 마이그레이션 */}
      <SupabaseMigration />

      {/* 데이터 백업 / 복원 — 가장 중요! */}
      <Card style={{ marginBottom: 12, padding: 16, background: T.greenLight, border: `2px solid ${T.green}` }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: T.text, marginBottom: 4 }}>💾 데이터 백업 & 복원</div>
        <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12, lineHeight: 1.5 }}>
          모든 학생 / 문제집 / 시험지 / 숙제 데이터를 파일로 저장하거나 복원해요.<br/>
          <strong style={{ color: T.red }}>⚠️ 브라우저 데이터를 청소하면 모두 사라지니 정기적으로 백업하세요!</strong>
        </div>
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12, background: T.card, padding: 10, borderRadius: 10, fontSize: 11 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 900, color: T.accent, fontSize: 16 }}>{stats.students}</div><div style={{ color: T.textMid, fontSize: 9 }}>학생</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 900, color: T.accent, fontSize: 16 }}>{stats.banks}</div><div style={{ color: T.textMid, fontSize: 9 }}>문제집</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 900, color: T.accent, fontSize: 16 }}>{stats.questions}</div><div style={{ color: T.textMid, fontSize: 9 }}>문항</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 900, color: T.accent, fontSize: 16 }}>{stats.exams}</div><div style={{ color: T.textMid, fontSize: 9 }}>시험지</div></div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportData} style={{
            flex: 1, background: T.green, color: "white", border: "none", borderRadius: 10,
            padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer"
          }}>📥 백업 다운로드</button>
          <label style={{
            flex: 1, background: T.card, color: T.text, border: `2px solid ${T.green}`, borderRadius: 10,
            padding: "10px", fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "center"
          }}>
            📤 복원 업로드
            <input type="file" accept=".json,application/json" onChange={importData} style={{ display: "none" }} />
          </label>
        </div>
        {backupMsg && (
          <div style={{ fontSize: 12, marginTop: 10, textAlign: "center", fontWeight: 700,
            color: backupMsg.startsWith("✅") ? T.green : backupMsg.startsWith("❌") ? T.red : T.textMid }}>
            {backupMsg}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 14 }}>🔑 비밀번호 변경</div>
        <Input type="password" value={cur} onChange={e => setCur(e.target.value)} placeholder="현재 비밀번호" style={{ marginBottom: 8 }} />
        <Input type="password" value={neu} onChange={e => setNeu(e.target.value)} placeholder="새 비밀번호 (4자 이상)" style={{ marginBottom: 10 }} />
        <Btn v="primary" size="md" onClick={change} style={{ width: "100%" }}>변경하기</Btn>
        {msg && <div style={{ fontSize: 12, color: msg.startsWith("✅") ? T.green : T.red, marginTop: 8, textAlign: "center", fontWeight: 700 }}>{msg}</div>}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   과제 배정 시스템 (선생님용)
// ══════════════════════════════════════════════════════════════════════════

// ── AI 코칭 분석 함수 ─────────────────────────────────────────────────────
function analyzeStudent(student, assignments, bank) {
  const records = student?.records || [];
  if (records.length === 0) return null;

  // 과제별 결과 분석
  const assignResults = {};
  records.filter(r => r.type === "assignment" && r.assignmentId).forEach(r => {
    if (!assignResults[r.assignmentId]) {
      assignResults[r.assignmentId] = { scores: [], title: r.setTitle, bankId: r.bankId };
    }
    assignResults[r.assignmentId].scores.push(
      r.total > 0 ? Math.round(r.score / r.total * 100) : 0
    );
  });

  // 전체 정답률 트렌드
  const recentAssign = records.filter(r => r.type === "assignment").slice(-10);
  const accuracies = recentAssign.map(r => r.total > 0 ? Math.round(r.score / r.total * 100) : 0);
  const avgAcc = accuracies.length > 0
    ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0;

  // 틀린 문제 패턴 (bankId별)
  const weakBanks = {};
  records.filter(r => r.type === "assignment" && r.bankId).forEach(r => {
    if (!weakBanks[r.bankId]) weakBanks[r.bankId] = { correct: 0, total: 0, title: r.setTitle };
    weakBanks[r.bankId].correct += r.score || 0;
    weakBanks[r.bankId].total += r.total || 0;
  });

  const weakList = Object.values(weakBanks)
    .filter(b => b.total > 0)
    .map(b => ({ ...b, rate: Math.round(b.correct / b.total * 100) }))
    .sort((a, b) => a.rate - b.rate);

  // 연속 학습일
  const dates = [...new Set(records.map(r => r.date?.slice(0, 10)))].filter(Boolean).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dates[i] === d.toISOString().slice(0, 10)) streak++;
    else break;
  }

  // 추세 (최근 5회 평균 vs 이전 5회 평균)
  const recent5 = accuracies.slice(-5);
  const prev5 = accuracies.slice(-10, -5);
  const recentAvg = recent5.length > 0 ? recent5.reduce((a, b) => a + b, 0) / recent5.length : 0;
  const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : 0;
  const trend = recentAvg > prevAvg + 5 ? "up" : recentAvg < prevAvg - 5 ? "down" : "stable";

  return { avgAcc, weakList, streak, trend, recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), totalAttempts: records.length };
}

// ── 코칭 화면 ─────────────────────────────────────────────────────────────
function CoachingView({ student, assignments, bank, setAssignments, onBack }) {
  const [assignTab, setAssignTab] = useState("result"); // result | assign | history
  const [selectedBanks, setSelectedBanks] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [done, setDone] = useState(false);

  const analysis = analyzeStudent(student, assignments, bank);
  const myAssignments = assignments.filter(a => a.studentName === student.name);

  const toggleBank = (id) => setSelectedBanks(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const doAssign = () => {
    if (selectedBanks.length === 0) return;
    setAssigning(true);
    const newAssigns = selectedBanks.map(bankId => ({
      id: uid(),
      studentName: student.name,
      bankId,
      bankTitle: bank[bankId]?.title || bankId,
      assignedAt: new Date().toISOString(),
      dueDate: dueDate || null,
      status: "pending"
    }));
    setAssignments(prev => [...prev, ...newAssigns]);
    setTimeout(() => { setAssigning(false); setDone(true); setSelectedBanks([]); setDueDate(""); }, 400);
    setTimeout(() => setDone(false), 2500);
  };

  const removeAssign = (id) => {
    if (!confirm("이 과제를 삭제할까요?")) return;
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const lvl = LEVEL_INFO[computeStudentStats(student).level];

  return (
    <div>
      {/* 학생 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Btn v="ghost" size="sm" onClick={onBack}>← 뒤로</Btn>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: lvl.bg,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26
        }}>{student.avatar || "🧑"}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{student.name}</div>
          <div style={{ fontSize: 11, color: T.textMid }}>{student.grade || ""} · {lvl.icon} {lvl.label} · ⭐{student.points || 0}p</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.card, padding: 5, borderRadius: 12, boxShadow: T.shadow }}>
        {[
          { id: "result", label: "📊 결과 분석" },
          { id: "assign", label: "📬 과제 배정" },
          { id: "history", label: "📋 배정 내역" },
        ].map(t => (
          <button key={t.id} onClick={() => setAssignTab(t.id)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 800,
            background: assignTab === t.id ? T.accent : "transparent",
            color: assignTab === t.id ? "white" : T.textMid
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 결과 분석 탭 ── */}
      {assignTab === "result" && (
        <div>
          {!analysis ? (
            <Card style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>아직 풀이 기록이 없어요</div>
              <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>과제를 배정하고 학생이 풀면 분석이 시작됩니다</div>
            </Card>
          ) : (
            <>
              {/* 핵심 수치 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                <Card style={{ padding: 12, textAlign: "center", background: T.accentLight }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.accent }}>{analysis.avgAcc}%</div>
                  <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>평균 정답률</div>
                </Card>
                <Card style={{ padding: 12, textAlign: "center", background: T.greenLight }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.green }}>🔥{analysis.streak}</div>
                  <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>연속 학습일</div>
                </Card>
                <Card style={{ padding: 12, textAlign: "center", background: T.yellowLight }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.yellow }}>{analysis.totalAttempts}</div>
                  <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>총 풀이 횟수</div>
                </Card>
              </div>

              {/* 추세 */}
              <Card style={{ marginBottom: 14, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📈 학습 추세</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    flex: 1, padding: "12px 14px", borderRadius: 12,
                    background: analysis.trend === "up" ? T.greenLight : analysis.trend === "down" ? T.redLight : T.yellowLight,
                    display: "flex", alignItems: "center", gap: 10
                  }}>
                    <div style={{ fontSize: 28 }}>
                      {analysis.trend === "up" ? "📈" : analysis.trend === "down" ? "📉" : "➡️"}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>
                        {analysis.trend === "up" ? "향상 중 🎉" : analysis.trend === "down" ? "하락 중 ⚠️" : "유지 중"}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMid }}>
                        이전 {analysis.prevAvg}% → 최근 {analysis.recentAvg}%
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 약점 분석 */}
              {analysis.weakList.length > 0 && (
                <Card style={{ marginBottom: 14, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>🎯 문제집별 정답률</div>
                  {analysis.weakList.map((b, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{b.title}</span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: b.rate >= 80 ? T.green : b.rate >= 60 ? T.yellow : T.red }}>
                          {b.rate}%
                        </span>
                      </div>
                      <div style={{ height: 7, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${b.rate}%`,
                          background: b.rate >= 80 ? T.green : b.rate >= 60 ? T.yellow : T.red,
                          borderRadius: 4, transition: "width 0.5s"
                        }} />
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {/* 🤖 AI 코칭 멘트 */}
              <Card style={{ background: `linear-gradient(135deg, ${T.accent}15, ${T.purple}15)`, border: `1.5px solid ${T.accent}33`, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 26 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>Angela AI 코칭</div>
                    <div style={{ fontSize: 10, color: T.textMid }}>학습 데이터 기반 분석</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.8 }}>
                  {/* 종합 평가 */}
                  <div style={{ marginBottom: 8 }}>
                    {analysis.avgAcc >= 85
                      ? `✅ ${student.name} 학생은 전반적으로 매우 우수한 실력을 보이고 있어요! 현재 ${analysis.avgAcc}%의 높은 정답률을 유지하고 있습니다.`
                      : analysis.avgAcc >= 65
                      ? `📚 ${student.name} 학생은 기본기가 잡혀 있어요. 정답률 ${analysis.avgAcc}%로 조금 더 연습하면 크게 향상될 수 있어요!`
                      : `💪 ${student.name} 학생은 현재 기초를 다지는 단계예요. 정답률 ${analysis.avgAcc}%로 차근차근 반복 학습이 필요합니다.`
                    }
                  </div>
                  {/* 추세 코멘트 */}
                  <div style={{ marginBottom: 8 }}>
                    {analysis.trend === "up"
                      ? `📈 최근 ${analysis.recentAvg}%로 이전(${analysis.prevAvg}%)보다 뚜렷하게 향상되고 있어요. 현재 학습 방법을 유지하세요!`
                      : analysis.trend === "down"
                      ? `⚠️ 최근 ${analysis.recentAvg}%로 이전(${analysis.prevAvg}%)보다 다소 낮아졌어요. 개념을 다시 점검하고 더 쉬운 문제부터 다시 시작해 보세요.`
                      : `➡️ 성적이 안정적으로 유지되고 있어요. 새로운 유형에 도전해보면 더 성장할 수 있습니다!`
                    }
                  </div>
                  {/* 약점 기반 추천 */}
                  {analysis.weakList.length > 0 && analysis.weakList[0].rate < 70 && (
                    <div style={{ marginBottom: 8 }}>
                      {`🎯 "${analysis.weakList[0].title}" 문제집 정답률이 ${analysis.weakList[0].rate}%로 가장 낮아요. 이 부분을 집중적으로 복습시키는 것을 추천드려요.`}
                    </div>
                  )}
                  {/* 연속학습 코멘트 */}
                  <div style={{ marginBottom: 8 }}>
                    {analysis.streak >= 7
                      ? `🔥 ${analysis.streak}일 연속 학습 중! 정말 대단한 꾸준함이에요. 학습 습관이 훌륭합니다.`
                      : analysis.streak >= 3
                      ? `🌱 ${analysis.streak}일 연속 학습하고 있어요. 꾸준한 학습 습관이 형성되고 있답니다!`
                      : `📅 연속 학습일이 짧아요. 매일 조금씩이라도 접속하는 습관을 길러주세요.`
                    }
                  </div>
                  {/* 다음 단계 추천 */}
                  <div style={{ padding: "10px 12px", background: "white", borderRadius: 10, marginTop: 6, fontSize: 12 }}>
                    <strong>📌 추천 액션:</strong>
                    {analysis.avgAcc >= 85
                      ? " 현재 수준보다 한 단계 높은 문제집을 배정해 보세요."
                      : analysis.weakList.length > 0 && analysis.weakList[0].rate < 60
                      ? ` "${analysis.weakList[0].title}" 문제집을 다시 배정해서 반복 학습을 시키세요.`
                      : " 다양한 유형의 문제를 골고루 풀 수 있도록 여러 문제집을 배정해 보세요."
                    }
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── 과제 배정 탭 ── */}
      {assignTab === "assign" && (
        <div>
          <Card style={{ marginBottom: 14, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>📬 {student.name} 학생에게 과제 배정</div>
            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12 }}>배정할 문제집을 선택하세요 (복수 선택 가능)</div>

            {Object.values(bank).map(s => {
              const isSel = selectedBanks.includes(s.id);
              const alreadyAssigned = myAssignments.some(a => a.bankId === s.id && a.status !== "completed");
              return (
                <div key={s.id} onClick={() => !alreadyAssigned && toggleBank(s.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 8,
                  background: isSel ? T.accentLight : alreadyAssigned ? T.bg : T.card,
                  border: isSel ? `2px solid ${T.accent}` : `2px solid ${T.border}`,
                  borderRadius: 12, cursor: alreadyAssigned ? "not-allowed" : "pointer",
                  opacity: alreadyAssigned ? 0.6 : 1
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                    background: isSel ? T.accent : T.border,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 14, fontWeight: 900
                  }}>{isSel ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: T.textMid }}>{s.grade} · {s.tag} · {s.questions.length}문항</div>
                  </div>
                  {alreadyAssigned && <Tag color="yellow">배정됨</Tag>}
                </div>
              );
            })}

            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>📅 마감일 (선택)</div>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{
                padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`,
                fontSize: 13, width: "100%", boxSizing: "border-box"
              }} />
            </div>

            {done && (
              <div style={{ textAlign: "center", padding: 12, background: T.greenLight, borderRadius: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.green }}>✅ 과제가 배정되었어요!</span>
              </div>
            )}

            <Btn v="primary" size="lg" onClick={doAssign} disabled={selectedBanks.length === 0 || assigning}
              style={{ width: "100%" }}>
              {assigning ? "배정 중..." : `📬 과제 배정하기 (${selectedBanks.length}개 선택)`}
            </Btn>
          </Card>
        </div>
      )}

      {/* ── 배정 내역 탭 ── */}
      {assignTab === "history" && (
        <div>
          {myAssignments.length === 0 ? (
            <Card style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>배정된 과제가 없어요</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 4 }}>과제 배정 탭에서 문제를 배정해 주세요</div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...myAssignments].reverse().map(a => {
                // 이 과제의 결과 기록 찾기
                const results = (student.records || []).filter(r => r.assignmentId === a.id);
                const lastResult = results.slice(-1)[0];
                const avgScore = results.length > 0
                  ? Math.round(results.reduce((s, r) => s + (r.total > 0 ? r.score / r.total * 100 : 0), 0) / results.length) : null;
                const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && !lastResult;

                return (
                  <Card key={a.id} style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{a.bankTitle}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <Tag color="blue">배정일 {a.assignedAt?.slice(0, 10)}</Tag>
                          {a.dueDate && <Tag color={isOverdue ? "red" : "yellow"}>마감 {a.dueDate}</Tag>}
                          {avgScore !== null
                            ? <Tag color={avgScore >= 80 ? "green" : avgScore >= 60 ? "yellow" : "red"}>
                                정답률 {avgScore}%
                              </Tag>
                            : <Tag color="orange">미완료</Tag>
                          }
                          {results.length > 1 && <Tag color="purple">{results.length}회 풀이</Tag>}
                        </div>
                      </div>
                      <button onClick={() => removeAssign(a.id)} style={{
                        width: 26, height: 26, borderRadius: 8, border: "none",
                        background: T.redLight, color: T.red, fontSize: 12,
                        cursor: "pointer", fontWeight: 900, flexShrink: 0, marginLeft: 8
                      }}>✕</button>
                    </div>

                    {lastResult && (
                      <div style={{ background: T.bg, borderRadius: 10, padding: "8px 10px", fontSize: 11, color: T.textMid }}>
                        마지막 풀이: {lastResult.date?.slice(0, 10)} ·
                        <strong style={{ color: avgScore >= 80 ? T.green : avgScore >= 60 ? T.yellow : T.red }}>
                          {" "}{lastResult.score}/{lastResult.total} 문항 정답
                        </strong>
                      </div>
                    )}
                    {isOverdue && (
                      <div style={{ marginTop: 6, fontSize: 11, color: T.red, fontWeight: 700 }}>
                        ⚠️ 마감일이 지났어요
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 과제 배정 메인 화면 (학생 목록 → 학생 선택 → 코칭뷰) ─────────────────
function AssignmentManager({ students, bank, assignments, setAssignments }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  if (selected) {
    return <CoachingView
      student={selected}
      assignments={assignments}
      bank={bank}
      setAssignments={setAssignments}
      onBack={() => setSelected(null)}
    />;
  }

  const studentList = Object.values(students || {});
  const filtered = search
    ? studentList.filter(s => s.name.includes(search))
    : studentList;

  const getPendingCount = (name) =>
    assignments.filter(a => a.studentName === name && a.status !== "completed").length;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>📬 과제 배정 & 코칭</div>
        <div style={{ fontSize: 12, color: T.textMid }}>학생을 선택해서 과제를 배정하고 결과를 분석하세요</div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 학생 이름 검색" style={{
        width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12,
        border: `1.5px solid ${T.border}`, fontSize: 13, marginBottom: 14, outline: "none"
      }} />

      {studentList.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>아직 학생이 없어요</div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>[학생 관리]에서 먼저 학생을 등록해주세요</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.textDim }}>검색 결과가 없어요</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(s => {
            const stats = computeStudentStats(s);
            const lvl = LEVEL_INFO[stats.level];
            const pendingCnt = getPendingCount(s.name);
            const analysis = analyzeStudent(s, assignments, bank);

            return (
              <Card key={s.name} onClick={() => setSelected(s)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 13, background: lvl.bg, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26
                }}>{s.avatar || "🧑"}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{s.name}</span>
                    <Tag color={stats.level === "A" ? "green" : stats.level === "B" ? "blue" : "orange"}>
                      {lvl.icon} {lvl.label}
                    </Tag>
                    {pendingCnt > 0 && <Tag color="pink">과제 {pendingCnt}개</Tag>}
                    {stats.lastActive === "오늘" && <Tag color="green">● 오늘 활동</Tag>}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMid }}>
                    정답률 {stats.accuracy}% · ⭐{s.points || 0}p
                    {analysis && (
                      <span style={{ marginLeft: 6 }}>
                        {analysis.trend === "up" ? "📈 향상중" : analysis.trend === "down" ? "📉 하락중" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 22, color: T.textDim }}>›</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


function TeacherApp({ onLogout, bank, setBank, exams, setExams, students, setStudents, savedPw, setSavedPw, darkMode, setDarkMode }) {
  const [screen, setScreen] = useState("dashboard");
  const [viewExamId, setViewExamId] = useState(null);
  const [assignments, setAssignments] = useStorage("angela_assignments", []);
  const [groups,      setGroups]      = useStorage("angela_groups",      []);
  const [notices,     setNotices]     = useStorage("angela_notices",     []);
  const [goals,       setGoals]       = useStorage("angela_goals",       []);
  const [schedules,   setSchedules]   = useStorage("angela_schedules",   []);
  const [attendance,  setAttendance]  = useStorage("angela_attendance",  {});
  const [reportStudent, setReportStudent] = useState(null);

  const onNav = (s, id) => { setScreen(s); if (id) setViewExamId(id); };
  const examView = exams.find(e => e.id === viewExamId);

  // 키보드 단축키: Alt+← 뒤로가기
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === "ArrowLeft") {
        const info = SCREEN_INFO_MAP[screen];
        if (info?.back) onNav(info.back);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  // ── 화면별 정보 (제목 + 뒤로가기 대상) ──
  const SCREEN_INFO_MAP = {
    dashboard:    { title:"대시보드",         back: null },
    manage:       { title:"학생 관리",         back: "dashboard" },
    assign:       { title:"과제 배정",         back: "dashboard" },
    students:     { title:"학습 통계",         back: "dashboard" },
    bank:         { title:"문제 은행",         back: "dashboard" },
    "exam-builder":{ title:"시험지 출제",      back: "exams" },
    exams:        { title:"시험지 목록",       back: "dashboard" },
    "exam-view":  { title:"시험지 출력",       back: "exams" },
    settings:     { title:"설정",             back: "more" },
    more:         { title:"더보기",            back: "dashboard" },
    groups:       { title:"반별 그룹 관리",    back: "more" },
    goals:        { title:"목표 설정",         back: "more" },
    notice:       { title:"공지 & 메시지",     back: "more" },
    schedule:     { title:"수업 일정",         back: "more" },
    league:       { title:"주간 리그",         back: "more" },
    report:       { title:"월간 성적표",       back: "more" },
    parent:       { title:"학부모 뷰어",       back: "more" },
    attendance:   { title:"출석 기록",         back: "more" },
    "word-homework": { title:"📚 단어 숙제 관리", back: "dashboard" },
    "custom-exam":   { title:"📝 맞춤 시험지", back: "dashboard" },
    "student-report": { title:"학생 상세 리포트", back: "students" },
  };

  const curInfo = SCREEN_INFO_MAP[screen] || { title: screen, back: "dashboard" };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      {/* 상단 헤더 */}
      <div className="topbar" style={{ background: T.card, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
       <div className="top-bar-inner">
        {curInfo.back !== null ? (
          <button onClick={() => onNav(curInfo.back)} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", color:T.accent, fontSize:13, fontWeight:700, padding:"4px 8px", borderRadius:8, flexShrink:0 }}>
            ← 뒤로
          </button>
        ) : (
          <div style={{ fontSize: 22 }}>👩‍🏫</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {curInfo.back === null ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>Angela's Academy</div>
              <div style={{ fontSize: 10, color: T.textDim }}>선생님 모드</div>
            </>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 900, color: T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {curInfo.title}
            </div>
          )}
        </div>
        <button onClick={() => setDarkMode && setDarkMode(d => !d)} title={darkMode?"라이트 모드":"다크 모드"}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, padding:"4px 6px", borderRadius:8 }}>
          {darkMode ? "☀️" : "🌙"}
        </button>
        <Btn v="ghost" size="sm" onClick={onLogout}>로그아웃</Btn>
       </div>
      </div>

      <div className="app-container">
        {screen === "dashboard"  && <TeacherHome bank={bank} exams={exams} students={students} onNav={onNav} />}
        {screen === "manage"     && <StudentManager students={students} setStudents={setStudents} />}
        {screen === "assign"     && <AssignmentManager students={students} bank={bank} assignments={assignments} setAssignments={setAssignments} />}
        {screen === "students"   && <StatsDashboard students={students} onSelectStudent={s=>{setReportStudent(s);onNav("student-report");}} />}
        {screen === "bank"       && <QuestionBank bank={bank} setBank={setBank} />}
        {screen === "exam-builder" && <ExamBuilder bank={bank} setExams={setExams} onNav={onNav} />}
        {screen === "exams"      && <ExamList exams={exams} setExams={setExams} onNav={onNav} />}
        {screen === "exam-view"  && examView && <ExamPrintView exam={examView} onBack={() => onNav("exams")} />}
        {screen === "settings"   && <TeacherSettings savedPw={savedPw} setSavedPw={setSavedPw} darkMode={darkMode} setDarkMode={setDarkMode} />}
        {/* Phase 1 */}
        {screen === "groups"     && <GroupManager students={students} groups={groups} setGroups={setGroups} assignments={assignments} setAssignments={setAssignments} bank={bank} />}
        {screen === "goals"      && <GoalManager students={students} goals={goals} setGoals={setGoals} />}
        {screen === "notice"     && <NoticeManager notices={notices} setNotices={setNotices} />}
        {/* Phase 2 */}
        {screen === "schedule"   && <ScheduleManager schedules={schedules} setSchedules={setSchedules} />}
        {screen === "league"     && <WeeklyLeague students={students} />}
        {screen === "report"     && <ReportPrint students={students} />}
        {screen === "parent"     && <ParentViewer students={students} />}
        {/* 신규 */}
        {screen === "attendance"      && <AttendanceManager students={students} attendance={attendance} setAttendance={setAttendance} />}
        {screen === "word-homework"   && <WordHomeworkManager students={students} setStudents={setStudents} onNav={onNav} />}
        {screen === "custom-exam"     && <CustomExamManager students={students} setStudents={setStudents} bank={bank} onNav={onNav} />}
        {screen === "student-report"  && reportStudent && (
          <>
            <StudentWordStatsCard studentName={reportStudent.name} />
            <StudentDetailReport student={reportStudent} onBack={() => onNav("students")} />
          </>
        )}
        {/* 더보기 메뉴 */}
        {screen === "more" && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>✨ 더 많은 기능</div>
            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 14 }}>학습 자료 · 통계 · 관리</div>

            {/* 학습 자료 그룹 */}
            <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, marginBottom: 8, letterSpacing: 0.5 }}>📖 학습 자료</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              {[
                { id:"custom-exam",  icon:"📝", label:"맞춤 시험지",      desc:"학생별 문제 골라 출제" },
                { id:"bank",         icon:"📚", label:"문제 은행",        desc:"문제 추가 / 편집" },
                { id:"exam-builder", icon:"✏️", label:"시험지 만들기",    desc:"새 시험지 생성" },
                { id:"exams",        icon:"📋", label:"시험지 목록",      desc:"만든 시험지 보기 / 인쇄" },
                { id:"students",     icon:"📈", label:"학생 통계",        desc:"전체 학습 현황 분석" },
              ].map(m => (
                <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                </Card>
              ))}
            </div>

            {/* 관리 & 운영 그룹 */}
            <div style={{ fontSize: 11, fontWeight: 800, color: T.purple, marginBottom: 8, letterSpacing: 0.5 }}>🛠️ 관리 & 운영</div>
            <div className="grid-2">
              {[
                { id:"groups",     icon:"👥", label:"반별 그룹 관리",  desc:"반 만들고 일괄 과제 배정" },
                { id:"goals",      icon:"🎯", label:"목표 설정",        desc:"학생별 월간 목표 지정" },
                { id:"notice",     icon:"💬", label:"공지 & 메시지",    desc:"학생 앱에 공지 띄우기" },
                { id:"schedule",   icon:"📅", label:"수업 일정",        desc:"일정 → 학생 D-day 알림" },
                { id:"league",     icon:"🏆", label:"주간 리그",        desc:"이번 주 포인트 순위" },
                { id:"report",     icon:"📋", label:"월간 성적표",      desc:"PDF 인쇄용 성적표" },
                { id:"parent",     icon:"👨‍👩‍👧", label:"학부모 뷰어",     desc:"자녀 학습 현황 보기" },
                { id:"attendance", icon:"🔔", label:"출석 기록",        desc:"수업 출결 체크 & 통계" },
                { id:"settings",   icon:"⚙️", label:"설정",            desc:"비밀번호 · 다크모드" },
              ].map(m => (
                <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비 */}
      <div className="no-print bottom-nav">
        {TEACHER_NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{ flex: 1, background: "none", border: "none", padding: "8px 2px 14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ fontSize: 20, transition: "transform 0.15s", transform: screen === n.id ? "scale(1.2)" : "scale(1)" }}>{n.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: screen === n.id ? T.accent : T.textDim }}>{n.label}</div>
            {screen === n.id && <div style={{ width: 16, height: 2.5, borderRadius: 2, background: T.accent, marginTop: 1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   STUDENT APP - 게임 & 과제 (자동 기록 저장)
// ══════════════════════════════════════════════════════════════════════════

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ── 게임 1: 단어 맞추기 (방향 선택 가능) ─────────────────────────────────
const MATCH_MODES = [
  { id: "ko2en", label: "한글 → 영어", desc: "한글 보고 영단어 고르기", icon: "🇰🇷→🇺🇸", question: "ko", answer: "en" },
  { id: "en2ko", label: "영어 → 한글", desc: "영단어 보고 뜻 고르기",   icon: "🇺🇸→🇰🇷", question: "en", answer: "ko" },
  { id: "mixed", label: "랜덤 섞기",   desc: "두 방향이 랜덤으로 섞여요", icon: "🔀",      question: "mixed", answer: "mixed" },
];

function WordMatchGame({ name, setStudents, student, onExit, levelId = "all" }) {
  const [mode, setMode] = useState(null); // null = 방향 선택 화면
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
      // 이 문제의 방향 결정
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

  // ⭐ 단어장 등록 여부 — 문제가 바뀔 때마다 자동 체크 (early return 위에 있어야 함!)
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

  // ✅ 게임 종료 시 점수 저장 (렌더링 중이 아니라 effect에서 한 번만)
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
  
  // ── 방향 선택 화면 ──
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

  // ── 게임 종료 ──
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
    recordWordEncounter(name, q, isCorrect);  // ✅ 망각 곡선 자동 업데이트
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

  // 방향에 따라 문제/보기 결정
  const questionText = q[q.qField];
  const isKo2En = q.dir === "ko2en";
  const cardBg  = isKo2En ? T.accentLight : T.greenLight;
  const cardColor = isKo2En ? T.accent : T.green;
  const hint = isKo2En ? "다음 뜻의 영어 단어는?" : "이 영어 단어의 뜻은?";
  const dirTag = isKo2En ? "🇰🇷→🇺🇸" : "🇺🇸→🇰🇷";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Tag color={isKo2En ? "blue" : "green"}>{dirTag}</Tag>
          <Tag color="blue">{round + 1} / {questions.length}</Tag>
        </div>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      {/* ⭐ 단어장 토글 (상단 우측) */}
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

      {/* 진도바 */}
      <div style={{ height: 5, background: T.border, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, transition: "width 0.3s",
          width: `${(round / questions.length) * 100}%`,
          background: isKo2En ? T.accent : T.green
        }} />
      </div>

      {/* 문제 카드 */}
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
        {/* 영단어 보여줄 때 발음 버튼 */}
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

      {/* 보기 4개 */}
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

      {/* 피드백 */}
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

// ── 게임 2: 스펠링 ────────────────────────────────────────────────────────
 
function SpellingGame({ name, setStudents, student, onExit, levelId = "all" }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const awardedRef = useRef(false);
 
  const questions = useMemo(() => shuffle(getGameWordPool(levelId, student)).slice(0, 8), [levelId, student?.wordHomework]);
 
  // ✅ 게임 종료 시 점수 저장 (렌더링 중이 아니라 effect에서 한 번만)
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
    recordWordEncounter(name, q, isCorrect);  // ✅ 망각 곡선 자동 업데이트
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
 

// ── 게임 3: 스피드 퀴즈 (10초 + 방향 선택) ───────────────────────────────
function SpeedQuiz({ name, setStudents, student, onExit, levelId = "all" }) {
  const [mode, setMode] = useState(null); // null = 방향 선택
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
 
  // 카운트다운 타이머
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
 
  // ✅ 게임 종료 시 점수 저장 (렌더링 중이 아니라 effect에서 한 번만)
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
 
  // 방향 선택 화면
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
    recordWordEncounter(name, q, isCorrect);  // ✅ 망각 곡선 자동 업데이트
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

// ── 게임 4: 플래시카드 (발음 기능 포함) ───────────────────────────────────
function FlashCard({ name, setStudents, student, onExit, levelId = "all" }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = useMemo(() => shuffle(getGameWordPool(levelId, student)).slice(0, 10), [levelId, student?.wordHomework]);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [studied, setStudied] = useState(0);

    // 카드가 바뀌면 자동으로 발음 재생 + 학습 이력 기록
  useEffect(() => {
    if (cards[idx]) {
      speak(cards[idx].en);
      recordWordEncounter(name, cards[idx], true);  // ✅ 플래시카드는 봤다는 기록
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 카드 바뀔 때마다 단어장 등록 여부 확인
  useEffect(() => {
    if (!cards[idx]) return;
    let cancelled = false;
    isInWordbook(name, cards[idx].en).then(result => {
      if (!cancelled) setIsFav(result);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // ⭐ 토글
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
{/* ⭐ 단어장 토글 */}
      <button onClick={(e) => { e.stopPropagation(); toggleFav(); }} disabled={favLoading} style={{
        width: "100%", marginBottom: 8, padding: "10px",
        background: isFav ? "#fef3c7" : "white",
        color: isFav ? "#f59e0b" : T.textMid,
        border: `2px solid ${isFav ? "#f59e0b" : T.border}`,
        borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: favLoading ? "wait" : "pointer",
      }}>
        {isFav ? "⭐ 내 단어장에 있어요" : "☆ 내 단어장에 추가"}
      </button>
      {/* 발음 버튼 */}
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

// ── 수준 선택 화면 (게임 시작 전) ─────────────────────────────────────────
function LevelSelect({ gameInfo, onSelect, onCancel }) {
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

// ── 학생 홈 ───────────────────────────────────────────────────────────────
function StudentHome({ name, bank, setStudents, students, onLogout, darkMode, setDarkMode }) {
  const [screen, setScreen] = useState("home");
  const [quizSet, setQuizSet] = useState(null);
  const [pendingGame, setPendingGame] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [reviewWords, setReviewWords] = useState(null); // 복습 모드용 단어 목록
  const [newBadges, setNewBadges] = useState([]);
  const [tab, setTab] = useState("game"); // game | badge
  const [showFreeQuiz, setShowFreeQuiz] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("angela_free_quiz_open_" + name) === "true"; }
    catch { return false; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("angela_free_quiz_open_" + name, String(showFreeQuiz)); } catch {}
  }, [showFreeQuiz, name]);
  
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

  // 키보드 단축키: Alt+← 뒤로가기 (모든 conditional return 위에 있어야 Hook Rule 준수)
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
  <div style={{ marginBottom: 18 }}>
    {/* 접기/펼치기 헤더 */}
    <button
      onClick={() => setShowFreeQuiz(s => !s)}
      style={{
        width: "100%",
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: showFreeQuiz ? 8 : 0,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>📚</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>자유 풀기</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
            {otherSets.length}개 문제집 · 원할 때 풀어보세요
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 14,
        color: T.textMid,
        fontWeight: 800,
        transition: "transform 0.2s",
        transform: showFreeQuiz ? "rotate(180deg)" : "rotate(0deg)",
      }}>
        ▼
      </div>
    </button>
 
    {/* 펼쳐졌을 때 목록 표시 */}
    {showFreeQuiz && (
      <div>
        {otherSets.map(s => (
          <Card
            key={s.id}
            onClick={() => { setQuizSet(s); setScreen("quiz"); }}
            style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}
          >
            <div style={{
              width: 42, height: 42, background: T.pinkLight, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
            }}>📝</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.title}</div>
              <div style={{ fontSize: 11, color: T.textMid }}>{s.grade} · {s.questions.length}문항</div>
            </div>
            <div style={{ fontSize: 18, color: T.textDim }}>›</div>
          </Card>
        ))}
      </div>
    )}
  </div>
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
                    if (g.isLevel) startGame(g);          // 레벨 선택이 필요한 게임
                    else setScreen(g.id);                  // 바로 시작
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

// ── 학생 퀴즈 (과제 풀기) ────────────────────────────────────────────────
function StudentQuiz({ name, setStudents, qset, onExit }) {
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
      assignmentId: qset.assignmentId || null, // 배정된 과제면 ID 포함
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

// ══════════════════════════════════════════════════════════════════════════
//   MAIN APP
// ══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [mode, setMode] = useState("landing");
  const [studentName, setStudentName] = useState("");
  const [bank, setBank, bankHydrated] = useStorage("angela_bank", INIT_BANK);
  const [exams, setExams] = useStorage("angela_exams", []);
  const [savedPw, setSavedPw] = useStorage("angela_pw", "1111");
  const [students, setStudents] = useStorage("angela_students", {});
  const [darkMode, setDarkMode] = useStorage("angela_dark", false);

  // 다크모드 적용
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    document.body.style.background = darkMode ? "#0f172a" : "#f0f7ff";
  }, [darkMode]);

  // ── 자동 마이그레이션 (localStorage 복원 완료 후 1회) ────────────────
  // bankHydrated 가 true 가 되면 = localStorage 의 저장값이 bank 에 반영된 시점.
  // 그 시점의 실제 저장 데이터를 기준으로 판단해야 하므로 함수형 setBank 사용.
  // 1) 기본 세트가 50문제 미만이면 기본 3세트를 새 데이터로 교체
  // 2) 코드에 추가된 새 기본 단원이 저장된 bank 에 없으면 그것만 병합
  //    (사용자가 추가/수정한 세트는 항상 보존)
  useEffect(() => {
    if (!bankHydrated) return;
    setBank((prev) => {
      const needsMigration =
        (prev.bp && prev.bp.questions && prev.bp.questions.length < 50) ||
        (prev.vpa && prev.vpa.questions && prev.vpa.questions.length < 50) ||
        (prev.mod && prev.mod.questions && prev.mod.questions.length < 50);

      if (needsMigration) {
        // 사용자가 추가한 다른 세트는 보존, 기본 3세트만 새 데이터로 교체
        const userSets = {};
        Object.entries(prev).forEach(([k, v]) => {
          if (k !== "bp" && k !== "vpa" && k !== "mod") userSets[k] = v;
        });
        return { ...INIT_BANK, ...userSets };
      }

      const missingDefaults = Object.keys(INIT_BANK).filter((k) => !prev[k]);
      if (missingDefaults.length > 0) {
        // 기존 데이터는 그대로 두고, 빠진 기본 단원만 추가
        const merged = { ...prev };
        missingDefaults.forEach((k) => { merged[k] = INIT_BANK[k]; });
        return merged;
      }

      return prev; // 변경 없음 → 불필요한 저장/리렌더 방지
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankHydrated]);

  // 학생 첫 입장 시 등록
  const enterAsStudent = (name) => {
    // 등록된 학생만 입장 가능 (StudentLogin에서 이미 검증되었지만 안전장치)
    if (!students[name]) {
      alert("등록되지 않은 학생입니다. 선생님께 문의해주세요.");
      return;
    }
    setStudentName(name);
    setMode("student");
  };

  if (mode === "landing") return <Landing onTeacher={() => setMode("teacher-login")} onStudent={() => setMode("student-login")} />;
  if (mode === "teacher-login") return <TeacherLogin savedPw={savedPw} onSuccess={() => setMode("teacher")} onBack={() => setMode("landing")} />;
  if (mode === "student-login") return <StudentLogin onSuccess={enterAsStudent} onBack={() => setMode("landing")} students={students} />;
  if (mode === "teacher") return <TeacherApp
    onLogout={() => setMode("landing")}
    bank={bank} setBank={setBank}
    exams={exams} setExams={setExams}
    students={students} setStudents={setStudents}
    savedPw={savedPw} setSavedPw={setSavedPw}
    darkMode={darkMode} setDarkMode={setDarkMode}
  />;
  if (mode === "student") return <StudentHome
    name={studentName} bank={bank}
    students={students} setStudents={setStudents}
    onLogout={() => setMode("landing")}
    darkMode={darkMode} setDarkMode={setDarkMode}
  />;
  return null;
}
