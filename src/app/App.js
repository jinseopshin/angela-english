"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { QUESTION_BANK } from "./questionData";
import { WORD_LEVELS, ALL_WORDS, getWordsByLevel } from "./wordData";

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

// localStorage 훅
function useStorage(key, initial) {
  const [val, setVal] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
    }
  }, [key, val]);
  return [val, setVal];
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

function StudentLogin({ onSuccess, onBack }) {
  const [name, setName] = useState("");

  const submit = () => {
    if (name.trim().length >= 2) onSuccess(name.trim());
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${T.pink} 0%, ${T.accent} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <Card style={{ maxWidth: 380, width: "100%", padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>이름을 알려주세요</div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>오늘도 영어 공부 화이팅!</div>
        </div>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예: Shine"
          style={{ marginBottom: 12, fontSize: 16, textAlign: "center" }}
        />
        <Btn v="primary" size="lg" onClick={submit} disabled={name.trim().length < 2} style={{ width: "100%" }}>
          입장하기 →
        </Btn>
        <Btn v="ghost" size="md" onClick={onBack} style={{ width: "100%", marginTop: 8 }}>← 처음으로</Btn>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   학생 진도 & 통계 대시보드 (선생님용)
// ══════════════════════════════════════════════════════════════════════════

const LEVEL_INFO = {
  A: { color: T.green, bg: T.greenLight, label: "상위", icon: "🥇" },
  B: { color: T.accent, bg: T.accentLight, label: "중위", icon: "🥈" },
  C: { color: T.orange, bg: T.orangeLight, label: "기초", icon: "🥉" },
};

function getLevel(accuracy) {
  if (accuracy >= 80) return "A";
  if (accuracy >= 60) return "B";
  return "C";
}

function computeStudentStats(s) {
  const records = s.records || [];
  if (records.length === 0) {
    return {
      accuracy: 0, totalGames: 0, totalAssign: 0,
      avgGameScore: 0, streak: 0, lastActive: "신규",
      level: "C", gameCount: {}, catAccuracy: {}
    };
  }
  let totalCorrect = 0, totalQ = 0;
  const gameCount = {};
  const catStats = {}; // {cat: {correct, total}}
  let totalGames = 0, totalAssign = 0;
  let gameScoreSum = 0, gameScoreN = 0;

  records.forEach(r => {
    totalCorrect += r.score || 0;
    totalQ += r.total || 0;
    if (r.type === "game") {
      totalGames++;
      gameCount[r.gameType] = (gameCount[r.gameType] || 0) + 1;
      if (r.total > 0) {
        gameScoreSum += Math.round(r.score / r.total * 100);
        gameScoreN++;
      }
    } else if (r.type === "assignment") {
      totalAssign++;
    }
    if (r.category && r.total > 0) {
      catStats[r.category] = catStats[r.category] || { correct: 0, total: 0 };
      catStats[r.category].correct += r.score || 0;
      catStats[r.category].total += r.total || 0;
    }
  });

  const accuracy = totalQ > 0 ? Math.round(totalCorrect / totalQ * 100) : 0;
  const avgGameScore = gameScoreN > 0 ? Math.round(gameScoreSum / gameScoreN) : 0;

  // streak 계산 (최근 며칠 연속)
  const dates = [...new Set(records.map(r => r.date?.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let cursor = new Date();
  for (let i = 0; i < dates.length; i++) {
    const dStr = cursor.toISOString().slice(0, 10);
    if (dates.includes(dStr)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else if (i === 0 && dates[0] !== today) { break; }
    else break;
  }

  // 마지막 활동 표시
  const lastDate = records[records.length - 1]?.date?.slice(0, 10);
  let lastActive = "신규";
  if (lastDate === today) lastActive = "오늘";
  else if (lastDate) {
    const diff = Math.floor((new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    lastActive = diff === 1 ? "어제" : `${diff}일 전`;
  }

  const catAccuracy = {};
  Object.entries(catStats).forEach(([k, v]) => {
    catAccuracy[k] = v.total > 0 ? Math.round(v.correct / v.total * 100) : 0;
  });

  return {
    accuracy, totalGames, totalAssign, avgGameScore, streak,
    lastActive, level: getLevel(accuracy), gameCount, catAccuracy
  };
}

// ── 학생 상세 모달 ────────────────────────────────────────────────────────
function StudentDetailModal({ student, stats, onClose }) {
  if (!student) return null;
  const lvl = LEVEL_INFO[stats.level];

  const skillData = [
    { skill: "어휘력", score: stats.accuracy },
    { skill: "게임실력", score: stats.avgGameScore },
    { skill: "꾸준함", score: Math.min(100, stats.streak * 10) },
    { skill: "과제수행", score: Math.min(100, stats.totalAssign * 15) },
    { skill: "참여도", score: Math.min(100, (stats.totalGames + stats.totalAssign) * 8) },
  ];

  // 최근 10회 점수 추이
  const recent = (student.records || []).slice(-10).map((r, i) => ({
    n: `${i + 1}회`,
    점수: r.total > 0 ? Math.round((r.score || 0) / r.total * 100) : 0
  }));

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 200
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: 22, maxWidth: 600, width: "100%",
        maxHeight: "90vh", overflowY: "auto", boxShadow: T.shadowLg
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
          padding: "20px 22px", color: "white", borderRadius: "22px 22px 0 0", position: "relative"
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 10,
            background: "rgba(255,255,255,0.25)", color: "white", border: "none",
            fontSize: 16, cursor: "pointer", fontWeight: 700
          }}>✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34
            }}>{student.avatar || "🧑"}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{student.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>{student.grade || "학년 미정"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>{lvl.icon} {lvl.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>⭐ {student.points || 0}p</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
            <div style={{ background: T.accentLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accent }}>{stats.accuracy}%</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>정답률</div>
            </div>
            <div style={{ background: T.greenLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.green }}>{stats.totalAssign}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>완료 과제</div>
            </div>
            <div style={{ background: T.yellowLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.yellow }}>{stats.totalGames}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>게임 횟수</div>
            </div>
            <div style={{ background: T.pinkLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.pink }}>🔥{stats.streak}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>연속학습</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>📊 영역별 능력</div>
            <div style={{ background: T.bg, borderRadius: 12, padding: 8, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={skillData}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: T.textMid, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: T.textDim }} />
                  <Radar dataKey="score" stroke={T.accent} fill={T.accent} fillOpacity={0.4} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {recent.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>📈 최근 점수 추이</div>
              <div style={{ background: T.bg, borderRadius: 12, padding: 8, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recent}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="n" tick={{ fontSize: 10, fill: T.textMid }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T.textMid }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Area type="monotone" dataKey="점수" stroke={T.accent} strokeWidth={2.5} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>🎮 게임별 참여 횟수</div>
            {Object.keys(stats.gameCount).length === 0
              ? <div style={{ fontSize: 12, color: T.textDim, padding: 14, textAlign: "center", background: T.bg, borderRadius: 12 }}>아직 게임 기록이 없어요</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(stats.gameCount).map(([g, c]) => (
                    <div key={g} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bg, borderRadius: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{g}</span>
                      <Tag color="blue">{c}회</Tag>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 통계 대시보드 메인 ────────────────────────────────────────────────────
function StatsDashboard({ students }) {
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("points");
  const [selected, setSelected] = useState(null);

  const studentList = Object.values(students || {});

  // 각 학생별 통계 계산
  const studentsWithStats = useMemo(() =>
    studentList.map(s => ({ ...s, stats: computeStudentStats(s) })),
    [students]
  );

  // 전체 통계
  const overall = useMemo(() => {
    const total = studentsWithStats.length;
    const activeToday = studentsWithStats.filter(s => s.stats.lastActive === "오늘").length;
    const avgAcc = total > 0 ? Math.round(studentsWithStats.reduce((a, s) => a + s.stats.accuracy, 0) / total) : 0;
    const totalPoints = studentsWithStats.reduce((a, s) => a + (s.points || 0), 0);
    const totalGames = studentsWithStats.reduce((a, s) => a + s.stats.totalGames, 0);
    const totalAssign = studentsWithStats.reduce((a, s) => a + s.stats.totalAssign, 0);
    return { total, activeToday, avgAcc, totalPoints, totalGames, totalAssign };
  }, [studentsWithStats]);

  // 레벨 분포
  const levelDist = useMemo(() => [
    { name: "상위 (A)", value: studentsWithStats.filter(s => s.stats.level === "A").length, color: T.green },
    { name: "중위 (B)", value: studentsWithStats.filter(s => s.stats.level === "B").length, color: T.accent },
    { name: "기초 (C)", value: studentsWithStats.filter(s => s.stats.level === "C").length, color: T.orange },
  ], [studentsWithStats]);

  // 주간 활동
  const weekly = useMemo(() => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = d.toISOString().slice(0, 10);
      let assign = 0, game = 0;
      studentsWithStats.forEach(s => {
        (s.records || []).forEach(r => {
          if (r.date?.slice(0, 10) === dStr) {
            if (r.type === "game") game++;
            else if (r.type === "assignment") assign++;
          }
        });
      });
      return { day: days[d.getDay()], 과제: assign, 게임: game };
    });
    return result;
  }, [studentsWithStats]);

  // 카테고리별 정답률
  const catData = useMemo(() => {
    const cats = {};
    studentsWithStats.forEach(s => {
      (s.records || []).forEach(r => {
        if (r.category && r.total > 0) {
          cats[r.category] = cats[r.category] || { correct: 0, total: 0 };
          cats[r.category].correct += r.score || 0;
          cats[r.category].total += r.total || 0;
        }
      });
    });
    return Object.entries(cats).map(([k, v]) => ({
      category: k,
      정답률: v.total > 0 ? Math.round(v.correct / v.total * 100) : 0
    }));
  }, [studentsWithStats]);

  // 게임 인기도
  const gameData = useMemo(() => {
    const games = {};
    studentsWithStats.forEach(s => {
      (s.records || []).forEach(r => {
        if (r.type === "game" && r.gameType) {
          games[r.gameType] = (games[r.gameType] || 0) + 1;
        }
      });
    });
    const colors = [T.accent, T.green, T.yellow, T.pink, T.purple];
    return Object.entries(games).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [studentsWithStats]);

  // 관심 학생 찾기
  const attention = useMemo(() => {
    const inactive = studentsWithStats.filter(s => {
      const la = s.stats.lastActive;
      return la !== "오늘" && la !== "어제" && la !== "신규" && s.records?.length > 0;
    });
    const lowAcc = studentsWithStats.filter(s => s.stats.accuracy > 0 && s.stats.accuracy < 60);
    return { inactive, lowAcc };
  }, [studentsWithStats]);

  // 학생 목록 필터링
  const filtered = useMemo(() => {
    let list = studentsWithStats;
    if (filter !== "all") list = list.filter(s => s.stats.level === filter);
    if (search) list = list.filter(s => s.name.includes(search));
    return [...list].sort((a, b) => {
      if (sortBy === "points") return (b.points || 0) - (a.points || 0);
      if (sortBy === "accuracy") return b.stats.accuracy - a.stats.accuracy;
      if (sortBy === "streak") return b.stats.streak - a.stats.streak;
      return 0;
    });
  }, [studentsWithStats, filter, search, sortBy]);

  // 빈 데이터일 때
  if (studentList.length === 0) {
    return (
      <Card style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>아직 학생 데이터가 없어요</div>
        <div style={{ fontSize: 12, color: T.textMid }}>학생들이 로그인해서 게임이나 과제를 풀면<br/>여기에 자동으로 통계가 쌓입니다!</div>
      </Card>
    );
  }

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: T.card, padding: 6, borderRadius: 12, boxShadow: T.shadow }}>
        {[
          { id: "overview", label: "📈 전체 현황" },
          { id: "students", label: "👥 학생 목록" },
          { id: "ranking", label: "🏆 랭킹" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 9, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 800,
            background: tab === t.id ? T.accent : "transparent",
            color: tab === t.id ? "white" : T.textMid,
            transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      {/* 전체 현황 탭 */}
      {tab === "overview" && (
        <div>
          {/* 핵심 지표 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { icon: "👥", label: "전체 학생", val: overall.total, sub: `오늘 ${overall.activeToday}명 활동`, c: T.accent, bg: T.accentLight },
              { icon: "🎯", label: "평균 정답률", val: `${overall.avgAcc}%`, sub: "전체 합산", c: T.green, bg: T.greenLight },
              { icon: "🎮", label: "총 게임", val: overall.totalGames, sub: "누적 플레이", c: T.yellow, bg: T.yellowLight },
              { icon: "⭐", label: "누적 포인트", val: overall.totalPoints, sub: "학원 전체", c: T.pink, bg: T.pinkLight },
            ].map((s, i) => (
              <Card key={i} style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.text, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: s.c, fontWeight: 700, marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 주간 활동 + 레벨 분포 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📅 주간 활동 추이</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekly}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.pink} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={T.pink} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: T.textMid }} />
                    <YAxis tick={{ fontSize: 11, fill: T.textMid }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                    <Area type="monotone" dataKey="과제" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" />
                    <Area type="monotone" dataKey="게임" stroke={T.pink} strokeWidth={2.5} fill="url(#gB)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>🏆 레벨 분포</div>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={levelDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3}>
                      {levelDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {levelDist.map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />
                      <span style={{ color: T.textMid, fontWeight: 600 }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: T.text }}>{d.value}명</span>
                  </div>
                ))}
              </div>
            </Card>

            {gameData.length > 0 ? (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>🎮 게임별 플레이</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gameData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.textMid }} />
                      <YAxis tick={{ fontSize: 10, fill: T.textMid }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {gameData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎮</div>
                <div style={{ fontSize: 12, color: T.textMid }}>아직 게임 데이터가 없어요</div>
              </Card>
            )}
          </div>

          {catData.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📚 카테고리별 정답률</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: T.textMid }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: T.text, fontWeight: 600 }} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Bar dataKey="정답률" radius={[0, 6, 6, 0]}>
                      {catData.map((d, i) => (
                        <Cell key={i} fill={d.정답률 >= 85 ? T.green : d.정답률 >= 70 ? T.accent : T.orange} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* 관심 학생 알림 */}
          {(attention.inactive.length > 0 || attention.lowAcc.length > 0) && (
            <Card style={{ background: T.yellowLight, border: `1.5px dashed ${T.yellow}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 22 }}>💡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>관심이 필요한 학생</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7 }}>
                    {attention.inactive.length > 0 && (
                      <div>
                        🕐 며칠째 활동 없음: {attention.inactive.map(s => (
                          <strong key={s.name} style={{ color: T.red }}>{s.name}({s.stats.lastActive}) </strong>
                        ))}
                      </div>
                    )}
                    {attention.lowAcc.length > 0 && (
                      <div>
                        📉 정답률 낮음 (60% 미만): {attention.lowAcc.map(s => (
                          <strong key={s.name} style={{ color: T.orange }}>{s.name}({s.stats.accuracy}%) </strong>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 학생 목록 탭 */}
      {tab === "students" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>👨‍🎓 학생 진도 현황 ({filtered.length})</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 이름 검색" style={{
                padding: "7px 11px", borderRadius: 9, border: `1.5px solid ${T.border}`,
                fontSize: 12, outline: "none", minWidth: 140
              }} />
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>레벨</span>
              {[
                { id: "all", label: "전체" }, { id: "A", label: "🥇 상위" },
                { id: "B", label: "🥈 중위" }, { id: "C", label: "🥉 기초" }
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: filter === f.id ? T.accent : T.accentLight,
                  color: filter === f.id ? "white" : T.accent, border: "none", cursor: "pointer"
                }}>{f.label}</button>
              ))}
              <span style={{ fontSize: 10, color: T.textMid, fontWeight: 700, marginLeft: 6 }}>정렬</span>
              {[
                { id: "points", label: "포인트" },
                { id: "accuracy", label: "정답률" },
                { id: "streak", label: "연속학습" }
              ].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                  padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: sortBy === s.id ? T.purple : T.purpleLight,
                  color: sortBy === s.id ? "white" : T.purple, border: "none", cursor: "pointer"
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div>
            {filtered.map((s, i) => {
              const lvl = LEVEL_INFO[s.stats.level];
              return (
                <div key={s.name} onClick={() => setSelected(s)} style={{
                  padding: "12px 14px",
                  borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                  display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, background: lvl.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
                  }}>{s.avatar || "🧑"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.name}</span>
                      <Tag color={s.stats.level === "A" ? "green" : s.stats.level === "B" ? "blue" : "orange"}>{lvl.icon} {lvl.label}</Tag>
                      {s.stats.lastActive === "오늘" && <Tag color="green">● 활동중</Tag>}
                      {s.stats.streak >= 5 && <Tag color="pink">🔥{s.stats.streak}일</Tag>}
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 10, color: T.textMid, flexWrap: "wrap" }}>
                      <span>📝 과제 {s.stats.totalAssign}</span>
                      <span>🎮 게임 {s.stats.totalGames}</span>
                      <span>🎯 {s.stats.accuracy}%</span>
                      <span>⭐ {s.points || 0}p</span>
                      <span style={{ color: s.stats.lastActive === "오늘" ? T.green : T.textDim }}>· {s.stats.lastActive}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: T.textDim }}>›</div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 12 }}>검색 결과가 없어요</div>
            )}
          </div>
        </Card>
      )}

      {/* 랭킹 탭 */}
      {tab === "ranking" && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 900, color: T.text, marginBottom: 12 }}>🏆 포인트 랭킹</div>
          {studentsWithStats.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: T.textDim, fontSize: 12 }}>데이터가 없어요</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...studentsWithStats]
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 10)
                .map((s, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const bgs = [T.yellowLight, T.accentLight, T.orangeLight];
                  return (
                    <div key={s.name} onClick={() => setSelected(s)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      background: i < 3 ? bgs[i] : T.bg, borderRadius: 12, cursor: "pointer"
                    }}>
                      <div style={{ fontSize: 22, width: 32, textAlign: "center" }}>{medals[i] || `${i + 1}`}</div>
                      <div style={{ fontSize: 24 }}>{s.avatar || "🧑"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: T.textMid }}>정답률 {s.stats.accuracy}% · 게임 {s.stats.totalGames}회</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>⭐ {(s.points || 0).toLocaleString()}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      <StudentDetailModal
        student={selected}
        stats={selected ? computeStudentStats(selected) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   문제은행 / 출제 / 시험지
// ══════════════════════════════════════════════════════════════════════════

function QuestionBank({ bank, setBank }) {
  const [selId, setSelId] = useState(Object.keys(bank)[0] || null);
  const [editing, setEditing] = useState(null);
  const sel = selId ? bank[selId] : null;

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
  { id: "dashboard", icon: "📊", label: "대시보드" },
  { id: "manage", icon: "👤", label: "학생관리" },
  { id: "assign", icon: "📬", label: "과제배정" },
  { id: "students", icon: "📈", label: "통계" },
  { id: "bank", icon: "📚", label: "문제은행" },
  { id: "settings", icon: "⚙️", label: "설정" },
];

// ══════════════════════════════════════════════════════════════════════════
//   학생 관리 화면 (선생님용)
// ══════════════════════════════════════════════════════════════════════════
function StudentManager({ students, setStudents }) {
  const [mode, setMode] = useState("list"); // list | add | edit
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name | grade | points | recent

  // 추가/편집 폼 상태
  const [form, setForm] = useState({ name: "", grade: "초등5", avatar: "🦊", memo: "" });
  const [formErr, setFormErr] = useState("");

  const studentList = Object.values(students || {});

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
        <Btn v="primary" size="md" onClick={openAdd}>+ 학생 추가</Btn>
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
              ? "+ 학생 추가 버튼으로 직접 등록하거나\n학생이 학생 모드로 로그인하면 자동 등록됩니다"
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

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
        borderRadius: 16, padding: "20px 18px", color: "white", marginBottom: 16,
        boxShadow: T.shadowLg
      }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>안녕하세요 👋</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Angela 선생님</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>오늘도 멋진 수업 화이팅!</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 28 }}>👥</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>전체 학생</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{studentCount}명</div>
              <div style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>오늘 {todayActive}명 활동</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 28 }}>📚</div>
            <div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>문제 은행</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{questionCount}문항</div>
              <div style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{Object.keys(bank).length}개 문제집</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: T.textMid, marginBottom: 10, letterSpacing: 0.5 }}>빠른 실행</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {[
          { id: "dashboard", icon: "📊", label: "학생 대시보드", color: T.accent, bg: T.accentLight },
          { id: "students", icon: "👥", label: "학생 통계 보기", color: T.purple, bg: T.purpleLight },
          { id: "exam-builder", icon: "✏️", label: "시험지 만들기", color: T.green, bg: T.greenLight },
          { id: "bank", icon: "📚", label: "문제 추가", color: T.pink, bg: T.pinkLight },
        ].map(m => (
          <Card key={m.id} onClick={() => onNav(m.id)} style={{ padding: 18, textAlign: "center" }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14, background: m.bg, margin: "0 auto 8px",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26
            }}>{m.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{m.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TeacherSettings({ savedPw, setSavedPw }) {
  const [cur, setCur] = useState("");
  const [neu, setNeu] = useState("");
  const [msg, setMsg] = useState("");

  const change = () => {
    if (cur !== savedPw) { setMsg("현재 비밀번호가 틀려요!"); return; }
    if (neu.length < 4) { setMsg("4자 이상 입력해주세요!"); return; }
    setSavedPw(neu);
    setCur(""); setNeu("");
    setMsg("✅ 변경되었어요!");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <Card>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 14 }}>🔑 비밀번호 변경</div>
      <Input type="password" value={cur} onChange={e => setCur(e.target.value)} placeholder="현재 비밀번호" style={{ marginBottom: 8 }} />
      <Input type="password" value={neu} onChange={e => setNeu(e.target.value)} placeholder="새 비밀번호 (4자 이상)" style={{ marginBottom: 10 }} />
      <Btn v="primary" size="md" onClick={change} style={{ width: "100%" }}>변경하기</Btn>
      {msg && <div style={{ fontSize: 12, color: msg.startsWith("✅") ? T.green : T.red, marginTop: 8, textAlign: "center", fontWeight: 700 }}>{msg}</div>}
    </Card>
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
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>학생이 학생 모드로 로그인하면 자동으로 등록됩니다</div>
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


function TeacherApp({ onLogout, bank, setBank, exams, setExams, students, setStudents, savedPw, setSavedPw }) {
  const [screen, setScreen] = useState("dashboard");
  const [viewExamId, setViewExamId] = useState(null);
  const [assignments, setAssignments] = useStorage("angela_assignments", []);

  const onNav = (s, id) => {
    setScreen(s);
    if (id) setViewExamId(id);
  };

  const examView = exams.find(e => e.id === viewExamId);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10
      }}>
        <div style={{ fontSize: 22 }}>👩‍🏫</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>Angela's Academy</div>
          <div style={{ fontSize: 10, color: T.textDim }}>선생님 모드</div>
        </div>
        <Btn v="ghost" size="sm" onClick={onLogout}>로그아웃</Btn>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 12px" }}>
        {screen === "dashboard" && <TeacherHome bank={bank} exams={exams} students={students} onNav={onNav} />}
        {screen === "manage" && <StudentManager students={students} setStudents={setStudents} />}
        {screen === "assign" && <AssignmentManager students={students} bank={bank} assignments={assignments} setAssignments={setAssignments} />}
        {screen === "students" && <StatsDashboard students={students} />}
        {screen === "bank" && <QuestionBank bank={bank} setBank={setBank} />}
        {screen === "exam-builder" && <ExamBuilder bank={bank} setExams={setExams} onNav={onNav} />}
        {screen === "exams" && <ExamList exams={exams} setExams={setExams} onNav={onNav} />}
        {screen === "exam-view" && examView && <ExamPrintView exam={examView} onBack={() => onNav("exams")} />}
        {screen === "settings" && <TeacherSettings savedPw={savedPw} setSavedPw={setSavedPw} />}
      </div>

      {/* 하단 네비 */}
      <div className="no-print" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: T.card,
        borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 100,
        boxShadow: "0 -2px 12px rgba(59,110,248,0.08)"
      }}>
        {TEACHER_NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            flex: 1, background: "none", border: "none", padding: "8px 2px 14px",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          }}>
            <div style={{
              fontSize: 20, transition: "transform 0.15s",
              transform: screen === n.id ? "scale(1.2)" : "scale(1)"
            }}>{n.icon}</div>
            <div style={{
              fontSize: 9, fontWeight: 800,
              color: screen === n.id ? T.accent : T.textDim
            }}>{n.label}</div>
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

// ── 게임 1: 단어 맞추기 (뜻 보고 영단어 선택) ─────────────────────────────
function WordMatchGame({ name, setStudents, onExit, levelId = "all" }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null); // null | "correct" | "wrong"

  const questions = useMemo(() => {
    const pool = getWordsByLevel(levelId);
    const picked = shuffle(pool).slice(0, 10);
    return picked.map(w => {
      const wrongs = shuffle(pool.filter(x => x.en !== w.en)).slice(0, 3);
      const opts = shuffle([w, ...wrongs]);
      return { ...w, opts, ansIdx: opts.findIndex(o => o.en === w.en) };
    });
  }, [levelId]);

  if (round >= questions.length) {
    // 게임 종료 → 저장
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: "단어 맞추기",
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 10
    });
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>{score >= 8 ? "🎉" : score >= 5 ? "👏" : "💪"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, marginBottom: 6 }}>
          {score} / {questions.length}
        </div>
        <div style={{ fontSize: 14, color: T.textMid, marginBottom: 20 }}>
          {score >= 8 ? "정말 잘했어요!" : score >= 5 ? "좋아요!" : "다시 도전해봐요!"}
        </div>
        <Card style={{ maxWidth: 320, margin: "0 auto 14px", background: T.yellowLight }}>
          <div style={{ fontSize: 32 }}>⭐</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>+{score * 10} 포인트 획득!</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  const q = questions[round];

  const pick = (idx) => {
    if (feedback) return;
    if (idx === q.ansIdx) { setScore(score + 1); setFeedback("correct"); }
    else setFeedback("wrong");
    setTimeout(() => { setFeedback(null); setRound(round + 1); }, 800);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="blue">{round + 1} / {questions.length}</Tag>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      <Card style={{ marginBottom: 16, textAlign: "center", padding: 28, background: T.accentLight }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>다음 뜻의 영어 단어는?</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: T.accent }}>{q.ko}</div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {q.opts.map((o, idx) => {
          let bg = T.card, color = T.text;
          if (feedback && idx === q.ansIdx) { bg = T.green; color = "white"; }
          else if (feedback === "wrong" && idx !== q.ansIdx) { bg = T.card; }
          return (
            <button key={idx} onClick={() => pick(idx)} style={{
              padding: "20px 14px", borderRadius: 14, border: `2px solid ${T.border}`,
              background: bg, color, fontSize: 16, fontWeight: 800, cursor: "pointer",
              transition: "all 0.2s", boxShadow: T.shadow
            }}>{o.en}</button>
          );
        })}
      </div>

      {feedback && (
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 24, fontWeight: 900,
          color: feedback === "correct" ? T.green : T.red }}>
          {feedback === "correct" ? "✓ 정답!" : "✗ 오답"}
        </div>
      )}
    </div>
  );
}

// ── 게임 2: 스펠링 ────────────────────────────────────────────────────────
function SpellingGame({ name, setStudents, onExit, levelId = "all" }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);

  const questions = useMemo(() => shuffle(getWordsByLevel(levelId)).slice(0, 8), [levelId]);

  if (round >= questions.length) {
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: "스펠링",
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 15
    });
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>🔤</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{score} / {questions.length}</div>
        <Card style={{ maxWidth: 320, margin: "20px auto 14px", background: T.yellowLight }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>⭐ +{score * 15} 포인트</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  const q = questions[round];

  const submit = () => {
    if (feedback) return;
    if (input.trim().toLowerCase() === q.en.toLowerCase()) {
      setScore(score + 1); setFeedback("correct");
    } else setFeedback("wrong");
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

// ── 게임 3: 스피드 퀴즈 (10초 제한) ───────────────────────────────────────
function SpeedQuiz({ name, setStudents, onExit, levelId = "all" }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(10);

  const questions = useMemo(() => {
    const pool = getWordsByLevel(levelId);
    const picked = shuffle(pool).slice(0, 10);
    return picked.map(w => {
      const wrongs = shuffle(pool.filter(x => x.ko !== w.ko)).slice(0, 3);
      const opts = shuffle([w, ...wrongs]);
      return { ...w, opts, ansIdx: opts.findIndex(o => o.ko === w.ko) };
    });
  }, [levelId]);

  useEffect(() => {
    if (round >= questions.length) return;
    setTime(10);
    const interval = setInterval(() => {
      setTime(t => {
        if (t <= 1) { clearInterval(interval); setRound(r => r + 1); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [round, questions.length]);

  if (round >= questions.length) {
    saveStudentRecord(setStudents, name, {
      type: "game", gameType: "스피드 퀴즈",
      score, total: questions.length,
      category: questions[0]?.cat || "기타",
      points: score * 12
    });
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>⚡</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{score} / {questions.length}</div>
        <Card style={{ maxWidth: 320, margin: "20px auto", background: T.yellowLight }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>⭐ +{score * 12} 포인트</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  const q = questions[round];

  const pick = (idx) => {
    if (idx === q.ansIdx) setScore(score + 1);
    setRound(round + 1);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color={time <= 3 ? "red" : "yellow"}>⏱️ {time}초</Tag>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>

      <div style={{ height: 6, background: T.border, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${time * 10}%`, background: time <= 3 ? T.red : T.accent, transition: "width 1s linear" }} />
      </div>

      <Card style={{ marginBottom: 16, textAlign: "center", padding: 28, background: T.yellowLight }}>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>이 단어의 뜻은?</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: T.yellow, marginBottom: 8 }}>{q.en}</div>
        <button onClick={() => speak(q.en)} style={{
          background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 10,
          padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.yellow
        }}>🔊 발음</button>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {q.opts.map((o, idx) => (
          <button key={idx} onClick={() => pick(idx)} style={{
            padding: "20px 14px", borderRadius: 14, border: `2px solid ${T.border}`,
            background: T.card, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: T.shadow
          }}>{o.ko}</button>
        ))}
      </div>
    </div>
  );
}

// ── 게임 4: 플래시카드 (발음 기능 포함) ───────────────────────────────────
function FlashCard({ name, setStudents, onExit, levelId = "all" }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = useMemo(() => shuffle(getWordsByLevel(levelId)).slice(0, 10), [levelId]);
  const [studied, setStudied] = useState(0);

  // 카드가 바뀌면 자동으로 발음 재생
  useEffect(() => {
    if (cards[idx]) speak(cards[idx].en);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

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
function StudentHome({ name, bank, setStudents, students, onLogout }) {
  const [screen, setScreen] = useState("home"); // home | level-select | game-* | quiz
  const [quizSet, setQuizSet] = useState(null);
  const [pendingGame, setPendingGame] = useState(null); // {id, info}
  const [selectedLevel, setSelectedLevel] = useState("all");

  const me = students[name] || {};
  const points = me.points || 0;

  // 게임 카드 클릭 → 수준 선택으로
  const startGame = (gameInfo) => {
    setPendingGame(gameInfo);
    setScreen("level-select");
  };

  // 수준 선택 완료 → 실제 게임으로
  const onLevelSelected = (levelId) => {
    setSelectedLevel(levelId);
    setScreen(pendingGame.id);
  };

  // 게임 종료 → 홈으로
  const exitGame = () => {
    setScreen("home");
    setPendingGame(null);
  };

  if (screen === "level-select" && pendingGame) {
    return <LevelSelect gameInfo={pendingGame} onSelect={onLevelSelected} onCancel={exitGame} />;
  }
  if (screen === "game-match") return <WordMatchGame name={name} setStudents={setStudents} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-spell") return <SpellingGame name={name} setStudents={setStudents} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-speed") return <SpeedQuiz name={name} setStudents={setStudents} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "game-flash") return <FlashCard name={name} setStudents={setStudents} onExit={exitGame} levelId={selectedLevel} />;
  if (screen === "quiz" && quizSet) {
    return <StudentQuiz name={name} setStudents={setStudents} qset={quizSet} onExit={() => { setScreen("home"); setQuizSet(null); }} />;
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 40 }}>
      <div style={{
        background: `linear-gradient(135deg, ${T.pink} 0%, ${T.accent} 100%)`,
        padding: "20px 16px 28px", color: "white"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{greet} 👋</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{name}님</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>오늘도 영어 공부 화이팅!</div>
          </div>
          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{points}</div>
            <div style={{ fontSize: 10, opacity: 0.85 }}>⭐ 포인트</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 12px", maxWidth: 480, margin: "0 auto" }}>
        {/* 배정된 과제 */}
        {(() => {
          const myAssigns = (typeof window !== "undefined"
            ? JSON.parse(window.localStorage.getItem("angela_assignments") || "[]")
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

        {/* 게임 영역 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>🎮 단어 게임</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { id: "game-match", icon: "🎯", name: "단어 맞추기", sub: "뜻 보고 단어 선택", c: T.accent, bg: T.accentLight },
            { id: "game-spell", icon: "🔤", name: "스펠링", sub: "철자 직접 입력", c: T.green, bg: T.greenLight },
            { id: "game-speed", icon: "⚡", name: "스피드 퀴즈", sub: "10초 안에!", c: T.yellow, bg: T.yellowLight },
            { id: "game-flash", icon: "🧩", name: "플래시카드", sub: "🔊 발음 포함", c: T.pink, bg: T.pinkLight },
          ].map(g => (
            <Card key={g.id} onClick={() => startGame(g)} style={{ padding: 16, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: g.bg, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{g.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{g.name}</div>
              <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>{g.sub}</div>
            </Card>
          ))}
        </div>

        <Btn v="ghost" size="md" onClick={onLogout} style={{ width: "100%", marginTop: 20 }}>로그아웃</Btn>
      </div>
    </div>
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
  const [bank, setBank] = useStorage("angela_bank", INIT_BANK);
  const [exams, setExams] = useStorage("angela_exams", []);
  const [savedPw, setSavedPw] = useStorage("angela_pw", "1111");
  const [students, setStudents] = useStorage("angela_students", {});

  // ── 자동 마이그레이션: 기본 세트가 5문제 이하면 900문제로 교체 ─────────
  useEffect(() => {
    const needsMigration =
      (bank.bp && bank.bp.questions && bank.bp.questions.length < 50) ||
      (bank.vpa && bank.vpa.questions && bank.vpa.questions.length < 50) ||
      (bank.mod && bank.mod.questions && bank.mod.questions.length < 50);

    if (needsMigration) {
      // 사용자가 추가한 다른 세트는 보존, 기본 3세트만 새 데이터로 교체
      const userSets = {};
      Object.entries(bank).forEach(([k, v]) => {
        if (k !== "bp" && k !== "vpa" && k !== "mod") userSets[k] = v;
      });
      setBank({ ...INIT_BANK, ...userSets });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 학생 첫 입장 시 등록
  const enterAsStudent = (name) => {
    setStudents(prev => {
      if (prev[name]) return prev;
      return {
        ...prev,
        [name]: {
          name,
          joinDate: new Date().toISOString().slice(0, 10),
          avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
          grade: "초등5",
          points: 0,
          records: []
        }
      };
    });
    setStudentName(name);
    setMode("student");
  };

  if (mode === "landing") return <Landing onTeacher={() => setMode("teacher-login")} onStudent={() => setMode("student-login")} />;
  if (mode === "teacher-login") return <TeacherLogin savedPw={savedPw} onSuccess={() => setMode("teacher")} onBack={() => setMode("landing")} />;
  if (mode === "student-login") return <StudentLogin onSuccess={enterAsStudent} onBack={() => setMode("landing")} />;
  if (mode === "teacher") return <TeacherApp
    onLogout={() => setMode("landing")}
    bank={bank} setBank={setBank}
    exams={exams} setExams={setExams}
    students={students} setStudents={setStudents}
    savedPw={savedPw} setSavedPw={setSavedPw}
  />;
  if (mode === "student") return <StudentHome
    name={studentName} bank={bank}
    students={students} setStudents={setStudents}
    onLogout={() => setMode("landing")}
  />;
  return null;
}