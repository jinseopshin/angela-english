"use client";
import { useState, useMemo, useEffect } from "react";
import { T, Btn, Card } from "./theme";
import {
  PHONICS_LEVELS, COMMON_EMOJIS, guessEmoji,
  getAllCustomSets, getCustomSet, saveCustomSet, deleteCustomSet,
  getAllAssignments, assignSetToStudent, unassignSetFromStudent,
} from "./phonicsData";
import { playClick } from "./soundEffects";

// ══════════════════════════════════════════════════════════════════════════
//   🔤 PhonicsTeacher.js — 선생님용 파닉스 단어집 관리
// ══════════════════════════════════════════════════════════════════════════

export function PhonicsTeacherMenu({ students, onExit }) {
  const [view, setView] = useState("list"); // "list" | "edit" | "assign"
  const [editingSetId, setEditingSetId] = useState(null);
  const [assigningSetId, setAssigningSetId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const sets = useMemo(() => getAllCustomSets(), [refreshKey, view]);
  const refresh = () => setRefreshKey(k => k + 1);

  if (view === "edit") {
    return (
      <PhonicsSetEditor
        setId={editingSetId}
        onSave={() => { refresh(); setView("list"); setEditingSetId(null); }}
        onCancel={() => { setView("list"); setEditingSetId(null); }}
      />
    );
  }

  if (view === "assign") {
    return (
      <PhonicsAssignView
        setId={assigningSetId}
        students={students}
        onBack={() => { refresh(); setView("list"); setAssigningSetId(null); }}
      />
    );
  }

  // List 화면
  return (
    <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onExit} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>🔤 파닉스 단어집 관리</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
            유치부 파닉스 학습용 커스텀 단어집을 만들고 배정하세요
          </div>
        </div>
        <Btn v="primary" size="md" onClick={() => { playClick(); setEditingSetId(null); setView("edit"); }}>
          ➕ 새 단어집
        </Btn>
      </div>

      {sets.length === 0 ? (
        <div style={{
          background: T.card, borderRadius: 16, padding: 40,
          textAlign: "center", color: T.textMid, border: `2px dashed ${T.border}`
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            아직 만든 단어집이 없어요
          </div>
          <div style={{ fontSize: 11 }}>
            "➕ 새 단어집" 버튼을 눌러 첫 단어집을 만들어보세요
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sets.map(s => {
            const level = PHONICS_LEVELS.find(l => l.id === s.levelId);
            const assignCount = getAllAssignments().filter(a => a.setId === s.id).length;
            return (
              <Card key={s.id} style={{
                padding: 14, display: "flex", alignItems: "center", gap: 12,
                borderLeft: `5px solid ${level?.color || T.accent}`
              }}>
                <div style={{
                  width: 50, height: 50, background: level?.bg || T.bg, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26
                }}>{level?.icon || "📚"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>
                    {level?.label || "기본"} · {s.words?.length || 0}개 단어
                    {assignCount > 0 && (
                      <span style={{ marginLeft: 6, color: T.accent, fontWeight: 700 }}>
                        · 👥 {assignCount}명 배정
                      </span>
                    )}
                    {s.isPublic && (
                      <span style={{ marginLeft: 6, color: T.green, fontWeight: 700 }}>
                        · 🌐 공개
                      </span>
                    )}
                  </div>
                </div>
                <Btn v="ghost" size="sm" onClick={() => { playClick(); setAssigningSetId(s.id); setView("assign"); }}>
                  👥 배정
                </Btn>
                <Btn v="ghost" size="sm" onClick={() => { playClick(); setEditingSetId(s.id); setView("edit"); }}>
                  ✏️ 편집
                </Btn>
                <button onClick={() => {
                  if (window.confirm(`"${s.name}" 단어집을 삭제할까요? 배정도 함께 제거됩니다.`)) {
                    deleteCustomSet(s.id);
                    refresh();
                  }
                }} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 16, color: T.red, padding: "4px 8px"
                }}>🗑️</button>
              </Card>
            );
          })}
        </div>
      )}

      {/* 안내 박스 */}
      <div style={{
        marginTop: 20, padding: 14, background: T.bg, borderRadius: 12,
        border: `1px solid ${T.border}`
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>
          💡 단어집 사용 안내
        </div>
        <ul style={{ fontSize: 11, color: T.textMid, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
          <li><strong>배정:</strong> 특정 학생들에게 단어집을 배정하면 학생의 메인 화면에 표시됩니다</li>
          <li><strong>공개:</strong> 공개 단어집은 배정 없이도 모든 학생이 풀 수 있어요</li>
          <li><strong>이모지:</strong> 단어마다 이모지를 넣으면 유치부 학생들이 더 잘 이해해요</li>
        </ul>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   ✏️ 단어집 만들기/편집 화면
// ══════════════════════════════════════════════════════════════════════════
function PhonicsSetEditor({ setId, onSave, onCancel }) {
  const isNew = !setId;
  const existing = isNew ? null : getCustomSet(setId);

  const [name, setName] = useState(existing?.name || "");
  const [levelId, setLevelId] = useState(existing?.levelId || "cvc");
  const [isPublic, setIsPublic] = useState(existing?.isPublic || false);
  const [words, setWords] = useState(existing?.words || []);
  const [bulkInput, setBulkInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // wordIdx 또는 null
  const [error, setError] = useState("");

  const addEmptyWord = () => {
    playClick();
    setWords(prev => [...prev, { word: "", ko: "", emoji: "📝" }]);
  };

  const updateWord = (idx, field, value) => {
    setWords(prev => prev.map((w, i) => {
      if (i !== idx) return w;
      const next = { ...w, [field]: value };
      // 영어 단어 입력 시 이모지 자동 추천 (기본 이모지일 때만)
      if (field === "word" && (w.emoji === "📝" || !w.emoji)) {
        const guessed = guessEmoji(value);
        if (guessed !== "📝") next.emoji = guessed;
      }
      return next;
    }));
  };

  const removeWord = (idx) => {
    playClick();
    setWords(prev => prev.filter((_, i) => i !== idx));
  };

  const processBulkInput = () => {
    if (!bulkInput.trim()) return;
    playClick();
    const lines = bulkInput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newWords = lines.map(line => {
      // "apple 사과" 형식: 첫 단어가 영어, 나머지가 한글
      const parts = line.split(/\s+/);
      const en = parts[0]?.toLowerCase() || "";
      const ko = parts.slice(1).join(" ");
      return { word: en, ko, emoji: guessEmoji(en) };
    }).filter(w => w.word);
    setWords(prev => [...prev, ...newWords]);
    setBulkInput("");
  };

  const handleSave = () => {
    setError("");
    if (!name.trim()) {
      setError("단어집 이름을 입력해주세요");
      return;
    }
    const validWords = words.filter(w => w.word && w.word.trim());
    if (validWords.length === 0) {
      setError("단어를 1개 이상 추가해주세요");
      return;
    }
    saveCustomSet({
      id: setId,
      name: name.trim(),
      levelId,
      isPublic,
      words: validWords.map(w => ({
        word: w.word.trim().toLowerCase(),
        ko: w.ko?.trim() || "",
        emoji: w.emoji || "📝",
      })),
    });
    onSave();
  };

  return (
    <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onCancel} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 취소</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
            {isNew ? "✨ 새 단어집 만들기" : "✏️ 단어집 편집"}
          </div>
        </div>
        <Btn v="primary" size="md" onClick={handleSave}>💾 저장</Btn>
      </div>

      {error && (
        <div style={{
          padding: 12, background: "#fee2e2", borderRadius: 10,
          color: T.red, fontSize: 12, fontWeight: 700, marginBottom: 12
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 기본 정보 */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📋 기본 정보</div>

        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>단어집 이름 *</div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: Lv1 동물 단어, Magic E 연습"
            style={{
              width: "100%", padding: "10px 12px",
              border: `1px solid ${T.border}`, borderRadius: 8,
              fontSize: 13, background: T.bg, color: T.text
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>단계 *</div>
          <select
            value={levelId}
            onChange={e => setLevelId(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px",
              border: `1px solid ${T.border}`, borderRadius: 8,
              fontSize: 13, background: T.bg, color: T.text
            }}>
            {PHONICS_LEVELS.map(l => (
              <option key={l.id} value={l.id}>{l.icon} {l.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>🌐 공개 단어집</div>
            <div style={{ fontSize: 10, color: T.textMid }}>
              체크하면 배정 없이도 모든 학생이 자유롭게 풀 수 있어요
            </div>
          </div>
        </label>
      </Card>

      {/* 빠른 추가 (벌크 입력) */}
      <Card style={{ padding: 14, marginBottom: 12, background: T.bg }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 6 }}>
          ⚡ 빠른 추가
        </div>
        <div style={{ fontSize: 10, color: T.textMid, marginBottom: 8, lineHeight: 1.6 }}>
          한 줄에 "영어 한글" 형식으로 입력하세요. 예: <code>cat 고양이</code>
        </div>
        <textarea
          value={bulkInput}
          onChange={e => setBulkInput(e.target.value)}
          placeholder="cat 고양이&#10;dog 개&#10;bird 새"
          rows={4}
          style={{
            width: "100%", padding: 10,
            border: `1px solid ${T.border}`, borderRadius: 8,
            fontSize: 12, fontFamily: "monospace",
            background: T.card, color: T.text, resize: "vertical"
          }}
        />
        <Btn v="primary" size="sm" onClick={processBulkInput} style={{ marginTop: 6 }}>
          ➕ 단어 추가
        </Btn>
      </Card>

      {/* 단어 목록 */}
      <Card style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
            📝 단어 목록 ({words.length}개)
          </div>
          <Btn v="ghost" size="sm" onClick={addEmptyWord}>+ 한 줄 추가</Btn>
        </div>

        {words.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: T.textMid, fontSize: 12,
            border: `1px dashed ${T.border}`, borderRadius: 10
          }}>
            위의 "빠른 추가" 또는 "한 줄 추가"로 단어를 입력해주세요
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {words.map((w, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: 6, background: T.bg, borderRadius: 8
              }}>
                {/* 이모지 선택 */}
                <button onClick={() => { playClick(); setShowEmojiPicker(showEmojiPicker === idx ? null : idx); }}
                  style={{
                    width: 44, height: 44, fontSize: 22,
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 8, cursor: "pointer"
                  }}>
                  {w.emoji || "📝"}
                </button>
                {/* 영어 단어 */}
                <input
                  type="text"
                  value={w.word}
                  onChange={e => updateWord(idx, "word", e.target.value)}
                  placeholder="영어"
                  style={{
                    flex: 1.5, padding: "8px 10px",
                    border: `1px solid ${T.border}`, borderRadius: 6,
                    fontSize: 13, background: T.card, color: T.text
                  }}
                />
                {/* 한글 */}
                <input
                  type="text"
                  value={w.ko}
                  onChange={e => updateWord(idx, "ko", e.target.value)}
                  placeholder="한글"
                  style={{
                    flex: 1, padding: "8px 10px",
                    border: `1px solid ${T.border}`, borderRadius: 6,
                    fontSize: 13, background: T.card, color: T.text
                  }}
                />
                <button onClick={() => removeWord(idx)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 16, padding: "4px 8px", color: T.red
                }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 이모지 피커 모달 */}
      {showEmojiPicker !== null && (
        <div onClick={() => setShowEmojiPicker(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 16, padding: 16,
            maxWidth: 480, width: "100%", maxHeight: "70vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>😀 이모지 선택</div>
              <button onClick={() => setShowEmojiPicker(null)} style={{
                background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.textMid
              }}>✕</button>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
              gap: 4
            }}>
              {COMMON_EMOJIS.map((emo, i) => (
                <button key={i} onClick={() => {
                  updateWord(showEmojiPicker, "emoji", emo);
                  setShowEmojiPicker(null);
                  playClick();
                }} style={{
                  width: 40, height: 40, fontSize: 22,
                  background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 6, cursor: "pointer"
                }}>
                  {emo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   👥 학생 배정 화면
// ══════════════════════════════════════════════════════════════════════════
function PhonicsAssignView({ setId, students, onBack }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const set = useMemo(() => getCustomSet(setId), [setId, refreshKey]);
  const assignedNames = useMemo(() => {
    return getAllAssignments()
      .filter(a => a.setId === setId)
      .map(a => a.studentName);
  }, [setId, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const toggle = (name) => {
    playClick();
    if (assignedNames.includes(name)) {
      unassignSetFromStudent(setId, name);
    } else {
      assignSetToStudent(setId, name);
    }
    refresh();
  };

  if (!set) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: T.red }}>단어집을 찾을 수 없습니다</div>
        <Btn v="primary" size="md" onClick={onBack} style={{ marginTop: 12 }}>← 뒤로</Btn>
      </div>
    );
  }

  const level = PHONICS_LEVELS.find(l => l.id === set.levelId);

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>👥 학생 배정</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
            {level?.icon} {set.name} · {set.words?.length || 0}개 단어
          </div>
        </div>
      </div>

      <div style={{
        padding: 12, background: T.bg, borderRadius: 10,
        fontSize: 11, color: T.textMid, marginBottom: 12, lineHeight: 1.6
      }}>
        💡 학생 이름을 클릭하면 배정/해제됩니다. 배정된 학생은 메인 화면에 이 단어집이 표시돼요.
      </div>

      {(() => {
        // students는 객체일 수도, 배열일 수도 있음 - 둘 다 지원
        const studentList = Array.isArray(students)
          ? students
          : Object.values(students || {});
        return studentList.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {studentList.map(s => {
              const assigned = assignedNames.includes(s.name);
              return (
                <div key={s.id || s.name} onClick={() => toggle(s.name)} style={{
                  padding: 12, borderRadius: 12, cursor: "pointer",
                  background: assigned ? T.green : T.card,
                  color: assigned ? "white" : T.text,
                  border: `2px solid ${assigned ? T.green : T.border}`,
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "all 0.2s"
                }}>
                  <div style={{ fontSize: 24 }}>{s.avatar || "🙂"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{s.name}</div>
                    {assigned && (
                      <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>✅ 배정됨</div>
                    )}
                  </div>
                  <div style={{ fontSize: 18 }}>{assigned ? "✓" : "+"}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: 30, textAlign: "center",
            color: T.textMid, fontSize: 13,
            border: `2px dashed ${T.border}`, borderRadius: 12
          }}>
            📚 등록된 학생이 없어요. 학생을 먼저 추가해주세요.
          </div>
        );
      })()}

      <div style={{
        marginTop: 16, padding: 10, background: T.bg, borderRadius: 8,
        fontSize: 11, color: T.textMid, textAlign: "center"
      }}>
        현재 <strong style={{ color: T.green }}>{assignedNames.length}명</strong>에게 배정됨
      </div>
    </div>
  );
}