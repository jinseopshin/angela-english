"use client";
import { useState, useEffect } from "react";
import { getWordbook, removeFromWordbook } from "./studentWords";

// ══════════════════════════════════════════════════════════════════════════
//   📚 학생 단어장 (My Wordbook)
//
//   학생이 ⭐ 표시한 단어들을 모아서 보여주는 화면.
//   - 단어 목록 (검색/정렬)
//   - 발음 듣기 (탭하면 재생)
//   - 단어장으로 게임 시작
//   - 단어장에서 제거
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg: "#f0f7ff", card: "#ffffff", border: "#dce8ff",
  accent: "#4f8ef7", accentLight: "#e8f0ff",
  green: "#22c55e", greenLight: "#dcfce7",
  red: "#ef4444", redLight: "#fee2e2",
  yellow: "#f59e0b", yellowLight: "#fef3c7",
  purple: "#a855f7", purpleLight: "#f3e8ff",
  pink: "#ec4899", pinkLight: "#fce7f3",
  text: "#1e293b", textMid: "#64748b", textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
};

// 발음 재생 헬퍼
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  } catch {}
}

export function MyWordbook({ studentName, onStartGame, onExit }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // recent | alphabet | mastered

  // 단어장 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getWordbook(studentName);
      if (!cancelled) {
        setWords(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  // 단어장에서 제거
  const handleRemove = async (wordEn) => {
    if (!confirm(`"${wordEn}"을(를) 단어장에서 뺄까요?`)) return;
    await removeFromWordbook(studentName, wordEn);
    setWords(prev => prev.filter(w => w.en !== wordEn));
  };

  // 필터링 + 정렬
  const filtered = words
    .filter(w => !search.trim() ||
      w.en.toLowerCase().includes(search.toLowerCase()) ||
      w.ko.includes(search))
    .sort((a, b) => {
      if (sortBy === "alphabet") return a.en.localeCompare(b.en);
      if (sortBy === "mastered") return (b.reviewLevel || 0) - (a.reviewLevel || 0);
      // recent: 즐겨찾기에 추가한 순서
      return new Date(b.favoritedAt || 0) - new Date(a.favoritedAt || 0);
    });

  // 마스터된 단어 수
  const masteredCount = words.filter(w => (w.reviewLevel || 0) >= 5).length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", cursor: "pointer",
          color: T.accent, fontSize: 14, fontWeight: 700,
        }}>← 홈으로</button>
        <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>📚 내 단어장</div>
        <div style={{ width: 60 }} />
      </div>

      {/* 통계 카드 */}
      <div style={{
        background: `linear-gradient(135deg, ${T.purple} 0%, ${T.accent} 100%)`,
        borderRadius: 16, padding: 16, marginBottom: 14, color: "white",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>내가 모은 단어</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 2 }}>{words.length}<span style={{ fontSize: 14, opacity: 0.8 }}>개</span></div>
          </div>
          {masteredCount > 0 && (
            <div style={{ textAlign: "center", background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "8px 14px" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>🏆 {masteredCount}</div>
              <div style={{ fontSize: 10, opacity: 0.9 }}>마스터</div>
            </div>
          )}
        </div>
        {words.length >= 5 && (
          <button onClick={() => onStartGame && onStartGame(words)} style={{
            width: "100%", marginTop: 12, background: "white", color: T.purple,
            border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}>
            🎮 내 단어장으로 게임 시작!
          </button>
        )}
      </div>

      {/* 검색 + 정렬 */}
      {words.length > 0 && (
        <>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 단어 검색 (영어 또는 한글)"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 14px", borderRadius: 11,
              border: `1.5px solid ${T.border}`, fontSize: 13, marginBottom: 10, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "recent", label: "📅 최근 추가순" },
              { id: "alphabet", label: "🔤 알파벳순" },
              { id: "mastered", label: "🏆 숙련도순" },
            ].map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                padding: "6px 12px", borderRadius: 8, border: "none",
                fontSize: 11, fontWeight: 800, cursor: "pointer",
                background: sortBy === s.id ? T.purple : T.purpleLight,
                color: sortBy === s.id ? "white" : T.purple,
              }}>{s.label}</button>
            ))}
          </div>
        </>
      )}

      {/* 단어 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.textDim }}>
          단어장 불러오는 중...
        </div>
      ) : words.length === 0 ? (
        <div style={{
          background: T.card, borderRadius: 16, padding: 40, textAlign: "center",
          boxShadow: T.shadow,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 8 }}>
            아직 단어가 없어요!
          </div>
          <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>
            게임 중에 마음에 드는 단어가 나오면<br/>
            ⭐ 버튼을 눌러서 단어장에 추가해보세요!
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
          검색 결과가 없어요
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(w => {
            const accuracy = w.encounters > 0 ? Math.round(w.correct / w.encounters * 100) : 0;
            const lvl = w.reviewLevel || 0;
            return (
              <div key={w.en} style={{
                background: T.card, borderRadius: 12, padding: "12px 14px",
                boxShadow: T.shadow, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* 숙련도 별 */}
                <div style={{ fontSize: 18, flexShrink: 0 }}>
                  {lvl >= 5 ? "🏆" : lvl >= 3 ? "⭐" : lvl >= 1 ? "🌱" : "🌰"}
                </div>

                {/* 단어 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => speak(w.en)} style={{
                    fontSize: 16, fontWeight: 900, color: T.text, cursor: "pointer",
                    userSelect: "none", display: "inline-block",
                  }}>{w.en}</div>
                  <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>{w.ko}</div>
                  {w.encounters > 0 && (
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                      🎯 {w.encounters}번 · 정답률 {accuracy}%
                    </div>
                  )}
                </div>

                {/* 발음 버튼 */}
                <button onClick={() => speak(w.en)} title="발음 듣기" style={{
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: T.accentLight, color: T.accent, fontSize: 16, cursor: "pointer", flexShrink: 0,
                }}>🔊</button>

                {/* 제거 버튼 */}
                <button onClick={() => handleRemove(w.en)} title="단어장에서 빼기" style={{
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: T.redLight, color: T.red, fontSize: 14, cursor: "pointer", flexShrink: 0,
                }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* 안내 메시지 */}
      {words.length > 0 && words.length < 5 && (
        <div style={{
          marginTop: 16, padding: 12, background: T.yellowLight, borderRadius: 10,
          fontSize: 11, color: T.text, textAlign: "center", lineHeight: 1.6,
        }}>
          💡 단어를 5개 이상 모으면 단어장으로 게임을 시작할 수 있어요!
        </div>
      )}
    </div>
  );
}
