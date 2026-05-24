"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { QUESTION_BANK } from "./questionData";
import { WORD_LEVELS, ALL_WORDS, getWordsByLevel } from "./wordData";
import {
  GroupManager, BadgeDisplay, BadgeCelebration, getEarnedBadges,
  NoticeManager, NoticeBanner, GoalManager, StudentGoalWidget,
  WeeklyLeague, SentenceGame, ParentViewer, ReportPrint,
  ScheduleManager, ScheduleBanner,
  StudentDetailReport,
  StatsDashboard, StudentDetailModal,
  computeStudentStats, getLevel, LEVEL_INFO,
  CustomExamManager, CustomExamPrint, CustomExamBanner, CustomExamPlay
} from "./features";
import {
  WordHomeworkManager, WordHomeworkPrint, WordHomeworkBanner,
  getActiveHomeworkWords, updateWordMastery
} from "./WordHomework";
import { AttendanceManager } from "./AttendanceManager";
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
import WordLearningDashboard from "./WordLearningDashboard";
import { PhonicsTeacherMenu } from "./PhonicsTeacher";
import { SentenceBuilderEditor } from "./SentenceBuilderEditor";
import { recordWordEncounter, getTodayReviewWords } from "./studentWords";
import { addToWordbook, removeFromWordbook, isInWordbook } from "./studentWords";
import {
  T, GRADES, TAGS, MARKS, AVATARS, uid, shuffle, speak,
  Btn, Tag, Card, Input, saveStudentRecord
} from "./theme";
import {
  WordMatchGame, SpellingGame, SpeedQuiz, FlashCard, LevelSelect, getGameWordPool
} from "./coreGames";
import { StudentHome, StudentQuiz } from "./studentApp";

// ══════════════════════════════════════════════════════════════════════════
//   ANGELA'S ENGLISH ACADEMY - 통합 App.js
//   ✓ 선생님 모드: 문제은행 / 출제 / 시험지 / 학생 진도·통계 대시보드
//   ✓ 학생 모드: 과제 풀기 / 단어 게임 4종 (자동 기록 저장)
// ══════════════════════════════════════════════════════════════════════════

// ── 단어 게임용 단어 데이터 (wordData.js에서 import - 380개) ─────────────
const WORDS = ALL_WORDS;

// ── INIT 문제은행 (questionData.js에서 import - 900문제) ─────────────────
const INIT_BANK = QUESTION_BANK;

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
function useStorage(key, initial) {
  const [val, setVal] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  const saveTimeoutRef = useRef(null);

  // 마운트 시: Supabase 우선, 실패 시 localStorage 폴백
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const adapter = getAdapter(key);
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

// ══════════════════════════════════════════════════════════════════════════
//   LANDING & LOGIN
// ══════════════════════════════════════════════════════════════════════════

function Landing({ onTeacher, onStudent }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 60%, ${T.pink} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🎀</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "white", marginBottom: 4 }}>
          Angela's English Academy
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 40 }}>
          앤젤라 선생님의 영어 학원에 오신 걸 환영해요!
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card onClick={onTeacher} style={{
            padding: "32px 16px", textAlign: "center",
            transition: "all 0.2s", borderRadius: T.radiusXl
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: T.radiusLg, background: T.accentLight,
              margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40
            }}>👩‍🏫</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>선생님</div>
            <div style={{ fontSize: 11, color: T.textMid }}>출제 · 학생 관리</div>
          </Card>

          <Card onClick={onStudent} style={{
            padding: "32px 16px", textAlign: "center",
            transition: "all 0.2s", borderRadius: T.radiusXl
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: T.radiusLg, background: T.pinkLight,
              margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40
            }}>🧒</div>
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
  const [selectedStudent, setSelectedStudent] = useState(null); // PIN 입력 대상
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
 
  const studentList = Object.values(students || {}).filter(s => s.active !== false);
  const hasStudents = studentList.length > 0;
  // 학생이 많을 때만 검색창 표시
  const showSearch = studentList.length > 8;
  const filtered = showSearch && search.trim()
    ? studentList.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : studentList;
 
  // 학생 카드 클릭 → PIN 입력 모드로
  const handleStudentClick = (s) => {
    setSelectedStudent(s);
    setPinInput("");
    setPinError("");
  };
 
  // PIN 입력 자릿수 변경
  const handlePinKey = (digit) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    setPinError("");
    // 4자리 채워지면 자동 검증
    if (newPin.length === 4) {
      setTimeout(() => verifyPin(newPin), 100);
    }
  };
 
  // 한 자리 지우기
  const handlePinBack = () => {
    setPinInput(p => p.slice(0, -1));
    setPinError("");
  };
 
  // PIN 검증
  const verifyPin = (pin) => {
    const correctPin = selectedStudent.password || "0000"; // 기본값 0000
    if (pin === correctPin) {
      // 일치 → 로그인
      onSuccess(selectedStudent.name);
    } else {
      setPinError("비밀번호가 달라요!");
      setPinInput("");
      // 진동 효과 (모바일)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  };
 
  // PIN 입력 화면 취소 → 학생 선택으로 복귀
  const cancelPin = () => {
    setSelectedStudent(null);
    setPinInput("");
    setPinError("");
  };
 
  // ── PIN 입력 화면 ──────────────────────────────────────────────────
  if (selectedStudent) {
    const isDefaultPin = !selectedStudent.password || selectedStudent.password === "0000";
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${T.pink} 0%, ${T.accent} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20
      }}>
        <Card style={{ maxWidth: 380, width: "100%", padding: 24 }}>
          {/* 학생 정보 */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{selectedStudent.avatar || "🙂"}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{selectedStudent.name}</div>
            <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>
              🔑 비밀번호 4자리를 입력해주세요
            </div>
            {isDefaultPin && (
              <div style={{
                marginTop: 12, padding: "10px 14px",
                background: T.yellowLight, color: T.orange,
                fontSize: 11, fontWeight: 700, borderRadius: 10,
                lineHeight: 1.6, textAlign: "left",
                border: `1px solid ${T.orange}33`
              }}>
                💡 <strong>처음 로그인이라면 0000 을 입력하세요.</strong><br/>
                <span style={{ fontSize: 10, color: T.text, opacity: 0.85 }}>
                  로그인 후 🔑 버튼을 눌러 본인 비밀번호로 변경할 수 있어요.
                </span>
              </div>
            )}
          </div>
 
          {/* PIN 표시 (4개 동그라미) */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 12,
            marginBottom: 16
          }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: "50%",
                background: pinInput.length > i ? T.accent : "transparent",
                border: `2px solid ${pinInput.length > i ? T.accent : T.border}`,
                transition: "all 0.15s",
              }} />
            ))}
          </div>
 
          {/* 에러 메시지 */}
          {pinError && (
            <div style={{
              textAlign: "center", color: T.red, fontSize: 12, fontWeight: 700,
              marginBottom: 12, animation: "shake 0.3s"
            }}>
              ⚠️ {pinError}
            </div>
          )}
 
          {/* 숫자 키패드 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8, marginBottom: 14
          }}>
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <button key={d} onClick={() => handlePinKey(d)}
                style={{
                  padding: "16px 0", borderRadius: 12,
                  background: T.bg, border: `1.5px solid ${T.border}`,
                  fontSize: 22, fontWeight: 800, color: T.text,
                  cursor: "pointer", transition: "all 0.1s"
                }}
                onMouseDown={e => { e.currentTarget.style.background = T.accentLight; e.currentTarget.style.transform = "scale(0.95)"; }}
                onMouseUp={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.transform = "scale(1)"; }}
                onTouchStart={e => { e.currentTarget.style.background = T.accentLight; }}
                onTouchEnd={e => { e.currentTarget.style.background = T.bg; }}
              >{d}</button>
            ))}
            <button onClick={handlePinBack}
              style={{
                padding: "16px 0", borderRadius: 12,
                background: T.bg, border: `1.5px solid ${T.border}`,
                fontSize: 18, fontWeight: 800, color: T.textMid,
                cursor: "pointer"
              }}>←</button>
            <button onClick={() => handlePinKey("0")}
              style={{
                padding: "16px 0", borderRadius: 12,
                background: T.bg, border: `1.5px solid ${T.border}`,
                fontSize: 22, fontWeight: 800, color: T.text,
                cursor: "pointer"
              }}>0</button>
            <button onClick={() => { setPinInput(""); setPinError(""); }}
              style={{
                padding: "16px 0", borderRadius: 12,
                background: T.bg, border: `1.5px solid ${T.border}`,
                fontSize: 11, fontWeight: 800, color: T.textMid,
                cursor: "pointer"
              }}>지우기</button>
          </div>
 
          {/* 뒤로 가기 */}
          <Btn v="ghost" size="md" onClick={cancelPin} style={{ width: "100%" }}>
            ← 다른 학생 선택
          </Btn>
        </Card>
      </div>
    );
  }
 
  // ── 학생 선택 화면 (기존과 동일하지만 클릭 핸들러만 변경) ─────────
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
              <button key={s.name} onClick={() => handleStudentClick(s)}
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
//   문제 은행 / 시험지 / 학생 관리 / 과제 배정 / 교사 화면
// ══════════════════════════════════════════════════════════════════════════

function QuestionBank({ bank, setBank }) {
  const [selId, setSelId] = useState(Object.keys(bank)[0] || null);
  const [editing, setEditing] = useState(null);
  const [aiMode, setAiMode] = useState(false);
  const sel = selId ? bank[selId] : null;

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
  const [mode, setMode] = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const [form, setForm] = useState({ name: "", grade: "초등5", avatar: "🦊", memo: "", password: "0000" });
  const [formErr, setFormErr] = useState("");

  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvMsg, setCsvMsg] = useState("");

  const studentList = Object.values(students || {});

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result || "";
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setCsvPreview([]); return; }

    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("이름") || firstLine.includes("name");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const rows = dataLines.map(line => {
      const cols = line.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        name: cols[0] || "",
        grade: cols[1] || "초등5",
        memo: cols[2] || "",
        duplicate: !!students[cols[0]?.trim()],
        valid: cols[0]?.trim().length >= 2,
      };
    });
    setCsvPreview(rows);
  };

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
    setForm({ name: "", grade: "초등5", avatar: "🦊", memo: "", password: "0000" });
    setFormErr("");
    setMode("add");
  };

  const openEdit = (s) => {
    setForm({ name: s.name, grade: s.grade || "초등5", avatar: s.avatar || "🦊", memo: s.memo || "", password: s.password || "0000" });
    setEditTarget(s.name);
    setFormErr("");
    setMode("edit");
  };

  const saveAdd = () => {
    const n = form.name.trim();
    if (!n) { setFormErr("이름을 입력해주세요"); return; }
    if (n.length < 2) { setFormErr("이름은 2자 이상이어야 해요"); return; }
    if (students[n]) { setFormErr("이미 같은 이름의 학생이 있어요"); return; }
    // PIN 4자리 검증 및 0 패딩
    const pin = (form.password || "0000").padStart(4, "0").slice(0, 4);
    setStudents(prev => ({
      ...prev,
      [n]: {
        name: n,
        grade: form.grade,
        avatar: form.avatar,
        memo: form.memo,
        password: pin,
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
    // PIN 4자리 검증 및 0 패딩
    const pin = (form.password || "0000").padStart(4, "0").slice(0, 4);
    setStudents(prev => {
      const old = prev[editTarget];
      const updated = { ...old, grade: form.grade, avatar: form.avatar, memo: form.memo, password: pin };
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

          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>학생 이름 *</div>
          <Input
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErr(""); }}
            placeholder="예: 김민준"
            style={{ marginBottom: 12 }}
          />

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

          {/* PIN 비밀번호 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            🔑 비밀번호 (4자리 숫자)
            {form.password === "0000" && (
              <span style={{ marginLeft: 6, fontSize: 10, color: T.orange, fontWeight: 700 }}>* 기본값 사용 중</span>
            )}
          </div>
          <Input
            value={form.password || "0000"}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
              setForm(f => ({ ...f, password: v }));
              setFormErr("");
            }}
            placeholder="0000"
            maxLength={4}
            inputMode="numeric"
            style={{ marginBottom: 6, fontSize: 16, letterSpacing: 4, textAlign: "center", fontWeight: 800 }}
          />
          <div style={{ fontSize: 10, color: T.textMid, marginBottom: 12, lineHeight: 1.4 }}>
            💡 학생이 로그인할 때 입력하는 4자리 숫자예요.<br/>
            학생이 잊으면 여기서 다시 0000으로 초기화할 수 있어요.
          </div>

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

  return (
    <div>
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
                  <div style={{
                    width: 50, height: 50, borderRadius: 14, background: lvl.bg, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28
                  }}>{s.avatar || "🧑"}</div>

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

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <Btn v="secondary" size="sm" onClick={() => openEdit(s)}>✏️ 수정</Btn>
                    <Btn v="danger" size="sm" onClick={() => deleteStudent(s.name)}>🗑️</Btn>
                  </div>
                </div>

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

  const studentsArr = Object.values(students || {});
  const activeHomeworks = studentsArr.filter(s => s.wordHomework?.active);
  const activeHwCount = activeHomeworks.length;
  const completedHwCount = activeHomeworks.filter(s => {
    const hw = s.wordHomework;
    return hw?.words?.length > 0 && hw.words.every(w => w.mastered);
  }).length;

  const activeExams = studentsArr.filter(s => s.customExam?.active);
  const activeExamCount = activeExams.length;
  const completedExamCount = activeExams.filter(s => s.customExam?.completed).length;

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
        borderRadius: T.radiusLg, padding: "22px 20px", color: "white", marginBottom: 16,
        boxShadow: T.shadowLg, position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", right: -10, top: -10, fontSize: 90, opacity: 0.12, transform: "rotate(12deg)", pointerEvents: "none" }}>👩‍🏫</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4, position: "relative" }}>안녕하세요 👋</div>
        <div style={{ fontSize: 21, fontWeight: 900, position: "relative" }}>Angela 선생님</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6, position: "relative" }}>오늘도 멋진 수업 화이팅!</div>
      </div>

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

      {/* 🔤 파닉스 학습 관리 — 큰 카드 (눈에 잘 띄게) */}
      <Card onClick={() => onNav("phonics")} style={{
        padding: "20px 22px",
        background: `linear-gradient(135deg, ${T.yellow}, ${T.pink}, ${T.purple})`,
        color: "white", cursor: "pointer", border: "none",
        marginBottom: 16, position: "relative", overflow: "hidden",
        boxShadow: T.shadowLg, borderRadius: T.radiusLg
      }}>
        <div style={{
          position: "absolute", right: -30, top: -20,
          fontSize: 140, opacity: 0.15, transform: "rotate(15deg)", pointerEvents: "none"
        }}>🔤</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48 }}>🔤</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>파닉스 학습 관리</span>
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: "rgba(255,255,255,0.25)",
                padding: "3px 10px", borderRadius: T.radiusFull
              }}>NEW</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.95, lineHeight: 1.5 }}>
              유치부 파닉스 단어집 만들기 · 학생 배정 · 수업 모드
            </div>
          </div>
          <div style={{ fontSize: 24, opacity: 0.85 }}>›</div>
        </div>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 10, letterSpacing: 0.5 }}>⚡ 자주 쓰는 작업</div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[
          { id: "word-homework", icon: "📚", label: "단어 숙제 만들기", desc: "학년별 단어 추천 + 배정",  color: T.accent, bg: T.accentLight },
          { id: "custom-exam",   icon: "📝", label: "맞춤 시험지 만들기", desc: "문제 골라서 시험 출제",    color: T.pink,   bg: T.pinkLight },
          { id: "manage",        icon: "👤", label: "학생 관리",        desc: "학생 등록 · 정보 수정",   color: T.green,  bg: T.greenLight },
          { id: "assign",        icon: "📬", label: "과제 배정",        desc: "문제집을 학생에게 배정",  color: T.orange, bg: T.orangeLight },
          { id: "phonics",       icon: "🔤", label: "파닉스 단어집",    desc: "파닉스 단어집 만들기",    color: T.pink,   bg: T.pinkLight },
          { id: "sentence-builder-teacher", icon: "📝", label: "문장 만들기 출제", desc: "섞인 단어로 문장 만들기", color: T.orange, bg: T.orangeLight },
          { id: "word-stats",    icon: "📖", label: "단어 학습 현황",   desc: "학생별 단어 진도 통계",   color: T.purple, bg: T.purpleLight },
        ].map(m => (
          <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: T.radius, background: m.bg, marginBottom: 12,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30
            }}>{m.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text, marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
          </Card>
        ))}
      </div>

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

      <SupabaseMigration />

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

function analyzeStudent(student, assignments, bank) {
  const records = student?.records || [];
  if (records.length === 0) return null;

  const assignResults = {};
  records.filter(r => r.type === "assignment" && r.assignmentId).forEach(r => {
    if (!assignResults[r.assignmentId]) {
      assignResults[r.assignmentId] = { scores: [], title: r.setTitle, bankId: r.bankId };
    }
    assignResults[r.assignmentId].scores.push(
      r.total > 0 ? Math.round(r.score / r.total * 100) : 0
    );
  });

  const recentAssign = records.filter(r => r.type === "assignment").slice(-10);
  const accuracies = recentAssign.map(r => r.total > 0 ? Math.round(r.score / r.total * 100) : 0);
  const avgAcc = accuracies.length > 0
    ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0;

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

  const dates = [...new Set(records.map(r => r.date?.slice(0, 10)))].filter(Boolean).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dates[i] === d.toISOString().slice(0, 10)) streak++;
    else break;
  }

  const recent5 = accuracies.slice(-5);
  const prev5 = accuracies.slice(-10, -5);
  const recentAvg = recent5.length > 0 ? recent5.reduce((a, b) => a + b, 0) / recent5.length : 0;
  const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : 0;
  const trend = recentAvg > prevAvg + 5 ? "up" : recentAvg < prevAvg - 5 ? "down" : "stable";

  return { avgAcc, weakList, streak, trend, recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), totalAttempts: records.length };
}

function CoachingView({ student, assignments, bank, setAssignments, onBack }) {
  const [assignTab, setAssignTab] = useState("result");
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

              <Card style={{ background: `linear-gradient(135deg, ${T.accent}15, ${T.purple}15)`, border: `1.5px solid ${T.accent}33`, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 26 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>Angela AI 코칭</div>
                    <div style={{ fontSize: 10, color: T.textMid }}>학습 데이터 기반 분석</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    {analysis.avgAcc >= 85
                      ? `✅ ${student.name} 학생은 전반적으로 매우 우수한 실력을 보이고 있어요! 현재 ${analysis.avgAcc}%의 높은 정답률을 유지하고 있습니다.`
                      : analysis.avgAcc >= 65
                      ? `📚 ${student.name} 학생은 기본기가 잡혀 있어요. 정답률 ${analysis.avgAcc}%로 조금 더 연습하면 크게 향상될 수 있어요!`
                      : `💪 ${student.name} 학생은 현재 기초를 다지는 단계예요. 정답률 ${analysis.avgAcc}%로 차근차근 반복 학습이 필요합니다.`
                    }
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    {analysis.trend === "up"
                      ? `📈 최근 ${analysis.recentAvg}%로 이전(${analysis.prevAvg}%)보다 뚜렷하게 향상되고 있어요. 현재 학습 방법을 유지하세요!`
                      : analysis.trend === "down"
                      ? `⚠️ 최근 ${analysis.recentAvg}%로 이전(${analysis.prevAvg}%)보다 다소 낮아졌어요. 개념을 다시 점검하고 더 쉬운 문제부터 다시 시작해 보세요.`
                      : `➡️ 성적이 안정적으로 유지되고 있어요. 새로운 유형에 도전해보면 더 성장할 수 있습니다!`
                    }
                  </div>
                  {analysis.weakList.length > 0 && analysis.weakList[0].rate < 70 && (
                    <div style={{ marginBottom: 8 }}>
                      {`🎯 "${analysis.weakList[0].title}" 문제집 정답률이 ${analysis.weakList[0].rate}%로 가장 낮아요. 이 부분을 집중적으로 복습시키는 것을 추천드려요.`}
                    </div>
                  )}
                  <div style={{ marginBottom: 8 }}>
                    {analysis.streak >= 7
                      ? `🔥 ${analysis.streak}일 연속 학습 중! 정말 대단한 꾸준함이에요. 학습 습관이 훌륭합니다.`
                      : analysis.streak >= 3
                      ? `🌱 ${analysis.streak}일 연속 학습하고 있어요. 꾸준한 학습 습관이 형성되고 있답니다!`
                      : `📅 연속 학습일이 짧아요. 매일 조금씩이라도 접속하는 습관을 길러주세요.`
                    }
                  </div>
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
  const [prevScreen, setPrevScreen] = useState("dashboard"); // 뒤로가기용: 직전 화면 기억
  const [viewExamId, setViewExamId] = useState(null);
  const [assignments, setAssignments] = useStorage("angela_assignments", []);
  const [groups,      setGroups]      = useStorage("angela_groups",      []);
  const [notices,     setNotices]     = useStorage("angela_notices",     []);
  const [goals,       setGoals]       = useStorage("angela_goals",       []);
  const [schedules,   setSchedules]   = useStorage("angela_schedules",   []);
  const [attendance,  setAttendance]  = useStorage("angela_attendance",  {});
  const [reportStudent, setReportStudent] = useState(null);

  const onNav = (s, id) => {
    // 화면 이동 전에 현재 화면을 직전 화면으로 기억 (뒤로가기에서 사용)
    if (s !== screen) setPrevScreen(screen);
    setScreen(s);
    if (id) setViewExamId(id);
  };
  const examView = exams.find(e => e.id === viewExamId);

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
    "word-stats":    { title:"📖 단어 학습 현황", back: "more" },
    "phonics":       { title:"🔤 파닉스 단어집", back: "more" },
    "sentence-builder-teacher": { title:"📝 문장 만들기 출제", back: "more" },
    "student-report": { title:"학생 상세 리포트", back: "students" },
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === "ArrowLeft") {
        const dualEntry = ["phonics", "word-stats", "sentence-builder-teacher", "custom-exam", "word-homework"];
        const info = SCREEN_INFO_MAP[screen];
        // 양쪽 진입 화면이면 직전 화면으로, 아니면 고정 back으로
        const dest = (dualEntry.includes(screen) && (prevScreen === "more" || prevScreen === "dashboard"))
          ? prevScreen
          : info?.back;
        if (dest) onNav(dest);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, prevScreen]);

  // 홈과 더보기 양쪽에서 진입 가능한 화면들 — 뒤로가기는 "직전 화면"으로 (홈에서 왔으면 홈, 더보기에서 왔으면 더보기)
  const DUAL_ENTRY_SCREENS = ["phonics", "word-stats", "sentence-builder-teacher", "custom-exam", "word-homework"];
  const rawInfo = SCREEN_INFO_MAP[screen] || { title: screen, back: "dashboard" };
  const curInfo = (DUAL_ENTRY_SCREENS.includes(screen) && (prevScreen === "more" || prevScreen === "dashboard"))
    ? { ...rawInfo, back: prevScreen }
    : rawInfo;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      <div className="topbar" style={{ background: T.card, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
       <div className="top-bar-inner">
        {curInfo.back !== null ? (
          <button onClick={() => onNav(curInfo.back)} style={{ display:"flex", alignItems:"center", gap:4, background:T.bgSoft, border:"none", cursor:"pointer", color:T.accent, fontSize:13, fontWeight:700, padding:"7px 12px", borderRadius:T.radiusSm, flexShrink:0 }}>
            ← 뒤로
          </button>
        ) : (
          <div style={{ fontSize: 22 }}>👩‍🏫</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {curInfo.back === null ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>Angela's English</div>
              <div style={{ fontSize: 10, color: T.textDim }}>선생님 모드</div>
            </>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 900, color: T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {curInfo.title}
            </div>
          )}
        </div>
        <button onClick={() => setDarkMode && setDarkMode(d => !d)} title={darkMode?"라이트 모드":"다크 모드"}
          style={{ background:T.bgSoft, border:"none", cursor:"pointer", fontSize:16, padding:"8px 10px", borderRadius:T.radiusFull, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>
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
        {screen === "groups"     && <GroupManager students={students} groups={groups} setGroups={setGroups} assignments={assignments} setAssignments={setAssignments} bank={bank} />}
        {screen === "goals"      && <GoalManager students={students} goals={goals} setGoals={setGoals} />}
        {screen === "notice"     && <NoticeManager notices={notices} setNotices={setNotices} />}
        {screen === "schedule"   && <ScheduleManager schedules={schedules} setSchedules={setSchedules} />}
        {screen === "league"     && <WeeklyLeague students={students} />}
        {screen === "report"     && <ReportPrint students={students} />}
        {screen === "parent"     && <ParentViewer students={students} />}
        {screen === "attendance"      && <AttendanceManager students={students} attendance={attendance} setAttendance={setAttendance} />}
        {screen === "word-homework"   && <WordHomeworkManager students={students} setStudents={setStudents} onNav={onNav} />}
        {screen === "custom-exam"     && <CustomExamManager students={students} setStudents={setStudents} bank={bank} onNav={onNav} />}
        {screen === "word-stats" && (
          <WordLearningDashboard
            students={students}
            T={T}
            Card={Card}
            Btn={Btn}
            Tag={Tag}
            onStudentClick={(s) => { setReportStudent(s); onNav("student-report"); }}
          />
        )}
        {screen === "phonics" && (
          <PhonicsTeacherMenu students={students} onExit={() => onNav("more")} />
        )}
         {screen === "sentence-builder-teacher" && (
          <SentenceBuilderEditor onExit={() => onNav("more")} />
        )}
        {screen === "student-report"  && reportStudent && (
          <>
            <StudentWordStatsCard studentName={reportStudent.name} />
            <StudentDetailReport student={reportStudent} onBack={() => onNav("students")} />
          </>
        )}
        {screen === "more" && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, marginBottom: 4 }}>✨ 모든 기능</div>
            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 16 }}>역할별로 정리된 모든 메뉴</div>

            {/* 📊 학습 현황 보기 (대시보드) */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 4, height: 16, background: T.purple, borderRadius: 2
                }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, letterSpacing: 0.5 }}>
                  📊 학습 현황 보기
                </div>
              </div>
              <div className="grid-2">
                {[
                  { id:"students",   icon:"📈", label:"학생 통계",      desc:"전체 학습 현황 분석" },
                  { id:"word-stats", icon:"📖", label:"단어 학습 현황", desc:"학생별 단어 진도 통계" },
                  { id:"league",     icon:"🏆", label:"주간 리그",      desc:"이번 주 포인트 순위" },
                  { id:"attendance", icon:"🔔", label:"출석 기록",      desc:"수업 출결 체크 & 통계" },
                ].map(m => (
                  <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 📚 콘텐츠 만들기 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 4, height: 16, background: T.accent, borderRadius: 2
                }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: T.accent, letterSpacing: 0.5 }}>
                  📚 콘텐츠 만들기
                </div>
              </div>
              <div className="grid-2">
                {[
                  { id:"bank",         icon:"🗂️", label:"문제 은행",     desc:"문제 추가 · 편집" },
                  { id:"exam-builder", icon:"✏️", label:"시험지 만들기", desc:"새 시험지 생성" },
                  { id:"exams",        icon:"📋", label:"시험지 목록",   desc:"만든 시험지 보기 / 인쇄" },
                  { id:"custom-exam",  icon:"📝", label:"맞춤 시험지",   desc:"학생별 문제 골라 출제" },
                  { id:"phonics",      icon:"🔤", label:"파닉스 단어집", desc:"유치부 파닉스 관리" },
                  { id:"sentence-builder-teacher", icon:"📝", label:"문장 만들기 출제", desc:"섞인 단어 문장 출제" },
                ].map(m => (
                  <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 👥 학생 관리 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 4, height: 16, background: T.green, borderRadius: 2
                }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: T.green, letterSpacing: 0.5 }}>
                  👥 학생 관리
                </div>
              </div>
              <div className="grid-2">
                {[
                  { id:"manage", icon:"👤", label:"학생 등록 · 수정", desc:"학생 정보 · PIN 관리" },
                  { id:"assign", icon:"📬", label:"과제 배정",         desc:"문제집을 학생에게 배정" },
                  { id:"groups", icon:"👥", label:"반별 그룹 관리",   desc:"반 만들고 일괄 배정" },
                  { id:"goals",  icon:"🎯", label:"목표 설정",         desc:"학생별 월간 목표 지정" },
                ].map(m => (
                  <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 💬 소통 & 학부모 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 4, height: 16, background: T.pink, borderRadius: 2
                }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: T.pink, letterSpacing: 0.5 }}>
                  💬 소통 & 학부모
                </div>
              </div>
              <div className="grid-2">
                {[
                  { id:"notice",   icon:"💬", label:"공지 & 메시지", desc:"학생 앱에 공지 띄우기" },
                  { id:"schedule", icon:"📅", label:"수업 일정",     desc:"일정 · D-day 알림" },
                  { id:"report",   icon:"📋", label:"월간 성적표",   desc:"PDF 인쇄용 성적표" },
                  { id:"parent",   icon:"👨‍👩‍👧", label:"학부모 뷰어",  desc:"자녀 학습 현황 보기" },
                ].map(m => (
                  <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.4 }}>{m.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            {/* ⚙️ 시스템 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 4, height: 16, background: T.textMid, borderRadius: 2
                }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, letterSpacing: 0.5 }}>
                  ⚙️ 시스템
                </div>
              </div>
              <Card onClick={() => onNav("settings")} style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 32 }}>⚙️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>설정</div>
                  <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>
                    비밀번호 · 다크 모드 · 기타 설정
                  </div>
                </div>
                <div style={{ fontSize: 18, color: T.textDim }}>›</div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <div className="no-print bottom-nav">
        {TEACHER_NAV.map(n => {
          const active = screen === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)} style={{ flex: 1, background: "none", border: "none", padding: "8px 2px 14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                fontSize: 19, transition: "all 0.15s",
                transform: active ? "scale(1.1)" : "scale(1)",
                background: active ? T.accentLight : "transparent",
                width: 38, height: 28, borderRadius: T.radiusFull,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>{n.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: active ? T.accent : T.textDim }}>{n.label}</div>
            </button>
          );
        })}
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    document.body.style.background = darkMode ? "#0f172a" : "#f0f7ff";
  }, [darkMode]);

  useEffect(() => {
    if (!bankHydrated) return;
    setBank((prev) => {
      const needsMigration =
        (prev.bp && prev.bp.questions && prev.bp.questions.length < 50) ||
        (prev.vpa && prev.vpa.questions && prev.vpa.questions.length < 50) ||
        (prev.mod && prev.mod.questions && prev.mod.questions.length < 50);

      if (needsMigration) {
        const userSets = {};
        Object.entries(prev).forEach(([k, v]) => {
          if (k !== "bp" && k !== "vpa" && k !== "mod") userSets[k] = v;
        });
        return { ...INIT_BANK, ...userSets };
      }

      const missingDefaults = Object.keys(INIT_BANK).filter((k) => !prev[k]);
      if (missingDefaults.length > 0) {
        const merged = { ...prev };
        missingDefaults.forEach((k) => { merged[k] = INIT_BANK[k]; });
        return merged;
      }

      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankHydrated]);

  const enterAsStudent = (name) => {
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
