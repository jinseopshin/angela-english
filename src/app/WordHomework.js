"use client";
import { useState, useMemo, useRef } from "react";
import { T, Btn, Tag, Card, Input } from "./theme";
import { WORD_CATEGORIES, getWordsForGrade } from "./wordData";

// ══════════════════════════════════════════════════════════════════════════
//   📚 단어 숙제 시스템 (WordHomework) — features.js에서 분리
//   - WordHomeworkManager / Print / Banner (UI)
//   - updateWordMastery / getActiveHomeworkWords (헬퍼)
//   - HW_LEVELS / gradeToLevelId (내부 전용)
//   외부 의존: theme, wordData만. (다른 features 함수와 안 얽힘)
// ══════════════════════════════════════════════════════════════════════════

// ── 학년 정보 (단어 추천용 — kinder/elem1/elem2/elem3/middle) ──
const HW_LEVELS = [
  { id: "kinder", label: "유치원", icon: "🌱", desc: "5~6세 기초" },
  { id: "elem1",  label: "초1-2",  icon: "🌿", desc: "쉬운 단어" },
  { id: "elem2",  label: "초3-4",  icon: "🍀", desc: "기본 단어" },
  { id: "elem3",  label: "초5-6",  icon: "🌱", desc: "심화 단어" },
  { id: "middle", label: "중학교", icon: "🌳", desc: "중학 수준" },
];

// ── 학생 학년(grade) → 추천 levelId 매핑 ──
function gradeToLevelId(grade) {
  if (!grade) return "elem1";
  if (grade.includes("유치")) return "kinder";
  if (grade === "초등1" || grade === "초등2") return "elem1";
  if (grade === "초등3" || grade === "초등4") return "elem2";
  if (grade === "초등5" || grade === "초등6") return "elem3";
  if (grade.startsWith("중")) return "middle";
  return "elem1";
}

// ════════════════════════════════════════════════════════════════════
//   1) 선생님: 단어 숙제 관리자
// ════════════════════════════════════════════════════════════════════
export function WordHomeworkManager({ students, setStudents, onNav }) {
  const studentList = Object.values(students || {});
  const [step, setStep] = useState("list"); // list | create | print
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]); // 일괄 배정용
  const [batchMode, setBatchMode] = useState(false);
  const [levelId, setLevelId] = useState("elem1");
  const [catFilter, setCatFilter] = useState("all");
  const [picked, setPicked] = useState({}); // { en: true }
  const [title, setTitle] = useState("");

  // 학생 선택 시 학년에 맞는 추천 레벨 자동 세팅
  const pickStudent = (s) => {
    setSelectedStudent(s.name);
    setSelectedStudents([s.name]);
    setBatchMode(false);
    setLevelId(gradeToLevelId(s.grade));
    setPicked({});
    setTitle(`${s.name} 단어숙제 ${new Date().toISOString().slice(5,10)}`);
    setStep("create");
  };

  // 일괄 모드: 여러 학생 선택 토글
  const toggleStudentInBatch = (name) => {
    setSelectedStudents(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // 일괄 배정 시작
  const startBatch = () => {
    if (selectedStudents.length === 0) { alert("학생을 1명 이상 선택해주세요"); return; }
    // 첫 학생의 학년 기준으로 추천
    const firstGrade = students[selectedStudents[0]]?.grade;
    setLevelId(gradeToLevelId(firstGrade));
    setSelectedStudent(null); // 일괄 모드 표시
    setPicked({});
    setTitle(`단어숙제 ${new Date().toISOString().slice(5,10)}`);
    setStep("create");
  };

  const candidateWords = useMemo(() => {
    const all = getWordsForGrade(levelId);
    return catFilter === "all" ? all : all.filter(w => w.cat === catFilter);
  }, [levelId, catFilter]);

  const pickedCount = Object.values(picked).filter(Boolean).length;
  const togglePick = (en) => setPicked(p => ({ ...p, [en]: !p[en] }));
  const pickAll = () => {
    const next = { ...picked };
    candidateWords.forEach(w => { next[w.en] = true; });
    setPicked(next);
  };
  const clearPick = () => setPicked({});

  // 단어 숙제 저장 (학생에게 배정)
  const saveHomework = () => {
    if (pickedCount === 0) { alert("최소 1개 이상의 단어를 선택해주세요"); return; }
    // 배정 대상: 단일 또는 다수
    const targets = selectedStudent ? [selectedStudent] : selectedStudents;
    if (targets.length === 0) return;

    // 진행중 숙제 있는 학생들 확인
    const hasActive = targets.filter(name => students[name]?.wordHomework?.active);
    if (hasActive.length > 0) {
      if (!confirm(`${hasActive.length}명의 학생에게 이미 진행 중인 숙제가 있습니다.\n(${hasActive.join(", ")})\n덮어쓸까요?`)) return;
    }

    const pickedWords = candidateWords.filter(w => picked[w.en]);
    setStudents(prev => {
      const next = { ...prev };
      targets.forEach(name => {
        if (!next[name]) return;
        const homework = {
          id: "hw_" + Date.now().toString(36) + "_" + name,
          title: title || `${name} 단어숙제`,
          createdAt: new Date().toISOString(),
          levelId,
          words: pickedWords.map(w => ({ en: w.en, ko: w.ko, cat: w.cat, mastered: false, correct: 0, wrong: 0 })),
          active: true,
        };
        next[name] = { ...next[name], wordHomework: homework };
      });
      return next;
    });

    alert(`${targets.length}명에게 ${pickedWords.length}개 단어 숙제를 배정했어요!`);
    setStep("list");
    setSelectedStudent(null);
    setSelectedStudents([]);
    setBatchMode(false);
    setPicked({});
  };

  // 숙제 취소
  const cancelHomework = (studentName) => {
    if (!confirm(`${studentName} 학생의 진행중인 단어 숙제를 취소할까요?`)) return;
    setStudents(prev => {
      const s = prev[studentName];
      if (!s?.wordHomework) return prev;
      return { ...prev, [studentName]: { ...s, wordHomework: { ...s.wordHomework, active: false, canceledAt: new Date().toISOString() } } };
    });
  };

  // ── 화면 0: 직접 입력 ── (사진/타이핑/CSV)
  if (step === "custom") {
    return (
      <CustomWordsInput
        students={students}
        setStudents={setStudents}
        onBack={() => setStep("list")}
        onComplete={() => setStep("list")}
      />
    );
  }

  // ── 화면 1: 학생 목록 ──
  if (step === "list") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>📚 단어 숙제 만들기</div>
            <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>
              {batchMode ? "📋 여러 학생에게 같은 숙제를 한 번에 배정합니다" : "학생을 선택해 학년에 맞는 단어로 숙제를 만드세요"}
            </div>
          </div>
          {studentList.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setStep("custom")} title="교재 단어를 직접 입력" style={{
                background: T.green, color: "white",
                border: "none",
                borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 800,
                cursor: "pointer", whiteSpace: "nowrap"
              }}>
                ✏️ 직접 입력
              </button>
              <button onClick={() => { setBatchMode(b => !b); setSelectedStudents([]); }} style={{
                background: batchMode ? T.purple : T.card,
                color: batchMode ? "white" : T.text,
                border: `1px solid ${batchMode ? T.purple : T.border}`,
                borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 800,
                cursor: "pointer", whiteSpace: "nowrap"
              }}>
                {batchMode ? "✕ 일괄 종료" : "👥 여러 명에게"}
              </button>
            </div>
          )}
        </div>

        {/* 일괄 배정 모드 액션 바 */}
        {batchMode && (
          <div style={{
            background: T.purpleLight, borderRadius: 12, padding: 12, marginTop: 14, marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
          }}>
            <div style={{ fontSize: 12, color: T.text }}>
              <span style={{ fontWeight: 900, color: T.purple, fontSize: 16 }}>{selectedStudents.length}</span>
              <span style={{ fontWeight: 700 }}> / {studentList.length}명 선택됨</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelectedStudents(studentList.map(s => s.name))} style={{
                background: T.card, border: `1px solid ${T.purple}`, borderRadius: 8,
                padding: "4px 10px", fontSize: 11, fontWeight: 700, color: T.purple, cursor: "pointer"
              }}>전체</button>
              <button onClick={() => setSelectedStudents([])} style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "4px 10px", fontSize: 11, fontWeight: 700, color: T.textMid, cursor: "pointer"
              }}>해제</button>
              <button onClick={startBatch} disabled={selectedStudents.length === 0} style={{
                background: selectedStudents.length === 0 ? T.border : T.purple,
                color: "white", border: "none", borderRadius: 8,
                padding: "4px 12px", fontSize: 11, fontWeight: 800,
                cursor: selectedStudents.length === 0 ? "not-allowed" : "pointer"
              }}>다음 →</button>
            </div>
          </div>
        )}

        {studentList.length === 0 ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👶</div>
            <div style={{ fontSize: 13, color: T.textMid }}>먼저 [학생 관리]에서 학생을 등록해주세요.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {studentList.map(s => {
              const hw = s.wordHomework;
              const active = hw?.active;
              const total = hw?.words?.length || 0;
              const done = hw?.words?.filter(w => w.mastered).length || 0;
              const isChecked = selectedStudents.includes(s.name);
              return (
                <div key={s.name}
                  onClick={batchMode ? () => toggleStudentInBatch(s.name) : undefined}
                  style={{
                    background: batchMode && isChecked ? T.purpleLight : T.card,
                    border: `${batchMode && isChecked ? 2 : 1}px solid ${batchMode && isChecked ? T.purple : T.border}`,
                    borderRadius: 14, padding: 14,
                    cursor: batchMode ? "pointer" : "default",
                    transition: "all 0.12s"
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: active && !batchMode ? 10 : 0 }}>
                    {batchMode && (
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `2px solid ${isChecked ? T.purple : T.border}`,
                        background: isChecked ? T.purple : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 14, fontWeight: 900
                      }}>{isChecked && "✓"}</div>
                    )}
                    <div style={{ fontSize: 26 }}>{s.avatar || "🙂"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: T.textMid }}>
                        {s.grade || "학년 미지정"}
                        {active && <span style={{ marginLeft: 8, color: T.green, fontWeight: 700 }}>· 진행중 {done}/{total}</span>}
                      </div>
                    </div>
                    {!batchMode && !active && (
                      <button onClick={() => pickStudent(s)} style={{
                        background: T.accent, color: "white", border: "none", borderRadius: 10,
                        padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer"
                      }}>+ 숙제 만들기</button>
                    )}
                  </div>
                  {!batchMode && active && (
                    <div style={{ background: T.greenLight, borderRadius: 10, padding: 10, fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontWeight: 800, color: T.text }}>📖 진행중: {hw.title}</div>
                        <div style={{ fontWeight: 800, color: T.green }}>{done}/{total}</div>
                      </div>
                      <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${total ? (done/total*100) : 0}%`, height: "100%", background: T.green }} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setSelectedStudent(s.name); setStep("print"); }}
                          style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>
                          🖨️ 단어장 인쇄
                        </button>
                        <button onClick={() => cancelHomework(s.name)}
                          style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.red }}>
                          숙제 취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 화면 2: 단어 선택 ──
  if (step === "create") {
    const isBatch = !selectedStudent && selectedStudents.length > 0;
    const stu = students[selectedStudent];
    const categories = ["all", ...Array.from(new Set(getWordsForGrade(levelId).map(w => w.cat)))];

    return (
      <div>
        <button onClick={() => setStep("list")} style={{
          background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700,
          padding: "4px 0", marginBottom: 10, cursor: "pointer"
        }}>← 학생 목록으로</button>

        {isBatch ? (
          <div style={{ background: T.purpleLight, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 30 }}>👥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>일괄 배정: {selectedStudents.length}명</div>
                <div style={{ fontSize: 11, color: T.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedStudents.join(", ")}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: T.accentLight, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 30 }}>{stu?.avatar || "🙂"}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{selectedStudent}</div>
                <div style={{ fontSize: 11, color: T.textMid }}>{stu?.grade} · 추천: {HW_LEVELS.find(l => l.id === levelId)?.label}</div>
              </div>
            </div>
          </div>
        )}

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="숙제 이름 (예: 동물 단어 외우기)"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`,
            fontSize: 13, marginBottom: 12, background: T.card, color: T.text }} />

        {/* 학년 선택 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 6 }}>📚 학년 수준</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {HW_LEVELS.map(l => (
            <button key={l.id} onClick={() => { setLevelId(l.id); setPicked({}); }}
              style={{
                background: levelId === l.id ? T.accent : T.card,
                color: levelId === l.id ? "white" : T.text,
                border: `1px solid ${levelId === l.id ? T.accent : T.border}`,
                borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4
              }}>
              <span>{l.icon}</span><span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 6 }}>🏷️ 카테고리</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              style={{
                background: catFilter === c ? T.purple : T.card,
                color: catFilter === c ? "white" : T.text,
                border: `1px solid ${catFilter === c ? T.purple : T.border}`,
                borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer"
              }}>
              {c === "all" ? "전체" : `${WORD_CATEGORIES[c]?.icon || ""} ${c}`}
            </button>
          ))}
        </div>

        {/* 선택 컨트롤 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, color: T.textMid }}>
            <span style={{ fontWeight: 900, color: T.accent, fontSize: 14 }}>{pickedCount}</span>
            <span> / {candidateWords.length}개 선택</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={pickAll} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>전체</button>
            <button onClick={clearPick} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.textMid }}>해제</button>
          </div>
        </div>

        {/* 단어 그리드 */}
        <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 14, padding: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
            {candidateWords.map(w => {
              const isPicked = !!picked[w.en];
              return (
                <button key={w.en} onClick={() => togglePick(w.en)}
                  style={{
                    background: isPicked ? T.accentLight : T.card,
                    border: `2px solid ${isPicked ? T.accent : T.border}`,
                    borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.1s"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{w.en}</div>
                    {isPicked && <span style={{ fontSize: 14 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{w.ko}</div>
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={saveHomework} disabled={pickedCount === 0}
          style={{
            width: "100%", background: pickedCount === 0 ? T.border : T.green, color: "white",
            border: "none", borderRadius: 12, padding: "14px 16px",
            fontSize: 15, fontWeight: 900, cursor: pickedCount === 0 ? "not-allowed" : "pointer"
          }}>
          📬 {(!selectedStudent && selectedStudents.length > 0) ? `${selectedStudents.length}명에게` : `${selectedStudent}에게`} {pickedCount}개 단어 숙제로 배정하기
        </button>
      </div>
    );
  }

  // ── 화면 3: 인쇄 ──
  if (step === "print") {
    return <WordHomeworkPrint student={students[selectedStudent]} onBack={() => setStep("list")} />;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════
//   1.5) 단어 직접 입력 컴포넌트 (사진 OCR / 타이핑 / CSV)
// ════════════════════════════════════════════════════════════════════
function CustomWordsInput({ students, setStudents, onBack, onComplete }) {
  const studentList = Object.values(students || {});
  const [mode, setMode] = useState("type"); // "type" | "photo" | "csv"
  const [textbook, setTextbook] = useState("");
  const [unit, setUnit] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [aiMode, setAiMode] = useState(false); // 영어만 입력, AI가 한글 채움
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const ttsAvailable = typeof window !== "undefined" && !!window.speechSynthesis;

  // 자동 제목 생성
  const autoTitle = useMemo(() => {
    const tb = textbook.trim();
    const ut = unit.trim();
    if (tb && ut) return `${tb} ${ut}`;
    if (tb) return tb;
    if (ut) return ut;
    return `단어 숙제 ${new Date().toISOString().slice(5,10)}`;
  }, [textbook, unit]);

  // ── 똑똑한 파서: apple 사과 / apple,사과 / apple - 사과 / apple: 사과 모두 인식 ──
  const parsedWords = useMemo(() => {
    if (!rawInput.trim()) return [];
    const lines = rawInput.split(/\r?\n/);
    const seen = new Set();
    const out = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // 영어와 한글 분리 패턴
      // 1) 영어(공백,쉼표,탭,콜론,대시) 한글
      const match = trimmed.match(/^([A-Za-z][A-Za-z\s'\-]*?)[\s,	:\-=|]+(.+)$/);
      let en, ko;
      if (match) {
        en = match[1].trim().toLowerCase();
        ko = match[2].trim();
      } else if (/^[A-Za-z][A-Za-z\s'\-]*$/.test(trimmed)) {
        // 영어만 있는 경우 (AI가 채울 예정)
        en = trimmed.toLowerCase();
        ko = "";
      } else {
        // 인식 불가 — 그래도 통째로 영어로 시도
        en = trimmed.toLowerCase();
        ko = "";
      }
      if (!en || seen.has(en)) {
        if (en && seen.has(en)) {
          // 중복 표시는 결과에 반영
          out.push({ en, ko, duplicate: true });
        }
        return;
      }
      seen.add(en);
      out.push({ en, ko, duplicate: false });
    });
    return out;
  }, [rawInput]);

  const validCount = parsedWords.filter(w => !w.duplicate && w.en).length;
  const dupCount = parsedWords.filter(w => w.duplicate).length;
  const noKoCount = parsedWords.filter(w => !w.duplicate && w.en && !w.ko).length;

  // ── TTS 발음 듣기 ──
  const speakWord = (word) => {
    if (!ttsAvailable || !word) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = "en-US";
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("TTS 에러:", e);
    }
  };

  // ── CSV 업로드 처리 ──
  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result || "";
      // BOM 제거
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      setRawInput(prev => (prev.trim() ? prev + "\n" : "") + text);
      setError("");
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // ── 사진 OCR 처리 ──
  const handlePhotoFile = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 파일 정보를 미리 배열로 복사 (e.target.value 초기화 전에)
    const fileList = Array.from(files);

    setBusy(true);
    setError("");
    setBusyMsg(`사진 분석 준비 중... 📸`);

    try {
      let allWords = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setBusyMsg(`사진 ${i+1}/${fileList.length} 분석 중... 📸 (${file.name})`);
        const base64 = await fileToBase64(file);
        const mediaType = file.type || "image/jpeg";

        const res = await fetch("/api/extract-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `사진 ${i+1} 분석 실패 (${res.status})`);
        }
        const data = await res.json();
        if (data.words && Array.isArray(data.words)) {
          allWords = allWords.concat(data.words);
        }
      }

      if (allWords.length === 0) {
        setError("사진에서 단어를 찾지 못했어요. 다른 사진을 시도해주세요.");
      } else {
        // 기존 입력에 추가
        const lines = allWords.map(w => `${w.en} ${w.ko || ""}`.trim()).join("\n");
        setRawInput(prev => (prev.trim() ? prev + "\n" : "") + lines);
        setBusyMsg(`✅ ${allWords.length}개 단어 추출 완료!`);
        setTimeout(() => setBusyMsg(""), 2000);
      }
    } catch (err) {
      console.error("사진 분석 에러:", err);
      setError(err.message || "사진 분석 중 오류");
    } finally {
      setBusy(false);
      // 같은 파일 다시 선택 가능하도록 (모든 처리 끝난 후)
      if (e.target) {
        try { e.target.value = ""; } catch (e2) { /* ignore */ }
      }
    }
  };

  // ── 영어만 입력된 단어들에 대해 AI로 한글 뜻 자동 생성 ──
  const runAiFillKorean = async () => {
    const targetWords = parsedWords.filter(w => !w.duplicate && w.en && !w.ko).map(w => w.en);
    if (targetWords.length === 0) {
      setError("한글 뜻이 비어있는 영어 단어가 없습니다.");
      return;
    }
    setBusy(true);
    setBusyMsg(`AI가 ${targetWords.length}개 단어의 한글 뜻을 작성 중... ✨`);
    setError("");
    try {
      const res = await fetch("/api/translate-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: targetWords }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `번역 실패 (${res.status})`);
      }
      const data = await res.json();
      const dict = {};
      (data.translations || []).forEach(t => { dict[t.en.toLowerCase()] = t.ko; });

      // rawInput을 다시 작성: 영어만인 줄에 한글 채우기
      const newLines = rawInput.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        // 이미 한글이 있으면 그대로
        if (/[가-힣]/.test(trimmed)) return line;
        // 영어만인 라인이면 한글 추가
        if (/^[A-Za-z][A-Za-z\s'\-]*$/.test(trimmed)) {
          const en = trimmed.toLowerCase();
          if (dict[en]) return `${trimmed} ${dict[en]}`;
        }
        return line;
      });
      setRawInput(newLines.join("\n"));
      setBusyMsg(`✅ ${Object.keys(dict).length}개 단어 한글 뜻 채웠어요!`);
      setTimeout(() => setBusyMsg(""), 2000);
    } catch (err) {
      setError(err.message || "AI 번역 중 오류");
    } finally {
      setBusy(false);
    }
  };

  // ── 학생 선택 토글 ──
  const toggleStudent = (name) => {
    setSelectedStudents(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // ── 숙제 배정 ──
  const saveHomework = () => {
    const validWords = parsedWords.filter(w => !w.duplicate && w.en && w.ko);
    if (validWords.length === 0) {
      setError("단어 1개 이상 (영어+한글) 입력해주세요");
      return;
    }
    if (selectedStudents.length === 0) {
      setError("학생을 1명 이상 선택해주세요");
      return;
    }

    // 진행 중인 숙제 확인
    const hasActive = selectedStudents.filter(name => students[name]?.wordHomework?.active);
    if (hasActive.length > 0) {
      if (!confirm(`${hasActive.length}명의 학생에게 이미 진행 중인 숙제가 있습니다.\n(${hasActive.join(", ")})\n덮어쓸까요?`)) return;
    }

    setStudents(prev => {
      const next = { ...prev };
      selectedStudents.forEach(name => {
        if (!next[name]) return;
        const homework = {
          id: "hw_" + Date.now().toString(36) + "_" + name,
          title: autoTitle,
          createdAt: new Date().toISOString(),
          levelId: "custom",
          words: validWords.map(w => ({ en: w.en, ko: w.ko, cat: "교재", mastered: false, correct: 0, wrong: 0 })),
          active: true,
          source: "custom",
          textbook: textbook.trim() || null,
          unit: unit.trim() || null,
        };
        next[name] = { ...next[name], wordHomework: homework };
      });
      return next;
    });

    alert(`${selectedStudents.length}명에게 ${validWords.length}개 단어 숙제를 배정했어요!`);
    onComplete();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>✏️ 단어 직접 입력</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>교재의 단어를 직접 입력하거나 사진으로 추출하세요</div>
        </div>
      </div>

      {/* 입력 방식 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.card, padding: 5, borderRadius: 12, boxShadow: T.shadow }}>
        {[
          { id: "type",  label: "📝 타이핑" },
          { id: "photo", label: "📷 사진" },
          { id: "csv",   label: "📥 엑셀/CSV" },
        ].map(t => (
          <button key={t.id} onClick={() => setMode(t.id)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 800,
            background: mode === t.id ? T.green : "transparent",
            color: mode === t.id ? "white" : T.textMid
          }}>{t.label}</button>
        ))}
      </div>

      {/* 교재/단원 정보 (제목 자동 채움) */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.textMid, marginBottom: 8 }}>📖 교재 정보 (선택, 자동 제목 생성)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={textbook}
            onChange={e => setTextbook(e.target.value)}
            placeholder="교재명 (예: LookBack Lv5)"
            style={{
              flex: "1 1 200px", padding: "8px 10px", borderRadius: 8,
              border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none",
              boxSizing: "border-box"
            }}
          />
          <input
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="단원 (예: Unit 3)"
            style={{
              flex: "1 1 140px", padding: "8px 10px", borderRadius: 8,
              border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
          → 자동 제목: <strong style={{ color: T.accent }}>{autoTitle}</strong>
        </div>
      </div>

      {/* 모드별 입력 영역 */}
      {mode === "type" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textMid }}>📝 한 줄에 하나씩 입력</div>
            <div style={{ fontSize: 10, color: T.textDim }}>
              형식 자유: apple 사과 / apple,사과 / apple-사과 / apple: 사과
            </div>
          </div>
          <textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={"apple 사과\nbanana 바나나\ncat 고양이\ndog 개\n...\n\n💡 영어만 입력하고 [AI로 한글 채우기] 버튼을 사용해도 됩니다"}
            rows={12}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "monospace",
              resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6
            }}
          />
        </div>
      )}

      {mode === "photo" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.text, fontWeight: 700, marginBottom: 8 }}>
            📷 교재 사진에서 단어 자동 추출
          </div>
          <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6, marginBottom: 12 }}>
            교재 페이지를 사진으로 찍거나 캡처 이미지를 올리면 AI가 영단어와 한글 뜻을 자동으로 추출해요.
            <br/>여러 장 한 번에 선택 가능합니다.
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoFile}
            style={{ display: "none" }}
          />
          <button onClick={() => photoInputRef.current?.click()} disabled={busy}
            style={{
              width: "100%", background: busy ? T.border : T.accent,
              color: "white", border: "none", borderRadius: 10,
              padding: "14px", fontSize: 14, fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer"
            }}>
            📷 사진 선택 (여러 장 가능)
          </button>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 8, textAlign: "center" }}>
            아래 입력란에 추출 결과가 자동으로 채워져요
          </div>

          {/* 추출 결과 + 편집 영역 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textMid, marginBottom: 6 }}>📋 추출된 단어 (편집 가능)</div>
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="사진 분석 후 여기에 단어가 자동으로 채워져요..."
              rows={10}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "monospace",
                resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6
              }}
            />
          </div>
        </div>
      )}

      {mode === "csv" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.text, fontWeight: 700, marginBottom: 8 }}>
            📥 엑셀/CSV 파일 업로드
          </div>
          <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6, marginBottom: 12 }}>
            엑셀에서 <strong>A열: 영어, B열: 한글</strong>로 입력 후 CSV로 저장하거나, <br/>
            메모장에서 한 줄에 하나씩 입력한 .txt/.csv 파일도 가능해요.
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={handleCsvFile}
            style={{ display: "none" }}
          />
          <button onClick={() => csvInputRef.current?.click()}
            style={{
              width: "100%", background: T.accent,
              color: "white", border: "none", borderRadius: 10,
              padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer"
            }}>
            📂 CSV/TXT 파일 선택
          </button>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textMid, marginBottom: 6 }}>📋 단어 (편집 가능)</div>
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="apple,사과&#10;banana,바나나&#10;..."
              rows={10}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "monospace",
                resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6
              }}
            />
          </div>
        </div>
      )}

      {/* 진행 중 메시지 */}
      {busy && (
        <div style={{
          background: T.accentLight, color: T.accent,
          padding: "10px 14px", borderRadius: 10, marginBottom: 10,
          fontSize: 12, fontWeight: 700, textAlign: "center"
        }}>
          {busyMsg || "처리 중..."}
        </div>
      )}
      {!busy && busyMsg && (
        <div style={{
          background: T.greenLight, color: T.green,
          padding: "10px 14px", borderRadius: 10, marginBottom: 10,
          fontSize: 12, fontWeight: 700, textAlign: "center"
        }}>{busyMsg}</div>
      )}
      {error && (
        <div style={{
          background: T.redLight, color: T.red,
          padding: "10px 14px", borderRadius: 10, marginBottom: 10,
          fontSize: 12, fontWeight: 700, textAlign: "center"
        }}>⚠️ {error}</div>
      )}

      {/* 미리보기 + 통계 */}
      {parsedWords.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
              👀 미리보기 ({validCount}개)
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {dupCount > 0 && (
                <span style={{ background: T.yellowLight, color: T.orange, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                  ⚠️ 중복 {dupCount}
                </span>
              )}
              {noKoCount > 0 && (
                <button onClick={runAiFillKorean} disabled={busy} style={{
                  background: busy ? T.border : T.purple, color: "white",
                  border: "none", borderRadius: 6, padding: "3px 10px",
                  fontSize: 10, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer"
                }}>
                  ✨ AI로 한글 채우기 ({noKoCount}개)
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ background: T.bg, position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 30 }}>#</th>
                  <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>English</th>
                  <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>한글</th>
                  {ttsAvailable && <th style={{ padding: 6, width: 40, borderBottom: `1px solid ${T.border}` }}>🔊</th>}
                </tr>
              </thead>
              <tbody>
                {parsedWords.map((w, i) => (
                  <tr key={i} style={{
                    background: w.duplicate ? T.yellowLight : !w.ko ? T.purpleLight : "transparent",
                    borderBottom: `1px solid ${T.border}`
                  }}>
                    <td style={{ padding: 6, color: T.textDim, fontSize: 10 }}>
                      {w.duplicate ? "⚠️" : i+1}
                    </td>
                    <td style={{ padding: 6, fontWeight: 700, color: T.text }}>{w.en}</td>
                    <td style={{ padding: 6, color: w.ko ? T.text : T.textDim, fontStyle: w.ko ? "normal" : "italic" }}>
                      {w.ko || "(AI가 채울 예정)"}
                    </td>
                    {ttsAvailable && (
                      <td style={{ padding: 6, textAlign: "center" }}>
                        <button onClick={() => speakWord(w.en)} title="발음 듣기" style={{
                          background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0
                        }}>🔊</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 학생 선택 */}
      {studentList.length > 0 && parsedWords.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
              👥 배정 대상 학생 ({selectedStudents.length}/{studentList.length})
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelectedStudents(studentList.map(s => s.name))} style={{
                background: T.accentLight, color: T.accent, border: "none", borderRadius: 6,
                padding: "3px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer"
              }}>전체</button>
              <button onClick={() => setSelectedStudents([])} style={{
                background: T.bg, color: T.textMid, border: "none", borderRadius: 6,
                padding: "3px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer"
              }}>해제</button>
            </div>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 6, maxHeight: 200, overflowY: "auto"
          }}>
            {studentList.map(s => {
              const checked = selectedStudents.includes(s.name);
              const hasActive = s.wordHomework?.active;
              return (
                <button key={s.name} onClick={() => toggleStudent(s.name)} style={{
                  background: checked ? T.green + "22" : T.bg,
                  border: `2px solid ${checked ? T.green : T.border}`,
                  borderRadius: 10, padding: "8px 6px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 700, color: T.text,
                  textAlign: "left",
                  position: "relative"
                }}>
                  <span style={{ fontSize: 18 }}>{s.avatar || "🙂"}</span>
                  <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </div>
                  {hasActive && (
                    <span title="진행 중인 숙제 있음" style={{
                      position: "absolute", top: 2, right: 4,
                      fontSize: 9, color: T.orange
                    }}>📚</span>
                  )}
                  {checked && (
                    <span style={{ color: T.green, fontWeight: 900 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 배정 버튼 */}
      <button onClick={saveHomework}
        disabled={busy || validCount === 0 || selectedStudents.length === 0 || noKoCount > 0}
        style={{
          width: "100%",
          background: (busy || validCount === 0 || selectedStudents.length === 0 || noKoCount > 0) ? T.border : T.green,
          color: "white", border: "none", borderRadius: 12,
          padding: 16, fontSize: 14, fontWeight: 900,
          cursor: (busy || validCount === 0 || selectedStudents.length === 0 || noKoCount > 0) ? "not-allowed" : "pointer"
        }}>
        {noKoCount > 0 ? `먼저 [AI로 한글 채우기]를 눌러주세요 (${noKoCount}개 미완성)`
          : validCount === 0 ? "단어를 입력해주세요"
          : selectedStudents.length === 0 ? "학생을 선택해주세요"
          : `✨ ${selectedStudents.length}명에게 ${validCount}개 단어 숙제 배정하기`}
      </button>
    </div>
  );
}

// 파일 → base64 변환 (data: URL prefix 제거)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      // "data:image/jpeg;base64,XXXX" → "XXXX"만 추출
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════════════════════
//   2) 단어장 인쇄 컴포넌트 (A4 형식)
// ════════════════════════════════════════════════════════════════════
export function WordHomeworkPrint({ student, onBack }) {
  const hw = student?.wordHomework;
  if (!hw || !hw.words) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: T.textMid }}>
        진행중인 단어 숙제가 없어요.
        <div style={{ marginTop: 16 }}>
          <button onClick={onBack} style={{ background: T.accent, color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>← 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.text }}>← 돌아가기</button>
        <button onClick={() => window.print()} style={{ flex: 1, background: T.accent, color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
          🖨️ 단어장 인쇄하기
        </button>
      </div>

      <div className="exam-print-body" style={{ background: "white", padding: "24px 22px", borderRadius: 8, boxShadow: T.shadow, color: "#222" }}>
        {/* 헤더 */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📚 {hw.title}</div>
          <div style={{ fontSize: 11, color: "#666" }}>
            이름: <span style={{ borderBottom: "1px solid #999", padding: "0 30px" }}>{student.name}</span>
            <span style={{ margin: "0 14px" }}>·</span>
            날짜: <span style={{ borderBottom: "1px solid #999", padding: "0 40px" }}>{hw.createdAt?.slice(0, 10)}</span>
          </div>
        </div>

        {/* 단어 목록 - 단어장 형식 */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333" }}>
              <th style={{ padding: "8px 4px", width: 40, textAlign: "center" }}>#</th>
              <th style={{ padding: "8px 6px", textAlign: "left" }}>English</th>
              <th style={{ padding: "8px 6px", textAlign: "left" }}>한글 뜻</th>
              <th style={{ padding: "8px 6px", width: 70, textAlign: "center" }}>분류</th>
              <th style={{ padding: "8px 4px", width: 60, textAlign: "center" }}>체크</th>
            </tr>
          </thead>
          <tbody>
            {hw.words.map((w, i) => (
              <tr key={w.en} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "6px 4px", textAlign: "center", color: "#888" }}>{i + 1}</td>
                <td style={{ padding: "6px 6px", fontWeight: 700 }}>{w.en}</td>
                <td style={{ padding: "6px 6px" }}>{w.ko}</td>
                <td style={{ padding: "6px 6px", textAlign: "center", fontSize: 11, color: "#666" }}>{w.cat}</td>
                <td style={{ padding: "6px 4px", textAlign: "center" }}>
                  <span style={{ display: "inline-block", width: 18, height: 18, border: "1.5px solid #888", borderRadius: 3 }}></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 18, fontSize: 11, color: "#888", textAlign: "right" }}>
          Angela's English Academy · 단어장
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//   3) 학생 홈 화면: 진행중 단어 숙제 배너
// ════════════════════════════════════════════════════════════════════
export function WordHomeworkBanner({ student, onStart }) {
  const hw = student?.wordHomework;
  if (!hw?.active || !hw.words?.length) return null;

  const total = hw.words.length;
  const done = hw.words.filter(w => w.mastered).length;
  const progress = total ? Math.round(done / total * 100) : 0;
  const allDone = done === total;

  return (
    <div style={{
      background: allDone
        ? `linear-gradient(135deg, ${T.green} 0%, ${T.accent} 100%)`
        : `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
      borderRadius: 14, padding: 14, marginBottom: 14, color: "white",
      boxShadow: T.shadow
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 30 }}>{allDone ? "🎉" : "📚"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>{allDone ? "단어 숙제 완료!" : "선생님이 내준 단어 숙제"}</div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>{hw.title}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{done}/{total}</div>
          <div style={{ fontSize: 9, opacity: 0.9 }}>마스터</div>
        </div>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.25)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "white", transition: "width 0.4s" }} />
      </div>
      <button onClick={onStart} style={{
        width: "100%", background: "white", color: T.accent,
        border: "none", borderRadius: 10, padding: "10px 14px",
        fontSize: 13, fontWeight: 900, cursor: "pointer"
      }}>
        {allDone ? "🏆 한번 더 도전하기" : "▶️ 숙제 단어로 게임 시작"}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//   4) 단어 마스터 진도 업데이트 헬퍼
//   게임에서 정답/오답 시 호출 — 3번 연속 맞추면 마스터로 처리
// ════════════════════════════════════════════════════════════════════
export function updateWordMastery(setStudents, studentName, wordEn, isCorrect) {
  setStudents(prev => {
    const s = prev[studentName];
    if (!s?.wordHomework?.active) return prev;
    const words = s.wordHomework.words.map(w => {
      if (w.en !== wordEn) return w;
      if (isCorrect) {
        const correct = (w.correct || 0) + 1;
        // 3번 누적 정답 시 마스터
        return { ...w, correct, mastered: correct >= 3 };
      } else {
        return { ...w, wrong: (w.wrong || 0) + 1, correct: 0 }; // 틀리면 카운터 리셋
      }
    });
    return { ...prev, [studentName]: { ...s, wordHomework: { ...s.wordHomework, words } } };
  });
}

// 활성 숙제의 미마스터 단어들만 반환 (학생 게임용)
export function getActiveHomeworkWords(student) {
  const hw = student?.wordHomework;
  if (!hw?.active || !hw.words?.length) return null;
  const notMastered = hw.words.filter(w => !w.mastered);
  // 마스터되지 않은 단어가 있으면 그것만, 모두 마스터했으면 전체 단어 복습
  return notMastered.length > 0 ? notMastered : hw.words;
}
