"use client";
import { supabase, isSupabaseReady } from "./supabaseClient";

// ══════════════════════════════════════════════════════════════════════════
//   학생 단어 학습 이력 시스템
//
//   Phase 1: 단어장 (즐겨찾기)
//   Phase 2: 망각 곡선 (자동 복습 일정)
//   Phase 3: 발음 점수
//
//   세 기능 모두 같은 student_words 테이블을 공유합니다.
// ══════════════════════════════════════════════════════════════════════════

// ── 망각 곡선 간격 (Phase 2에서 사용) ─────────────────────────────────────
const REVIEW_INTERVALS = [
  null,   // level 0: 신규 (복습 일정 없음)
  1,      // level 1: 1일 후
  3,      // level 2: 3일 후
  7,      // level 3: 7일 후
  14,     // level 4: 14일 후
  30,     // level 5: 30일 후 (마스터)
];

// 다음 복습 날짜 계산
function calcNextReviewDate(level) {
  const days = REVIEW_INTERVALS[level];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────────────
//  단어 학습 기록 (게임에서 호출하는 핵심 함수)
//  - 단어 한 개의 정답/오답을 기록
//  - 망각 곡선 레벨 자동 업데이트
//  - localStorage 폴백 지원
// ──────────────────────────────────────────────────────────────────────────
export async function recordWordEncounter(studentName, word, isCorrect) {
  if (!studentName || !word?.en) return;
  
  // 1) localStorage에도 기록 (오프라인 폴백)
  recordWordToLocalStorage(studentName, word, isCorrect);
  
  // 2) Supabase에 기록
  if (!isSupabaseReady()) return;
  
  try {
    // 기존 기록 조회
    const { data: existing } = await supabase
      .from("student_words")
      .select("*")
      .eq("student_name", studentName)
      .eq("word_en", word.en)
      .maybeSingle();
    
    const now = new Date().toISOString();
    
    if (existing) {
      // 기존 기록 업데이트
      const newCorrect = existing.correct_count + (isCorrect ? 1 : 0);
      const newWrong = existing.wrong_count + (isCorrect ? 0 : 1);
      const newEncounter = existing.encounter_count + 1;
      
      // 망각 곡선 레벨 업데이트
      let newLevel = existing.review_level || 0;
      if (isCorrect) {
        newLevel = Math.min(5, newLevel + 1); // 정답이면 한 단계 ↑ (최대 5)
      } else {
        newLevel = Math.max(1, Math.floor(newLevel / 2)); // 오답이면 절반으로
      }
      
      await supabase.from("student_words").update({
        encounter_count: newEncounter,
        correct_count: newCorrect,
        wrong_count: newWrong,
        review_level: newLevel,
        next_review_date: calcNextReviewDate(newLevel),
        last_studied_at: now,
        updated_at: now,
      }).eq("id", existing.id);
      
    } else {
      // 새 기록 생성
      const initialLevel = isCorrect ? 1 : 0;
      await supabase.from("student_words").insert({
        student_name: studentName,
        word_en: word.en,
        word_ko: word.ko,
        encounter_count: 1,
        correct_count: isCorrect ? 1 : 0,
        wrong_count: isCorrect ? 0 : 1,
        review_level: initialLevel,
        next_review_date: calcNextReviewDate(initialLevel),
        first_seen_at: now,
        last_studied_at: now,
      });
    }
  } catch (e) {
    console.warn(`recordWordEncounter 실패 (${word.en}):`, e.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  localStorage 폴백 (Supabase 못 쓸 때 / 오프라인 대비)
//  기존 angela_wrong_{name} 키 형식 유지
// ──────────────────────────────────────────────────────────────────────────
function recordWordToLocalStorage(studentName, word, isCorrect) {
  if (typeof window === "undefined") return;
  try {
    const key = `angela_wrong_${studentName}`;
    const data = JSON.parse(window.localStorage.getItem(key) || "{}");
    data[word.en] = data[word.en] || { wrong: 0, correct: 0, ko: word.ko };
    if (isCorrect) data[word.en].correct++;
    else data[word.en].wrong++;
    data[word.en].ko = word.ko; // 한글 뜻 캐시
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ──────────────────────────────────────────────────────────────────────────
//  ⭐ 단어장 (즐겨찾기) — Phase 1 핵심
// ──────────────────────────────────────────────────────────────────────────

// 단어를 단어장에 추가 (이미 학습 기록 있으면 favorite만 ON)
export async function addToWordbook(studentName, word) {
  if (!studentName || !word?.en || !isSupabaseReady()) return false;
  
  try {
    const { data: existing } = await supabase
      .from("student_words")
      .select("id")
      .eq("student_name", studentName)
      .eq("word_en", word.en)
      .maybeSingle();
    
    const now = new Date().toISOString();
    
    if (existing) {
      await supabase.from("student_words").update({
        is_favorite: true,
        favorited_at: now,
        updated_at: now,
      }).eq("id", existing.id);
    } else {
      await supabase.from("student_words").insert({
        student_name: studentName,
        word_en: word.en,
        word_ko: word.ko,
        is_favorite: true,
        favorited_at: now,
        first_seen_at: now,
        last_studied_at: now,
      });
    }
    return true;
  } catch (e) {
    console.warn(`addToWordbook 실패:`, e.message);
    return false;
  }
}

// 단어를 단어장에서 제거 (학습 기록은 유지, favorite만 OFF)
export async function removeFromWordbook(studentName, wordEn) {
  if (!isSupabaseReady()) return false;
  try {
    await supabase
      .from("student_words")
      .update({ is_favorite: false, updated_at: new Date().toISOString() })
      .eq("student_name", studentName)
      .eq("word_en", wordEn);
    return true;
  } catch (e) {
    console.warn(`removeFromWordbook 실패:`, e.message);
    return false;
  }
}

// 학생의 단어장 (즐겨찾기 목록) 가져오기
export async function getWordbook(studentName) {
  if (!isSupabaseReady() || !studentName) return [];
  try {
    const { data, error } = await supabase
      .from("student_words")
      .select("*")
      .eq("student_name", studentName)
      .eq("is_favorite", true)
      .order("favorited_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      en: row.word_en,
      ko: row.word_ko,
      encounters: row.encounter_count,
      correct: row.correct_count,
      wrong: row.wrong_count,
      favoritedAt: row.favorited_at,
      lastStudiedAt: row.last_studied_at,
      reviewLevel: row.review_level,
    }));
  } catch (e) {
    console.warn(`getWordbook 실패:`, e.message);
    return [];
  }
}

// 특정 단어가 단어장에 있는지 빠르게 확인
export async function isInWordbook(studentName, wordEn) {
  if (!isSupabaseReady() || !studentName || !wordEn) return false;
  try {
    const { data } = await supabase
      .from("student_words")
      .select("is_favorite")
      .eq("student_name", studentName)
      .eq("word_en", wordEn)
      .maybeSingle();
    return data?.is_favorite === true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  🔔 망각 곡선 — Phase 2에서 사용 (지금은 컬럼만 준비됨)
// ──────────────────────────────────────────────────────────────────────────

// 오늘 복습해야 할 단어 가져오기
export async function getTodayReviewWords(studentName, limit = 20) {
  if (!isSupabaseReady() || !studentName) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("student_words")
      .select("*")
      .eq("student_name", studentName)
      .lte("next_review_date", today)
      .order("next_review_date", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(row => ({
      en: row.word_en,
      ko: row.word_ko,
      reviewLevel: row.review_level,
      nextReviewDate: row.next_review_date,
    }));
  } catch (e) {
    console.warn(`getTodayReviewWords 실패:`, e.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  📊 학생 학습 통계 (선생님 대시보드용)
// ──────────────────────────────────────────────────────────────────────────

export async function getStudentWordStats(studentName) {
  if (!isSupabaseReady() || !studentName) return null;
  try {
    const { data, error } = await supabase
      .from("student_words")
      .select("*")
      .eq("student_name", studentName);
    if (error) throw error;
    
    const total = data?.length || 0;
    const mastered = data?.filter(w => w.review_level >= 5).length || 0;
    const favorited = data?.filter(w => w.is_favorite).length || 0;
    const struggling = data?.filter(w => w.wrong_count > w.correct_count && w.encounter_count >= 2).length || 0;
    
    return { total, mastered, favorited, struggling };
  } catch (e) {
    console.warn(`getStudentWordStats 실패:`, e.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  🔙 기존 recordWrong 함수 호환 (게임 코드에서 그대로 동작)
//  games.js의 recordWrong을 더 강력한 recordWordEncounter로 라우팅
// ──────────────────────────────────────────────────────────────────────────
export function recordWordResult(studentName, wordEn, wordKo, isCorrect) {
  return recordWordEncounter(studentName, { en: wordEn, ko: wordKo || "" }, isCorrect);
}
