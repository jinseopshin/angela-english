"use client";
import { useState, useMemo } from "react";
import { T, Btn, Card } from "./theme";
import { playClick } from "./soundEffects";
import { AISentenceGenerator } from "./AISentenceGenerator";
import {
  getAllSentences,
  saveSentence,
  deleteSentence,
  splitSentenceToWords,
  assignSentenceToStudent,
  unassignSentenceFromStudent,
  getAllAssignments,
  DIFFICULTY_LABELS,
} from "./sentenceBuilderData";

// ══════════════════════════════════════════════════════════════════════════
//   ✏️ SentenceBuilderEditor.js — 선생님용 문장 출제/관리 화면
//
//   기능:
//   - 새 문장 생성/수정
//   - 영어 문장 → 자동 단어 분리 미리보기
//   - 난이도 설정 (쉬움/보통/어려움)
//   - 이미지 URL (선택)
//   - 공개/비공개 토글
//   - 학생 배정 (이름 입력)
//   - 삭제
// ══════════════════════════════════════════════════════════════════════════

export function SentenceBuilderEditor({ onExit }) {
  const [editing, setEditing] = useState(null); // null | 'new' | {id: ...}
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAIGen, setShowAIGen] = useState(false);
  const sentences = useMemo(() => getAllSentences(), [refreshKey]);
  const refresh = () => setRefreshKey(k => k + 1);

  // AI 생성 화면
  if (showAIGen) {
    return (
      <AISentenceGenerator
        onExit={() => setShowAIGen(false)}
        onSaved={() => { refresh(); setShowAIGen(false); }}
      />
    );
  }
  
  if (editing !== null) {
    return (
      <SentenceForm
        sentence={editing === "new" ? null : editing}
        onSave={() => { refresh(); setEditing(null); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onExit} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
            ✏️ 문장 만들기 출제
          </div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
            학생이 풀 문장을 직접 만들 수 있어요
          </div>
        </div>
        <button onClick={() => { playClick(); setEditing("new"); }}
          style={{
            background: T.accent, color: "white", border: "none",
            borderRadius: 10, padding: "10px 14px",
            fontSize: 13, fontWeight: 800, cursor: "pointer"
          }}>
          + 새 문장
        </button>
      </div>
{/* 🤖 AI 자동 생성 진입 배너 */}
      <Card style={{
        marginBottom: 14, padding: 14,
        background: `linear-gradient(135deg, ${T.purple}, ${T.accent})`,
        color: "white", cursor: "pointer", border: "none",
        display: "flex", alignItems: "center", gap: 12
      }} onClick={() => { playClick(); setShowAIGen(true); }}>
        <div style={{ fontSize: 36 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3 }}>
            AI로 문장 자동 생성
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            주제 선택 → AI가 즉시 학습용 문장 생성
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.85 }}>›</div>
      </Card>

      {sentences.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", marginTop: 20,
          background: T.card, borderRadius: 20, border: `2px solid ${T.border}`
        }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>
            아직 문장이 없어요
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginBottom: 20 }}>
            "+ 새 문장" 버튼을 눌러 첫 문장을 만들어보세요
          </div>
          <button onClick={() => { playClick(); setEditing("new"); }}
            style={{
              background: T.accent, color: "white", border: "none",
              borderRadius: 12, padding: "12px 24px",
              fontSize: 13, fontWeight: 800, cursor: "pointer"
            }}>
            + 첫 문장 만들기
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sentences.map(s => (
            <SentenceCard
              key={s.id}
              sentence={s}
              onEdit={() => setEditing(s)}
              onDelete={() => {
                if (confirm(`"${s.english}" 문장을 삭제할까요?`)) {
                  deleteSentence(s.id);
                  refresh();
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 문장 카드 (목록 1개) ──
function SentenceCard({ sentence, onEdit, onDelete }) {
  const diff = DIFFICULTY_LABELS[sentence.difficulty] || DIFFICULTY_LABELS.medium;
  const assignedCount = useMemo(() => {
    return getAllAssignments().filter(a => a.sentenceId === sentence.id).length;
  }, [sentence.id]);

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          padding: "2px 8px", borderRadius: 8,
          background: diff.bg, color: diff.color,
          fontSize: 10, fontWeight: 800
        }}>{diff.label}</span>
        {sentence.isPublic && (
          <span style={{
            padding: "2px 8px", borderRadius: 8,
            background: T.green, color: "white",
            fontSize: 10, fontWeight: 800
          }}>🌐 공개</span>
        )}
        {assignedCount > 0 && (
          <span style={{
            padding: "2px 8px", borderRadius: 8,
            background: T.accent, color: "white",
            fontSize: 10, fontWeight: 800
          }}>👤 {assignedCount}명</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => { playClick(); onEdit(); }} style={{
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: "4px 10px", fontSize: 11, fontWeight: 700,
          color: T.textMid, cursor: "pointer"
        }}>✏️ 수정</button>
        <button onClick={onDelete} style={{
          background: T.bg, border: `1px solid ${T.red}`, borderRadius: 8,
          padding: "4px 10px", fontSize: 11, fontWeight: 700,
          color: T.red, cursor: "pointer"
        }}>🗑️</button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>
        {sentence.english}
      </div>
      <div style={{ fontSize: 12, color: T.textMid }}>
        {sentence.korean}
      </div>
      <div style={{
        marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4
      }}>
        {sentence.words?.map((w, i) => (
          <span key={i} style={{
            padding: "2px 8px", background: T.bg,
            border: `1px solid ${T.border}`, borderRadius: 6,
            fontSize: 11, color: T.textMid, fontFamily: "monospace"
          }}>{w}</span>
        ))}
      </div>
    </Card>
  );
}

// ── 문장 입력/수정 폼 ──
function SentenceForm({ sentence, onSave, onCancel }) {
  const [english, setEnglish] = useState(sentence?.english || "");
  const [korean, setKorean] = useState(sentence?.korean || "");
  const [difficulty, setDifficulty] = useState(sentence?.difficulty || "medium");
  const [imageUrl, setImageUrl] = useState(sentence?.imageUrl || "");
  const [isPublic, setIsPublic] = useState(sentence?.isPublic || false);
  const [studentName, setStudentName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // 단어 분리 미리보기
  const wordsPreview = useMemo(() => splitSentenceToWords(english), [english]);

  // 현재 배정된 학생들
  const assignments = useMemo(() => {
    if (!sentence?.id) return [];
    return getAllAssignments().filter(a => a.sentenceId === sentence.id);
  }, [sentence?.id, refreshKey]);

  const handleSave = () => {
    if (!english.trim()) {
      alert("영어 문장을 입력해주세요");
      return;
    }
    if (!korean.trim()) {
      alert("한글 뜻을 입력해주세요");
      return;
    }
    playClick();
    const saved = saveSentence({
      id: sentence?.id,
      english: english.trim(),
      korean: korean.trim(),
      difficulty,
      imageUrl: imageUrl.trim() || null,
      isPublic,
    });
    if (saved) {
      onSave();
    }
  };

  const addStudent = () => {
    if (!studentName.trim() || !sentence?.id) return;
    playClick();
    assignSentenceToStudent(sentence.id, studentName.trim());
    setStudentName("");
    setRefreshKey(k => k + 1);
  };

  const removeStudent = (name) => {
    if (!sentence?.id) return;
    playClick();
    unassignSentenceFromStudent(sentence.id, name);
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onCancel} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 취소</button>
        <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
          {sentence ? "✏️ 문장 수정" : "+ 새 문장"}
        </div>
      </div>

{/* 영어 문장 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "block", marginBottom: 6 }}>
          영어 문장 *
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={english} onChange={e => setEnglish(e.target.value)}
            placeholder="The cat is fat."
            style={{
              flex: 1, padding: "10px 12px",
              border: `2px solid ${T.border}`, borderRadius: 10,
              fontSize: 15, fontFamily: "inherit"
            }}
          />
          <button type="button"
            onClick={async () => {
              if (!korean.trim()) {
                alert("먼저 한글 뜻을 입력해주세요");
                return;
              }
              try {
                const res = await fetch("/api/translate-sentence", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: korean, direction: "ko-to-en" }),
                });
                const data = await res.json();
                if (res.ok && data.translation) {
                  setEnglish(data.translation);
                  playClick();
                } else {
                  alert("번역 실패: " + (data.error || "다시 시도해주세요"));
                }
              } catch (e) {
                alert("번역 오류: " + e.message);
              }
            }}
            style={{
              background: T.purpleLight, color: T.purple,
              border: `2px solid ${T.purple}`, borderRadius: 10,
              padding: "0 12px", fontSize: 11, fontWeight: 800,
              cursor: "pointer", whiteSpace: "nowrap"
            }}
            title="한글 뜻을 영어로 자동 번역">
            🤖 영어로
          </button>
        </div>
        {wordsPreview.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: T.textMid }}>
            단어 분리: <span style={{ fontFamily: "monospace" }}>
              {wordsPreview.map((w, i) => (
                <span key={i} style={{
                  display: "inline-block", margin: "2px 4px 2px 0",
                  padding: "2px 6px", background: T.accentLight,
                  borderRadius: 4, color: T.accent
                }}>{w}</span>
              ))}
            </span>
            <span style={{ marginLeft: 4 }}>({wordsPreview.length}개)</span>
          </div>
        )}
      </div>

{/* 한글 뜻 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "block", marginBottom: 6 }}>
          한글 뜻 *
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={korean} onChange={e => setKorean(e.target.value)}
            placeholder="고양이가 뚱뚱해요."
            style={{
              flex: 1, padding: "10px 12px",
              border: `2px solid ${T.border}`, borderRadius: 10,
              fontSize: 14, fontFamily: "inherit"
            }}
          />
          <button type="button"
            onClick={async () => {
              if (!english.trim()) {
                alert("먼저 영어 문장을 입력해주세요");
                return;
              }
              try {
                const res = await fetch("/api/translate-sentence", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: english, direction: "en-to-ko" }),
                });
                const data = await res.json();
                if (res.ok && data.translation) {
                  setKorean(data.translation);
                  playClick();
                } else {
                  alert("번역 실패: " + (data.error || "다시 시도해주세요"));
                }
              } catch (e) {
                alert("번역 오류: " + e.message);
              }
            }}
            style={{
              background: T.purpleLight, color: T.purple,
              border: `2px solid ${T.purple}`, borderRadius: 10,
              padding: "0 12px", fontSize: 11, fontWeight: 800,
              cursor: "pointer", whiteSpace: "nowrap"
            }}
            title="영어 문장을 한글로 자동 번역">
            🤖 한글로
          </button>
        </div>
      </div>

      {/* 난이도 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "block", marginBottom: 6 }}>
          난이도
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(DIFFICULTY_LABELS).map(([key, val]) => (
            <button key={key}
              onClick={() => { playClick(); setDifficulty(key); }}
              style={{
                flex: 1, padding: "10px 0",
                background: difficulty === key ? val.color : T.bg,
                color: difficulty === key ? "white" : T.textMid,
                border: `2px solid ${difficulty === key ? val.color : T.border}`,
                borderRadius: 10, fontSize: 12, fontWeight: 800,
                cursor: "pointer"
              }}>
              {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* 이미지 URL (선택) */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "block", marginBottom: 6 }}>
          이미지 URL (선택사항)
        </label>
        <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
          placeholder="https://res.cloudinary.com/.../image.jpg"
          style={{
            width: "100%", padding: "10px 12px",
            border: `2px solid ${T.border}`, borderRadius: 10,
            fontSize: 12, fontFamily: "monospace"
          }}
        />
        <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
          💡 Cloudinary URL을 붙여넣으면 문제에 상황 그림으로 표시돼요
        </div>
        {imageUrl && (
          <div style={{
            marginTop: 8, width: "100%", maxWidth: 200, height: 120,
            border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden",
            background: T.bg
          }}>
            <img src={imageUrl} alt="미리보기"
              onError={(e) => { e.target.style.display = "none"; }}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {/* 공개 여부 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: 12, background: T.bg, borderRadius: 10,
          cursor: "pointer"
        }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
              🌐 공개 문장으로 설정
            </div>
            <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
              체크하면 모든 학생이 풀 수 있어요
            </div>
          </div>
        </label>
      </div>

      {/* 학생 배정 (수정 모드일 때만) */}
      {sentence?.id && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "block", marginBottom: 6 }}>
            특정 학생에게 배정
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addStudent(); }}
              placeholder="학생 이름 입력"
              style={{
                flex: 1, padding: "8px 12px",
                border: `2px solid ${T.border}`, borderRadius: 10,
                fontSize: 13
              }}
            />
            <button onClick={addStudent} style={{
              background: T.accent, color: "white", border: "none",
              borderRadius: 10, padding: "8px 16px",
              fontSize: 12, fontWeight: 800, cursor: "pointer"
            }}>
              + 추가
            </button>
          </div>
          {assignments.length > 0 && (
            <div style={{
              marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4
            }}>
              {assignments.map(a => (
                <span key={a.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 8px",
                  background: T.accentLight, color: T.accent,
                  borderRadius: 8, fontSize: 11, fontWeight: 700
                }}>
                  👤 {a.studentName}
                  <button onClick={() => removeStudent(a.studentName)} style={{
                    background: "transparent", border: "none",
                    color: T.accent, cursor: "pointer", padding: 0,
                    fontSize: 12, lineHeight: 1
                  }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 저장/취소 버튼 */}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: 14, background: T.card,
          color: T.text, border: `2px solid ${T.border}`, borderRadius: 12,
          fontSize: 13, fontWeight: 800, cursor: "pointer"
        }}>
          취소
        </button>
        <button onClick={handleSave} style={{
          flex: 2, padding: 14, background: T.green,
          color: "white", border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 900, cursor: "pointer"
        }}>
          💾 저장
        </button>
      </div>
    </div>
  );
}
