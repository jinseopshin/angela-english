// ══════════════════════════════════════════════════════════════════════════
//   📝 sentenceBuilderData.js — 문장 만들기 데이터 관리
//
//   - 선생님이 만든 문장을 localStorage에 저장
//   - CRUD + 학생 배정 + 공개/비공개 관리
//   - 문장 → 단어 자동 분리 (구두점은 마지막 단어에 붙임)
// ══════════════════════════════════════════════════════════════════════════

const SENTENCES_KEY = "sentence_builder_sentences";
const ASSIGN_KEY = "sentence_builder_assignments";

// ── 문장을 단어 배열로 분리 ──
// 예: "The cat is fat." → ["The", "cat", "is", "fat."]
//     "Is this a pen?"  → ["Is", "this", "a", "pen?"]
export function splitSentenceToWords(sentence) {
  if (!sentence) return [];
  // 공백으로 분리 후 빈 문자열 제거
  return sentence.trim().split(/\s+/).filter(w => w.length > 0);
}

// ── 모든 문장 조회 ──
export function getAllSentences() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SENTENCES_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── 단일 문장 조회 ──
export function getSentenceById(id) {
  return getAllSentences().find(s => s.id === id);
}

// ── 문장 저장/수정 (id가 있으면 수정, 없으면 새로 생성) ──
export function saveSentence(sentence) {
  if (typeof window === "undefined") return null;
  try {
    const sentences = getAllSentences();
    let id = sentence.id;
    if (!id) {
      id = "sent_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    }
    const words = splitSentenceToWords(sentence.english);
    const next = {
      ...sentence,
      id,
      words,
      updatedAt: new Date().toISOString(),
    };
    const idx = sentences.findIndex(s => s.id === id);
    if (idx >= 0) {
      sentences[idx] = next;
    } else {
      next.createdAt = new Date().toISOString();
      sentences.push(next);
    }
    window.localStorage.setItem(SENTENCES_KEY, JSON.stringify(sentences));
    return next;
  } catch (err) {
    console.warn("[sentenceBuilder] 저장 실패:", err);
    return null;
  }
}

// ── 문장 삭제 (관련 배정도 함께 삭제) ──
export function deleteSentence(sentenceId) {
  if (typeof window === "undefined") return;
  try {
    const sentences = getAllSentences().filter(s => s.id !== sentenceId);
    window.localStorage.setItem(SENTENCES_KEY, JSON.stringify(sentences));
    const assigns = getAllAssignments().filter(a => a.sentenceId !== sentenceId);
    window.localStorage.setItem(ASSIGN_KEY, JSON.stringify(assigns));
  } catch {}
}

// ── 배정 정보 조회 ──
export function getAllAssignments() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(ASSIGN_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── 학생에게 문장 배정 ──
export function assignSentenceToStudent(sentenceId, studentName) {
  if (typeof window === "undefined") return;
  try {
    const assigns = getAllAssignments();
    if (assigns.some(a => a.sentenceId === sentenceId && a.studentName === studentName)) return;
    assigns.push({
      id: "assign_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      sentenceId,
      studentName,
      assignedAt: new Date().toISOString(),
    });
    window.localStorage.setItem(ASSIGN_KEY, JSON.stringify(assigns));
  } catch {}
}

// ── 학생 배정 해제 ──
export function unassignSentenceFromStudent(sentenceId, studentName) {
  if (typeof window === "undefined") return;
  try {
    const assigns = getAllAssignments().filter(
      a => !(a.sentenceId === sentenceId && a.studentName === studentName)
    );
    window.localStorage.setItem(ASSIGN_KEY, JSON.stringify(assigns));
  } catch {}
}

// ── 학생에게 배정된 문장 목록 ──
export function getStudentAssignedSentences(studentName) {
  const assigns = getAllAssignments().filter(a => a.studentName === studentName);
  const sentences = getAllSentences();
  return assigns
    .map(a => ({ ...sentences.find(s => s.id === a.sentenceId), assignedAt: a.assignedAt }))
    .filter(s => s && s.id);
}

// ── 공개 문장 (모든 학생이 풀 수 있음) ──
export function getPublicSentences() {
  return getAllSentences().filter(s => s.isPublic);
}

// ── 학생에게 보여줄 모든 문장 (배정 + 공개, 중복 제거) ──
export function getAvailableSentencesForStudent(studentName) {
  const assigned = getStudentAssignedSentences(studentName);
  const publicSentences = getPublicSentences();
  const seen = new Set(assigned.map(s => s.id));
  const merged = [...assigned];
  publicSentences.forEach(s => {
    if (!seen.has(s.id)) {
      merged.push(s);
      seen.add(s.id);
    }
  });
  return merged;
}

// ── 난이도 라벨 ──
export const DIFFICULTY_LABELS = {
  easy:   { label: "쉬움",   color: "#22c55e", bg: "#dcfce7" },
  medium: { label: "보통",   color: "#f59e0b", bg: "#fef3c7" },
  hard:   { label: "어려움", color: "#ef4444", bg: "#fee2e2" },
};
