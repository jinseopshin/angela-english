"use client";
import { useState } from "react";
import { T, Btn, Card } from "./theme";
import { saveSentence, DIFFICULTY_LABELS } from "./sentenceBuilderData";
import { playClick } from "./soundEffects";

// ══════════════════════════════════════════════════════════════════════════
//   🤖 AISentenceGenerator.js — AI 문장 자동 생성
//   - 장르 선택 → 학년/난이도 → 개수 → AI가 즉시 생성
//   - 결과 미리보기 → 선택해서 저장
// ══════════════════════════════════════════════════════════════════════════

const TOPIC_PRESETS = [
  { icon: "🐶", label: "동물", value: "동물에 관한 문장" },
  { icon: "🍎", label: "음식", value: "음식에 관한 문장" },
  { icon: "👋", label: "인사", value: "인사 표현" },
  { icon: "🌞", label: "날씨", value: "날씨에 관한 문장" },
  { icon: "🎒", label: "학교", value: "학교생활 표현" },
  { icon: "⚽", label: "취미", value: "취미와 운동" },
  { icon: "🏠", label: "가족", value: "가족과 집" },
  { icon: "💖", label: "감정", value: "감정 표현" },
  { icon: "✏️", label: "직업", value: "직업과 일" },
  { icon: "🎨", label: "색깔", value: "색깔에 관한 문장" },
  { icon: "🔢", label: "숫자", value: "숫자와 시간" },
  { icon: "🚗", label: "교통", value: "교통수단" },
];

const GRADES = ["유치원","초등1","초등2","초등3","초등4","초등5","초등6","중1","중2","중3"];

// 단어 자동 분리 (서버에서 받지만 검증용)
function splitToWords(sentence) {
  if (!sentence) return [];
  return sentence.trim().split(/\s+/).filter(w => w.length > 0);
}

export function AISentenceGenerator({ onExit, onSaved }) {
  const [step, setStep] = useState("config"); // config | generating | preview | done

  // 설정
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("초등3");
  const [difficulty, setDifficulty] = useState("easy");
  const [count, setCount] = useState(5);
  const [extraNote, setExtraNote] = useState("");

  // 결과
  const [generated, setGenerated] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(new Set());
  const [editedItems, setEditedItems] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const generate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요"); return; }
    setError("");
    setStep("generating");
    setProgress("서버에 요청 중...");

    try {
      setProgress("AI가 문장을 만드는 중... ✍️");
      const res = await fetch("/api/generate-sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          grade,
          difficulty,
          count,
          extraNote: extraNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);

      const sentences = data.sentences || [];
      if (sentences.length === 0) {
        setError("생성된 문장이 없어요. 주제를 바꿔서 다시 시도해주세요.");
        setStep("config");
        return;
      }

      setGenerated(sentences);
      setEditedItems(sentences.map(s => ({ ...s })));
      // 기본: 모두 선택
      setSelectedIdx(new Set(sentences.map((_, i) => i)));
      setStep("preview");
    } catch (e) {
      setError("오류: " + e.message);
      setStep("config");
    }
  };

  const toggleSelect = (idx) => {
    setSelectedIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIdx(new Set(editedItems.map((_, i) => i)));
  };
  const deselectAll = () => {
    setSelectedIdx(new Set());
  };

  const updateItem = (idx, field, value) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: value };
      // 영어 수정 시 단어 자동 재분리
      if (field === "english") {
        next.words = splitToWords(value);
      }
      return next;
    }));
  };

  const saveSelected = () => {
    const toSave = editedItems.filter((_, i) => selectedIdx.has(i));
    if (toSave.length === 0) {
      setError("저장할 문장을 선택해주세요");
      return;
    }
    let saved = 0;
    toSave.forEach(item => {
      const result = saveSentence({
        english: item.english,
        korean: item.korean,
        difficulty: item.difficulty || difficulty,
        imageUrl: null,
        isPublic,
      });
      if (result) saved++;
    });
    setSavedCount(saved);
    setStep("done");
    if (onSaved) onSaved(saved);
  };

  // ── 완료 화면 ──
  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 8 }}>
          {savedCount}개 문장 저장 완료!
        </div>
        <div style={{ fontSize: 13, color: T.textMid, marginBottom: 24 }}>
          {isPublic ? "🌐 모든 학생이 풀 수 있어요" : "선생님 전용으로 저장됐어요"}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn v="secondary" size="lg" onClick={() => {
            setStep("config");
            setGenerated([]);
            setEditedItems([]);
            setSelectedIdx(new Set());
            setTopic("");
            setSavedCount(0);
          }}>
            🔄 다시 생성
          </Btn>
          <Btn v="primary" size="lg" onClick={onExit}>문장 목록으로</Btn>
        </div>
      </div>
    );
  }

  // ── 생성 중 화면 ──
  if (step === "generating") {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginBottom: 8 }}>
          AI가 문장을 만들고 있어요
        </div>
        <div style={{ fontSize: 13, color: T.textMid, marginBottom: 24 }}>{progress}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: "50%", background: T.accent,
              animation: `bounce 1s ease-in-out ${i * 0.2}s infinite alternate`,
            }} />
          ))}
        </div>
        <style>{`@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-12px)}}`}</style>
      </div>
    );
  }

  // ── 미리보기 & 편집 화면 ──
  if (step === "preview") {
    const selectedCount = selectedIdx.size;
    return (
      <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Btn v="ghost" size="sm" onClick={() => setStep("config")}>← 재설정</Btn>
          <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>
            ✍️ AI 생성 결과 ({editedItems.length}개)
          </div>
        </div>

        {/* 저장 옵션 */}
        <Card style={{ marginBottom: 14, background: T.greenLight, border: `1.5px solid ${T.green}30`, padding: 14 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer"
          }}>
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                🌐 공개 문장으로 저장
              </div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
                체크하면 모든 학생이 풀 수 있어요
              </div>
            </div>
          </label>
        </Card>

        {/* 전체 선택/해제 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>
            ✅ 선택됨: <strong style={{ color: T.accent }}>{selectedCount}</strong> / {editedItems.length}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={selectAll} style={{
              background: T.accentLight, color: T.accent, border: "none",
              borderRadius: T.radiusSm, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>전체 선택</button>
            <button onClick={deselectAll} style={{
              background: T.bg, color: T.textMid, border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>전체 해제</button>
          </div>
        </div>

        {/* 문장 카드들 */}
        {editedItems.map((item, idx) => {
          const isSelected = selectedIdx.has(idx);
          const diffInfo = DIFFICULTY_LABELS[item.difficulty || difficulty] || DIFFICULTY_LABELS.easy;
          return (
            <Card key={idx} style={{
              marginBottom: 10,
              border: `2px solid ${isSelected ? T.accent : T.border}`,
              background: isSelected ? T.card : T.bgSoft,
              opacity: isSelected ? 1 : 0.6,
              transition: "all 0.15s"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* 체크박스 */}
                <button onClick={() => toggleSelect(idx)} style={{
                  width: 26, height: 26, borderRadius: T.radiusSm, border: "none",
                  background: isSelected ? T.accent : T.border,
                  color: "white", fontSize: 14, fontWeight: 900,
                  cursor: "pointer", flexShrink: 0, marginTop: 2
                }}>
                  {isSelected ? "✓" : ""}
                </button>

                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 영어 */}
                  <input
                    value={item.english}
                    onChange={e => updateItem(idx, "english", e.target.value)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "7px 10px", borderRadius: T.radiusSm,
                      border: `1px solid ${T.border}`,
                      fontSize: 14, fontWeight: 700, color: T.text,
                      marginBottom: 5, outline: "none"
                    }}
                  />
                  {/* 한글 */}
                  <input
                    value={item.korean}
                    onChange={e => updateItem(idx, "korean", e.target.value)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "6px 10px", borderRadius: T.radiusSm,
                      border: `1px solid ${T.border}`,
                      fontSize: 12, color: T.textMid,
                      marginBottom: 6, outline: "none"
                    }}
                  />

                  {/* 단어 미리보기 + 난이도 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <select
                      value={item.difficulty || difficulty}
                      onChange={e => updateItem(idx, "difficulty", e.target.value)}
                      style={{
                        padding: "3px 8px", borderRadius: 8,
                        border: `1px solid ${diffInfo.color}`,
                        background: diffInfo.bg, color: diffInfo.color,
                        fontSize: 10, fontWeight: 700, cursor: "pointer"
                      }}>
                      <option value="easy">쉬움</option>
                      <option value="medium">보통</option>
                      <option value="hard">어려움</option>
                    </select>
                    <div style={{
                      flex: 1, display: "flex", flexWrap: "wrap", gap: 3, fontFamily: "monospace"
                    }}>
                      {item.words?.map((w, wi) => (
                        <span key={wi} style={{
                          padding: "1px 6px", background: T.accentLight, color: T.accent,
                          borderRadius: 4, fontSize: 10
                        }}>{w}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {error && (
          <div style={{
            padding: "10px 14px", background: T.redLight, borderRadius: T.radiusSm,
            marginBottom: 10, fontSize: 12, color: T.red, fontWeight: 700
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Btn v="secondary" size="md" onClick={generate} style={{ flex: 1 }}>🔄 재생성</Btn>
          <Btn v="success" size="md" onClick={saveSelected} style={{ flex: 2 }}
            disabled={selectedCount === 0}>
            ✅ 선택한 {selectedCount}개 저장
          </Btn>
        </div>
      </div>
    );
  }

  // ── 설정 화면 ──
  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 뒤로</Btn>
        <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>
          🤖 AI 문장 자동 생성
        </div>
      </div>

      {/* 설명 배너 */}
      <div style={{
        background: `linear-gradient(135deg,${T.purple},${T.accent})`,
        borderRadius: T.radius, padding: "14px 16px", color: "white", marginBottom: 16
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
          ✨ Claude AI가 학습 문장을 만들어드려요
        </div>
        <div style={{ fontSize: 12, opacity: .9, lineHeight: 1.6 }}>
          주제와 난이도를 선택하면 → AI가 문장 생성 → 검토 후 저장!
        </div>
      </div>

      <Card style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>
          📝 문장 생성 설정
        </div>

        {/* 주제 입력 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
            주제 / 상황 *
          </div>
          <input
            value={topic}
            onChange={e => { setTopic(e.target.value); setError(""); }}
            placeholder="예: 동물에 관한 문장, 인사 표현..."
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px", borderRadius: T.radiusSm,
              border: `1.5px solid ${error && !topic.trim() ? T.red : T.border}`,
              fontSize: 13, outline: "none"
            }}
          />

          {/* 빠른 주제 선택 */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, fontWeight: 700 }}>
              ⚡ 빠른 선택
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {TOPIC_PRESETS.map(p => (
                <button key={p.value} onClick={() => setTopic(p.value)} style={{
                  padding: "6px 10px", borderRadius: T.radiusSm,
                  border: `1px solid ${topic === p.value ? T.accent : T.border}`,
                  background: topic === p.value ? T.accentLight : T.bg,
                  color: topic === p.value ? T.accent : T.textMid,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4
                }}>
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 학년 & 난이도 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>학년</div>
            <select value={grade} onChange={e => setGrade(e.target.value)} style={{
              width: "100%", padding: "10px 10px", borderRadius: T.radiusSm,
              border: `1.5px solid ${T.border}`, fontSize: 13, boxSizing: "border-box"
            }}>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>난이도</div>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={{
              width: "100%", padding: "10px 10px", borderRadius: T.radiusSm,
              border: `1.5px solid ${T.border}`, fontSize: 13, boxSizing: "border-box"
            }}>
              <option value="easy">🟢 쉬움 (단순 SVO)</option>
              <option value="medium">🟡 보통 (형용사 포함)</option>
              <option value="hard">🔴 어려움 (긴 문장)</option>
            </select>
          </div>
        </div>

        {/* 문장 수 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
            생성할 문장 수
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[3, 5, 10, 15].map(n => (
              <button key={n} onClick={() => setCount(n)} style={{
                flex: 1, padding: "9px 6px", borderRadius: T.radiusSm,
                border: `1.5px solid ${count === n ? T.accent : T.border}`,
                background: count === n ? T.accentLight : T.bg,
                fontSize: 13, fontWeight: 800, cursor: "pointer",
                color: count === n ? T.accent : T.text
              }}>
                {n}문장
              </button>
            ))}
          </div>
        </div>

        {/* 추가 요청 (선택) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 6 }}>
            추가 요청 (선택)
          </div>
          <input
            value={extraNote}
            onChange={e => setExtraNote(e.target.value)}
            placeholder="예: cat, dog 단어 포함해줘"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 12px", borderRadius: T.radiusSm,
              border: `1.5px solid ${T.border}`, fontSize: 12, outline: "none"
            }}
          />
        </div>
      </Card>

      {error && (
        <div style={{
          padding: "10px 14px", background: T.redLight, borderRadius: T.radiusSm,
          marginBottom: 12, fontSize: 12, color: T.red, fontWeight: 700
        }}>
          ⚠️ {error}
        </div>
      )}

      <Btn v="primary" size="lg" onClick={generate}
        disabled={!topic.trim()}
        style={{ width: "100%", fontSize: 15 }}>
        🤖 AI로 문장 생성하기 ({count}개)
      </Btn>

      <div style={{ fontSize: 11, color: T.textDim, textAlign: "center", marginTop: 10 }}>
        생성 후 내용 수정 및 선택 저장 가능해요
      </div>
    </div>
  );
}
