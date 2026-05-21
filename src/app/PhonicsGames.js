"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { T, Btn, Card } from "./theme";
import {
  ALPHABET_DATA, CVC_DATA, MAGIC_E_DATA, BLENDS_DATA, SIGHT_WORDS,
  PHONICS_LEVELS, getPhonicsWords, getFirstLetter, makeCVCBlank, makeAlphabetChoices,
  getStudentAssignedSets, getPublicSets, getCustomSet
} from "./phonicsData";
import {
  onCorrect, onWrong, onFinish, playClick, isSoundEnabled
} from "./soundEffects";
import { useAngela, getComboReaction, getFinishReaction, FullScreenConfetti } from "./AngelaMascot";
import { PhonicsClassMode } from "./PhonicsClassMode";
import { getCuratedImageUrl, hasCuratedImage } from "./phonicsImages";
import { filterPictureableWords } from "./pictureableWords";

// ══════════════════════════════════════════════════════════════════════════
//   🔤 PhonicsGames.js — 유치부 파닉스 게임 5종
// ══════════════════════════════════════════════════════════════════════════

// ── 헬퍼: TTS로 영어 발음 재생 ──
function speakEN(text, rate = 0.85) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!isSoundEnabled()) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = rate;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// ── 알파벳 한 글자만 천천히 발음 ──
function speakLetter(letter) {
  speakEN(letter, 0.7);
}

// ── 단어 발음 ──
function speakWord(word) {
  speakEN(word, 0.85);
}

// ── 게임 별 ⭐ 평가 ──
function getStars(score, total) {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

// ── localStorage에 진도 저장 ──
function saveProgress(studentName, gameId, levelId, score, total) {
  if (typeof window === "undefined" || !studentName) return;
  try {
    const key = `phonics_progress_${studentName}`;
    const stored = JSON.parse(window.localStorage.getItem(key) || "{}");
    const recordKey = `${levelId}_${gameId}`;
    const prev = stored[recordKey] || { bestStars: 0, plays: 0 };
    const stars = getStars(score, total);
    stored[recordKey] = {
      bestStars: Math.max(prev.bestStars, stars),
      lastScore: score,
      lastTotal: total,
      plays: prev.plays + 1,
      lastPlayed: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch {}
}

function getProgress(studentName) {
  if (typeof window === "undefined" || !studentName) return {};
  try {
    return JSON.parse(window.localStorage.getItem(`phonics_progress_${studentName}`) || "{}");
  } catch {
    return {};
  }
}

// ── Fisher-Yates 셔플 ──
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
//   📋 메인 메뉴: 파닉스 단계 선택
// ══════════════════════════════════════════════════════════════════════════
export function PhonicsMenu({ studentName, onExit }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedCustomSet, setSelectedCustomSet] = useState(null);
  const progress = useMemo(() => getProgress(studentName), [studentName]);

  // 학생에게 배정된 단어집 + 공개 단어집
  const myAssignedSets = useMemo(() => getStudentAssignedSets(studentName), [studentName]);
  const publicSets = useMemo(() => {
    // 배정된 것과 중복 제거
    const assignedIds = new Set(myAssignedSets.map(s => s.id));
    return getPublicSets().filter(s => !assignedIds.has(s.id));
  }, [myAssignedSets]);

  if (selectedCustomSet) {
    return (
      <CustomSetMenu
        studentName={studentName}
        customSet={selectedCustomSet}
        onBack={() => setSelectedCustomSet(null)}
        onExit={onExit}
      />
    );
  }

  if (selectedLevel) {
    return (
      <PhonicsGameMenu
        studentName={studentName}
        levelId={selectedLevel}
        onBack={() => setSelectedLevel(null)}
        onExit={onExit}
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
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>🔤 파닉스 학습</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>알파벳부터 차근차근 배워봐요!</div>
        </div>
      </div>

      {/* 📦 내 단어집 (선생님이 배정한 것) */}
      {myAssignedSets.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: T.text,
            marginBottom: 8, display: "flex", alignItems: "center", gap: 6
          }}>
            <span style={{ fontSize: 16 }}>⭐</span>
            선생님이 내준 단어집
            <span style={{
              fontSize: 10, background: T.accent, color: "white",
              padding: "2px 8px", borderRadius: 8, marginLeft: 4
            }}>{myAssignedSets.length}</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {myAssignedSets.map(set => {
              const level = PHONICS_LEVELS.find(l => l.id === set.levelId);
              return (
                <Card key={set.id} onClick={() => { playClick(); setSelectedCustomSet(set); }}
                  style={{
                    padding: 12, cursor: "pointer",
                    background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
                    color: "white", border: "none",
                    display: "flex", alignItems: "center", gap: 12
                  }}>
                  <div style={{
                    width: 40, height: 40, background: "rgba(255,255,255,0.25)",
                    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22
                  }}>{level?.icon || "📚"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{set.name}</div>
                    <div style={{ fontSize: 10, opacity: 0.95, marginTop: 2 }}>
                      {level?.label} · {set.words?.length || 0}개 단어
                    </div>
                  </div>
                  <div style={{ fontSize: 20, opacity: 0.8 }}>›</div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 🌐 공개 단어집 (누구나 풀 수 있음) */}
      {publicSets.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: T.text,
            marginBottom: 8, display: "flex", alignItems: "center", gap: 6
          }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            누구나 풀 수 있는 단어집
            <span style={{
              fontSize: 10, background: T.green, color: "white",
              padding: "2px 8px", borderRadius: 8, marginLeft: 4
            }}>{publicSets.length}</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {publicSets.map(set => {
              const level = PHONICS_LEVELS.find(l => l.id === set.levelId);
              return (
                <Card key={set.id} onClick={() => { playClick(); setSelectedCustomSet(set); }}
                  style={{
                    padding: 12, cursor: "pointer",
                    background: T.card,
                    border: `2px solid ${level?.color || T.green}`,
                    display: "flex", alignItems: "center", gap: 12
                  }}>
                  <div style={{
                    width: 40, height: 40, background: level?.bg || T.bg,
                    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22
                  }}>{level?.icon || "📚"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: T.text }}>{set.name}</div>
                    <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>
                      {level?.label} · {set.words?.length || 0}개 단어
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: T.textDim }}>›</div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 📚 기본 단계 */}
      <div style={{
        fontSize: 13, fontWeight: 800, color: T.text,
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6
      }}>
        <span style={{ fontSize: 16 }}>📚</span>
        기본 단계
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {PHONICS_LEVELS.map((lv, idx) => {
          // 이 단계에서 가장 잘 한 게임의 별 수
          const stars = Math.max(
            ...["alphabet-sound", "first-sound", "cvc-blank", "picture-letter", "build-word"]
              .map(g => (progress[`${lv.id}_${g}`]?.bestStars || 0))
          );
          return (
            <Card key={lv.id} onClick={() => { playClick(); setSelectedLevel(lv.id); }}
              style={{
                padding: 14,
                background: `linear-gradient(135deg, ${lv.bg}, white)`,
                borderLeft: `5px solid ${lv.color}`,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14
              }}>
              <div style={{ fontSize: 36 }}>{lv.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>STEP {idx+1}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{lv.label}</span>
                </div>
                <div style={{ fontSize: 10, color: T.textMid, marginBottom: 4 }}>{lv.desc}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[1, 2, 3].map(i => (
                    <span key={i} style={{ fontSize: 13, opacity: stars >= i ? 1 : 0.25 }}>⭐</span>
                  ))}
                  <span style={{ fontSize: 10, color: T.textDim, marginLeft: 4 }}>
                    · {lv.count}개 단어
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 20, color: T.textDim }}>›</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   📦 커스텀 단어집 메뉴 — 수업모드 + 게임 선택
// ══════════════════════════════════════════════════════════════════════════
function CustomSetMenu({ studentName, customSet, onBack, onExit }) {
  const [mode, setMode] = useState(null); // "class" | game-id
  const level = PHONICS_LEVELS.find(l => l.id === customSet.levelId);

  // 수업 모드
  if (mode === "class") {
    return (
      <PhonicsClassMode
        words={customSet.words}
        title={customSet.name}
        levelId={customSet.levelId}
        onExit={() => setMode(null)}
      />
    );
  }

  // 게임 모드 (커스텀 단어집 사용)
  if (mode) {
    return (
      <CustomSetGameRunner
        studentName={studentName}
        customSet={customSet}
        gameId={mode}
        onBack={() => setMode(null)}
        onExit={onExit}
      />
    );
  }

  // 메뉴 화면
  const availableGames = [
    { id: "class", icon: "📖", label: "수업 모드", desc: "선생님과 같이 보며 천천히 익혀요", featured: true },
    { id: "first-sound", icon: "🎵", label: "첫소리 맞추기", desc: "단어 듣고 첫글자 고르기" },
    { id: "picture-letter", icon: "🖼️", label: "그림 보고 첫글자", desc: "이모지 보고 알파벳 고르기" },
    { id: "build-word", icon: "🧩", label: "단어 만들기", desc: "소리 듣고 순서대로 클릭" },
  ];

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
            {level?.icon} {customSet.name}
          </div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>
            {level?.label} · {customSet.words?.length || 0}개 단어
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {availableGames.map(g => (
          <Card key={g.id} onClick={() => { playClick(); setMode(g.id); }}
            style={{
              padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              background: g.featured
                ? `linear-gradient(135deg, ${T.green}, ${T.accent})`
                : T.card,
              color: g.featured ? "white" : T.text,
              border: g.featured ? "none" : `2px solid ${T.border}`,
            }}>
            <div style={{
              width: 48, height: 48,
              background: g.featured ? "rgba(255,255,255,0.25)" : (level?.bg || T.bg),
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24
            }}>{g.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{g.label}</div>
              <div style={{
                fontSize: 10,
                color: g.featured ? "rgba(255,255,255,0.95)" : T.textMid,
                marginTop: 2
              }}>{g.desc}</div>
            </div>
            <div style={{ fontSize: 18, opacity: g.featured ? 0.85 : 0.5 }}>›</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   🎮 커스텀 단어집 게임 실행기
// ══════════════════════════════════════════════════════════════════════════
function CustomSetGameRunner({ studentName, customSet, gameId, onBack, onExit }) {
  const customWords = customSet.words;
  const levelId = customSet.levelId || "cvc"; // 기본값
  const props = { studentName, levelId, gameId: `custom_${customSet.id}_${gameId}`, onBack, onExit, customWords };

  switch (gameId) {
    case "first-sound":     return <FirstSoundGame {...props} />;
    case "picture-letter":  return <PictureLetterGame {...props} />;
    case "build-word":      return <BuildWordGame {...props} />;
    default:
      return (
        <div style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.red, marginBottom: 12 }}>지원하지 않는 게임</div>
          <button onClick={onBack} style={{
            padding: "10px 20px", background: T.accent,
            color: "white", border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: "pointer"
          }}>← 뒤로</button>
        </div>
      );
  }
}

// ══════════════════════════════════════════════════════════════════════════
//   📂 단계별 게임 선택 메뉴
// ══════════════════════════════════════════════════════════════════════════
function PhonicsGameMenu({ studentName, levelId, onBack, onExit }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showClassMode, setShowClassMode] = useState(false);
  const level = PHONICS_LEVELS.find(l => l.id === levelId);
  const progress = useMemo(() => getProgress(studentName), [studentName, selectedGame]);

  // 단계별 사용 가능한 게임 목록
  const games = useMemo(() => {
    const all = [
      { id: "alphabet-sound",  icon: "🔊", label: "알파벳 소리 듣기",   desc: "글자 보고 소리 따라하기", levels: ["alphabet"] },
      { id: "first-sound",     icon: "🎵", label: "첫소리 맞추기",       desc: "단어 듣고 첫글자 고르기", levels: ["alphabet", "cvc", "blends"] },
      { id: "cvc-blank",       icon: "🔤", label: "CVC 빈칸 채우기",     desc: "c_t 보고 가운데 모음 고르기", levels: ["cvc"] },
      { id: "picture-letter",  icon: "🖼️", label: "그림 보고 첫글자",   desc: "이모지 보고 알파벳 고르기", levels: ["alphabet", "cvc", "blends", "sight"] },
      { id: "build-word",      icon: "🧩", label: "단어 만들기",        desc: "소리 듣고 순서대로 클릭", levels: ["cvc", "magic-e", "blends"] },
    ];
    return all.filter(g => g.levels.includes(levelId));
  }, [levelId]);

  // 수업 모드용 단어 (현재 단계의 모든 단어)
  const classWords = useMemo(() => getPhonicsWords(levelId), [levelId]);

  if (showClassMode) {
    return (
      <PhonicsClassMode
        words={classWords}
        title={level?.label}
        levelId={levelId}
        onExit={() => setShowClassMode(false)}
      />
    );
  }

  if (selectedGame) {
    return (
      <PhonicsGameRunner
        studentName={studentName}
        levelId={levelId}
        gameId={selectedGame}
        onBack={() => setSelectedGame(null)}
        onExit={onExit}
      />
    );
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 뒤로</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
            {level?.icon} {level?.label}
          </div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{level?.desc}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {/* 📖 수업 모드 (눈에 띄게 - 첫 번째) */}
        <Card onClick={() => { playClick(); setShowClassMode(true); }}
          style={{
            padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
            background: `linear-gradient(135deg, ${T.green}, ${T.accent})`,
            color: "white", border: "none"
          }}>
          <div style={{
            width: 48, height: 48, background: "rgba(255,255,255,0.25)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24
          }}>📖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>수업 모드</div>
            <div style={{ fontSize: 10, opacity: 0.95, marginTop: 2 }}>
              선생님과 같이 보며 천천히 익혀요
            </div>
          </div>
          <div style={{ fontSize: 18, opacity: 0.85 }}>›</div>
        </Card>

        {games.map(g => {
          const rec = progress[`${levelId}_${g.id}`];
          const stars = rec?.bestStars || 0;
          return (
            <Card key={g.id} onClick={() => { playClick(); setSelectedGame(g.id); }}
              style={{
                padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer"
              }}>
              <div style={{
                width: 48, height: 48, background: level?.bg, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24
              }}>{g.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{g.label}</div>
                <div style={{ fontSize: 10, color: T.textMid, marginTop: 2 }}>{g.desc}</div>
                <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                  {[1, 2, 3].map(i => (
                    <span key={i} style={{ fontSize: 12, opacity: stars >= i ? 1 : 0.25 }}>⭐</span>
                  ))}
                  {rec?.plays > 0 && (
                    <span style={{ fontSize: 9, color: T.textDim, marginLeft: 6 }}>
                      · {rec.plays}회 도전
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 18, color: T.textDim }}>›</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   🎮 게임 실행기 — 게임 ID에 따라 적절한 게임 컴포넌트 실행
// ══════════════════════════════════════════════════════════════════════════
function PhonicsGameRunner({ studentName, levelId, gameId, onBack, onExit }) {
  const props = { studentName, levelId, gameId, onBack, onExit };
  switch (gameId) {
    case "alphabet-sound":  return <AlphabetSoundGame {...props} />;
    case "first-sound":     return <FirstSoundGame {...props} />;
    case "cvc-blank":       return <CVCBlankGame {...props} />;
    case "picture-letter":  return <PictureLetterGame {...props} />;
    case "build-word":      return <BuildWordGame {...props} />;
    default: return <div>지원하지 않는 게임</div>;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//   GAME 1: 🔊 알파벳 소리 듣고 따라하기
//   - 알파벳 보고 클릭 → 글자/소리/대표단어/이모지 표시
//   - "들었어요!" 버튼 누르면 다음 글자
//   - 학습형 게임 (정/오답 없음, 완주 시 별 3개)
// ══════════════════════════════════════════════════════════════════════════
function AlphabetSoundGame({ studentName, levelId, gameId, onBack, onExit }) {
  const [order] = useState(() => shuffle(ALPHABET_DATA));
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = order[idx];

  useEffect(() => {
    // 자동 발음 재생
    if (current) {
      const t = setTimeout(() => {
        speakLetter(current.letter);
        setTimeout(() => speakWord(current.word), 1000);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [idx]);

  const next = () => {
    playClick();
    if (idx < order.length - 1) {
      setIdx(i => i + 1);
    } else {
      setDone(true);
      saveProgress(studentName, gameId, levelId, order.length, order.length);
      setConfettiTrigger(t => t + 1);
      angela.show("perfect");
      onFinish(order.length, order.length);
    }
  };

  if (done) {
    return (
      <FinishScreen
        score={order.length} total={order.length}
        levelId={levelId} onBack={onBack} onExit={onExit}
      />
    );
  }

  if (!current) {
    return <EmptyPoolMessage onBack={onBack} />;
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <GameHeader
        onBack={onBack}
        title="🔊 알파벳 소리 듣기"
        progress={idx + 1}
        total={order.length}
      />

      <div style={{
        background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
        borderRadius: 24, padding: "40px 24px", textAlign: "center",
        color: "white", marginBottom: 20
      }}>
        {/* 큰 알파벳 */}
        <div style={{
          fontSize: 140, fontWeight: 900, lineHeight: 1,
          marginBottom: 8, textShadow: "0 4px 12px rgba(0,0,0,0.2)"
        }}>
          {current.letter}<span style={{ opacity: 0.6, fontSize: 80 }}>{current.letter.toLowerCase()}</span>
        </div>
        <div style={{ fontSize: 18, opacity: 0.9, marginBottom: 16 }}>
          {current.sound}
        </div>

        <div style={{ fontSize: 90, marginBottom: 8 }}>{current.emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{current.word}</div>
        <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{current.ko}</div>
      </div>

      {/* 다시 듣기 */}
      <button onClick={() => { speakLetter(current.letter); setTimeout(() => speakWord(current.word), 1000); }}
        style={{
          width: "100%", padding: 14, background: T.card,
          border: `2px solid ${T.accent}`, borderRadius: 14, marginBottom: 12,
          fontSize: 14, fontWeight: 800, color: T.accent, cursor: "pointer"
        }}>
        🔊 다시 듣기
      </button>

      {/* 다음 */}
      <button onClick={next} style={{
        width: "100%", padding: 18, background: T.green,
        color: "white", border: "none", borderRadius: 14,
        fontSize: 16, fontWeight: 900, cursor: "pointer"
      }}>
        {idx < order.length - 1 ? "다음 →" : "끝내기 ✨"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   GAME 2: 🎵 첫소리 맞추기
//   - 단어 듣기 + 그림 → 첫글자 4지선다
// ══════════════════════════════════════════════════════════════════════════
function FirstSoundGame({ studentName, levelId, gameId, onBack, onExit, customWords }) {
  const [rounds] = useState(() => {
    const all = customWords || getPhonicsWords(levelId);
    return shuffle(all).slice(0, Math.min(10, all.length));
  });
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [done, setDone] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = rounds[idx];
  const choices = useMemo(() => current ? makeAlphabetChoices(getFirstLetter(current.word)) : [], [current]);

  useEffect(() => {
    if (current && !feedback) {
      const t = setTimeout(() => speakWord(current.word), 300);
      return () => clearTimeout(t);
    }
  }, [idx, feedback]);

  const handleChoice = (letter) => {
    if (feedback) return;
    const correct = letter === getFirstLetter(current.word);
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      onCorrect();
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 1);
      if (newCombo >= 3) {
        setTimeout(() => angela.show(getComboReaction(newCombo)), 200);
      } else {
        setTimeout(() => angela.show("correct"), 200);
      }
    } else {
      onWrong();
      setCombo(0);
      setTimeout(() => angela.show("wrong"), 200);
    }
    setTimeout(() => {
      if (idx < rounds.length - 1) {
        setIdx(i => i + 1);
        setFeedback(null);
      } else {
        const final = score + (correct ? 1 : 0);
        setDone(true);
        saveProgress(studentName, gameId, levelId, final, rounds.length);
        onFinish(final, rounds.length);
        setTimeout(() => angela.show(getFinishReaction(final, rounds.length)), 500);
        if (final / rounds.length >= 0.8) setConfettiTrigger(t => t + 1);
      }
    }, 1200);
  };

  if (done) {
    return <FinishScreen score={score} total={rounds.length} levelId={levelId} onBack={onBack} onExit={onExit} />;
  }

  if (!current) {
    return <EmptyPoolMessage onBack={onBack} />;
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <angela.AngelaComponent />
      <GameHeader
        onBack={onBack}
        title="🎵 첫소리 맞추기"
        progress={idx + 1}
        total={rounds.length}
        score={score}
        combo={combo}
      />

      <div style={{
        background: T.card, borderRadius: 24, padding: "30px 20px",
        textAlign: "center", marginBottom: 16, border: `2px solid ${T.border}`
      }}>
        <div style={{ fontSize: 100, marginBottom: 8 }}>{current.emoji}</div>
        <button onClick={() => speakWord(current.word)}
          style={{
            background: T.accent, color: "white",
            border: "none", borderRadius: 16, padding: "12px 20px",
            fontSize: 16, fontWeight: 800, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8
          }}>
          🔊 다시 듣기
        </button>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 12 }}>
          첫 글자는 무엇일까요?
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {choices.map(letter => {
          const correct = letter === getFirstLetter(current.word);
          const isAnswered = feedback !== null;
          let bg = T.card, color = T.text, border = T.border;
          if (isAnswered) {
            if (correct) { bg = T.green; color = "white"; border = T.green; }
          }
          return (
            <button key={letter} onClick={() => handleChoice(letter)}
              disabled={isAnswered}
              style={{
                background: bg, color, border: `3px solid ${border}`,
                borderRadius: 16, padding: "30px 0",
                fontSize: 56, fontWeight: 900,
                cursor: isAnswered ? "default" : "pointer",
                transition: "all 0.2s"
              }}>
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   GAME 3: 🔤 CVC 빈칸 채우기 (c_t)
// ══════════════════════════════════════════════════════════════════════════
function CVCBlankGame({ studentName, levelId, gameId, onBack, onExit }) {
  const [rounds] = useState(() => {
    const all = getPhonicsWords("cvc").filter(w => w.word.length === 3);
    return shuffle(all).slice(0, 10);
  });
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = rounds[idx];
  const parts = useMemo(() => current ? makeCVCBlank(current.word) : null, [current]);

  // 4지선다 모음 (정답 + 오답 3개)
  const choices = useMemo(() => {
    if (!parts) return [];
    const vowels = ["a", "e", "i", "o", "u"];
    const wrongs = vowels.filter(v => v !== parts.missing);
    const picks = shuffle(wrongs).slice(0, 3);
    return shuffle([...picks, parts.missing]);
  }, [parts]);

  useEffect(() => {
    if (current && !feedback) {
      const t = setTimeout(() => speakWord(current.word), 300);
      return () => clearTimeout(t);
    }
  }, [idx, feedback]);

  const handleChoice = (vowel) => {
    if (feedback) return;
    const correct = vowel === parts.missing;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      onCorrect();
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 1);
      if (newCombo >= 3) {
        setTimeout(() => angela.show(getComboReaction(newCombo)), 200);
      } else {
        setTimeout(() => angela.show("correct"), 200);
      }
    } else {
      onWrong();
      setCombo(0);
      setTimeout(() => angela.show("wrong"), 200);
    }
    setTimeout(() => {
      if (idx < rounds.length - 1) {
        setIdx(i => i + 1);
        setFeedback(null);
      } else {
        const final = score + (correct ? 1 : 0);
        setDone(true);
        saveProgress(studentName, gameId, levelId, final, rounds.length);
        onFinish(final, rounds.length);
        setTimeout(() => angela.show(getFinishReaction(final, rounds.length)), 500);
        if (final / rounds.length >= 0.8) setConfettiTrigger(t => t + 1);
      }
    }, 1200);
  };

  if (done) {
    return <FinishScreen score={score} total={rounds.length} levelId={levelId} onBack={onBack} onExit={onExit} />;
  }

  if (!current) {
    return <EmptyPoolMessage onBack={onBack} />;
  }

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <angela.AngelaComponent />
      <GameHeader
        onBack={onBack}
        title="🔤 빈칸 채우기"
        progress={idx + 1}
        total={rounds.length}
        score={score}
        combo={combo}
      />

      <div style={{
        background: T.card, borderRadius: 24, padding: "30px 20px",
        textAlign: "center", marginBottom: 16, border: `2px solid ${T.border}`
      }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>{current.emoji}</div>
        <div style={{ fontSize: 14, color: T.textMid, marginBottom: 4 }}>{current.ko}</div>

        {/* 단어 빈칸 */}
        <div style={{
          fontSize: 72, fontWeight: 900, fontFamily: "monospace",
          marginTop: 12, marginBottom: 16, color: T.text,
          letterSpacing: 8
        }}>
          {parts.prefix}
          <span style={{
            display: "inline-block", minWidth: 60,
            color: feedback === "correct" ? T.green : T.orange,
            background: feedback ? "transparent" : T.yellowLight,
            borderRadius: 8, padding: "0 4px"
          }}>
            {feedback ? parts.missing : "_"}
          </span>
          {parts.suffix}
        </div>

        <button onClick={() => speakWord(current.word)}
          style={{
            background: T.accent, color: "white",
            border: "none", borderRadius: 12, padding: "10px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>
          🔊 소리 듣기
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {choices.map(vowel => {
          const correct = vowel === parts.missing;
          const isAnswered = feedback !== null;
          let bg = T.card, color = T.text, border = T.border;
          if (isAnswered && correct) { bg = T.green; color = "white"; border = T.green; }
          return (
            <button key={vowel} onClick={() => handleChoice(vowel)}
              disabled={isAnswered}
              style={{
                background: bg, color, border: `3px solid ${border}`,
                borderRadius: 16, padding: "26px 0",
                fontSize: 48, fontWeight: 900,
                cursor: isAnswered ? "default" : "pointer",
                transition: "all 0.2s"
              }}>
              {vowel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   GAME 4: 🖼️ 그림 보고 첫글자 고르기 (Cloudinary 큐레이션 이미지)
//   - 큐레이션 이미지 URL 직접 사용 (API 호출 X)
//   - 없는 단어는 자동으로 단어 풀에서 제외
//   - 💡 힌트 버튼 유지
//   - 이미지 로드 실패 시 이모지 폴백
// ══════════════════════════════════════════════════════════════════════════
function PictureLetterGame({ studentName, levelId, gameId, onBack, onExit, customWords }) {
  const [rounds] = useState(() => {
    const source = customWords || getPhonicsWords(levelId);
    // 1단계: 추상 단어 필터링 (big, hot, the, and 등 제외)
    const pictureable = filterPictureableWords(source);
    // 2단계: 큐레이션 이미지가 있는 단어만 사용 (커스텀 단어집은 예외)
    const withImages = customWords
      ? pictureable  // 커스텀 단어집은 이모지 폴백 허용
      : pictureable.filter(w => hasCuratedImage(w.word));
    return shuffle(withImages).slice(0, Math.min(10, withImages.length));
  });
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [imageError, setImageError] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = rounds[idx];
  const choices = useMemo(() => current ? makeAlphabetChoices(getFirstLetter(current.word)) : [], [current]);
  const imageUrl = useMemo(() => current ? getCuratedImageUrl(current.word) : null, [current]);

  // 단어 바뀔 때 힌트/에러 초기화
  useEffect(() => {
    setShowHint(false);
    setImageError(false);
  }, [idx]);

  const handleChoice = (letter) => {
    if (feedback) return;
    const correct = letter === getFirstLetter(current.word);
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      onCorrect();
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 1);
      setTimeout(() => speakWord(current.word), 200);
      if (newCombo >= 3) {
        setTimeout(() => angela.show(getComboReaction(newCombo)), 400);
      } else {
        setTimeout(() => angela.show("correct"), 400);
      }
    } else {
      onWrong();
      setCombo(0);
      setTimeout(() => angela.show("wrong"), 200);
    }
    setTimeout(() => {
      if (idx < rounds.length - 1) {
        setIdx(i => i + 1);
        setFeedback(null);
      } else {
        const final = score + (correct ? 1 : 0);
        setDone(true);
        saveProgress(studentName, gameId, levelId, final, rounds.length);
        onFinish(final, rounds.length);
        setTimeout(() => angela.show(getFinishReaction(final, rounds.length)), 500);
        if (final / rounds.length >= 0.8) setConfettiTrigger(t => t + 1);
      }
    }, 1500);
  };

  const handleHint = () => {
    playClick();
    setShowHint(true);
  };

  if (done) {
    return <FinishScreen score={score} total={rounds.length} levelId={levelId} onBack={onBack} onExit={onExit} />;
  }

  if (!current) {
    return <EmptyPoolMessage onBack={onBack} message="이 단계엔 그림으로 풀 수 있는 단어가 없어요" />;
  }

  const restOfWord = current.word.slice(1);

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <angela.AngelaComponent />
      <GameHeader
        onBack={onBack}
        title="🖼️ 그림 보고 첫글자"
        progress={idx + 1}
        total={rounds.length}
        score={score}
        combo={combo}
      />

      <div style={{
        background: `linear-gradient(135deg, ${T.yellowLight}, ${T.pinkLight})`,
        borderRadius: 24, padding: "30px 20px 24px",
        textAlign: "center", marginBottom: 16,
        position: "relative"
      }}>
        {/* 💡 힌트 버튼 */}
        {!showHint && feedback === null && (
          <button
            onClick={handleHint}
            title="힌트 보기"
            style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(255,255,255,0.85)",
              border: `1.5px solid ${T.orange}`,
              borderRadius: 20, padding: "6px 12px",
              fontSize: 12, fontWeight: 800,
              color: T.orange, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
            }}
          >
            💡 힌트
          </button>
        )}

        {/* 이미지 영역 */}
        <div style={{
          width: "100%", maxWidth: 320, height: 240,
          margin: "0 auto 14px",
          borderRadius: 16, overflow: "hidden",
          background: "rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={current.word}
              onError={() => setImageError(true)}
              style={{
                width: "100%", height: "100%",
                objectFit: "cover", display: "block"
              }}
            />
          ) : (
            // 이모지 폴백 (커스텀 단어집이거나 이미지 로드 실패 시)
            <div style={{ fontSize: 130, lineHeight: 1 }}>{current.emoji}</div>
          )}
        </div>

        <div style={{ fontSize: 13, color: T.textMid, fontWeight: 700 }}>
          이 그림의 첫 글자는?
        </div>

        {/* 💡 힌트 표시 */}
        {showHint && feedback === null && (
          <div style={{
            marginTop: 12,
            display: "inline-flex", gap: 4,
            background: "rgba(255,255,255,0.7)",
            padding: "8px 16px", borderRadius: 12,
            border: `1.5px dashed ${T.orange}`,
            fontFamily: "monospace", letterSpacing: 2
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: T.orange }}>_</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{restOfWord}</span>
          </div>
        )}

        {/* 정답 시: 단어 + 한글 뜻 */}
        {feedback === "correct" && (
          <div style={{ fontSize: 26, fontWeight: 900, color: T.green, marginTop: 10 }}>
            {current.word} <span style={{ fontSize: 16, opacity: 0.85 }}>({current.ko})</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {choices.map(letter => {
          const correct = letter === getFirstLetter(current.word);
          const isAnswered = feedback !== null;
          let bg = T.card, color = T.text, border = T.border;
          if (isAnswered && correct) { bg = T.green; color = "white"; border = T.green; }
          return (
            <button key={letter} onClick={() => handleChoice(letter)}
              disabled={isAnswered}
              style={{
                background: bg, color, border: `3px solid ${border}`,
                borderRadius: 16, padding: "28px 0",
                fontSize: 52, fontWeight: 900,
                cursor: isAnswered ? "default" : "pointer",
                transition: "all 0.2s"
              }}>
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   GAME 5: 🧩 소리 듣고 단어 만들기 (c-a-t 순서대로)
// ══════════════════════════════════════════════════════════════════════════
// ── 공통: 단어 풀이 비어있을 때 안내 ──
function EmptyPoolMessage({ onBack, message }) {
  return (
    <div style={{ padding: 20, maxWidth: 480, margin: "40px auto 0", textAlign: "center" }}>
      <div style={{ fontSize: 60, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>
        {message || "이 단계엔 풀 단어가 없어요"}
      </div>
      <button onClick={onBack} style={{
        marginTop: 16, padding: "12px 24px", background: T.accent,
        color: "white", border: "none", borderRadius: 12,
        fontSize: 13, fontWeight: 800, cursor: "pointer"
      }}>← 뒤로</button>
    </div>
  );
}

function BuildWordGame({ studentName, levelId, gameId, onBack, onExit, customWords }) {
  const [rounds] = useState(() => {
    // 단어 만들기는 3~5글자 단어만 사용 (UI 그리드 깨짐 방지)
    const source = customWords || getPhonicsWords(levelId);
    const all = source.filter(w => w.word && w.word.length >= 3 && w.word.length <= 5);
    return shuffle(all).slice(0, 10);
  });
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [builtLetters, setBuiltLetters] = useState([]); // 학생이 클릭한 순서
  const [done, setDone] = useState(false);
  const angela = useAngela();
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const current = rounds[idx];
  const targetWord = current?.word.toLowerCase() || "";

  // 단어의 글자를 객체 배열로 (중복 글자도 별개 entry로 다룸)
  // 예: "egg" → [{id:0, letter:"e"}, {id:1, letter:"g"}, {id:2, letter:"g"}]
  const letterChoices = useMemo(() => {
    if (!current || !targetWord) return [];
    // 단어 글자 (중복 포함)
    const wordEntries = targetWord.split("").map((letter, i) => ({
      id: `w${i}`, letter
    }));
    // 단어에 없는 글자 중 오답 2개 추가 (단어가 짧으면 늘림)
    const allLetters = "abcdefghijklmnopqrstuvwxyz".split("");
    const inWord = new Set(targetWord);
    const wrongs = allLetters.filter(l => !inWord.has(l));
    const wrongCount = Math.max(2, Math.min(3, 7 - targetWord.length));
    const wrongPicks = shuffle(wrongs).slice(0, wrongCount);
    const wrongEntries = wrongPicks.map((letter, i) => ({
      id: `x${i}`, letter
    }));
    return shuffle([...wordEntries, ...wrongEntries]);
  }, [current, targetWord]);

  useEffect(() => {
    if (current && !feedback) {
      setBuiltLetters([]);
      const t = setTimeout(() => speakWord(current.word), 300);
      return () => clearTimeout(t);
    }
  }, [idx, feedback]);

  const handleLetterClick = (entry) => {
    if (feedback) return;
    const nextLetters = [...builtLetters, entry];
    setBuiltLetters(nextLetters);
    playClick();

    // 단어 완성됐는지 체크
    if (nextLetters.length === targetWord.length) {
      const built = nextLetters.map(l => l.letter).join("");
      const correct = built === targetWord;
      setFeedback(correct ? "correct" : "wrong");
      if (correct) {
        onCorrect();
        const newCombo = combo + 1;
        setCombo(newCombo);
        setScore(s => s + 1);
        setTimeout(() => speakWord(current.word), 200);
        if (newCombo >= 3) {
          setTimeout(() => angela.show(getComboReaction(newCombo)), 400);
        } else {
          setTimeout(() => angela.show("correct"), 400);
        }
      } else {
        onWrong();
        setCombo(0);
        setTimeout(() => angela.show("wrong"), 200);
      }
      setTimeout(() => {
        if (idx < rounds.length - 1) {
          setIdx(i => i + 1);
          setFeedback(null);
        } else {
          const final = score + (correct ? 1 : 0);
          setDone(true);
          saveProgress(studentName, gameId, levelId, final, rounds.length);
          onFinish(final, rounds.length);
          setTimeout(() => angela.show(getFinishReaction(final, rounds.length)), 500);
          if (final / rounds.length >= 0.8) setConfettiTrigger(t => t + 1);
        }
      }, 1800);
    }
  };

  const undo = () => {
    if (feedback) return;
    playClick();
    setBuiltLetters(prev => prev.slice(0, -1));
  };

  // rounds가 비어있으면 — 단어가 없는 경우
  if (!current) {
    return <EmptyPoolMessage onBack={onBack} message="이 단계엔 단어 만들기를 할 단어가 없어요 (3-5글자 단어만 지원)" />;
  }

  if (done) {
    return <FinishScreen score={score} total={rounds.length} levelId={levelId} onBack={onBack} onExit={onExit} />;
  }

  // 글자 보기 동적 그리드 (5개 이하면 한 줄, 6개 이상이면 두 줄)
  const cols = Math.min(5, letterChoices.length);

  return (
    <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
      <FullScreenConfetti trigger={confettiTrigger} />
      <angela.AngelaComponent />
      <GameHeader
        onBack={onBack}
        title="🧩 단어 만들기"
        progress={idx + 1}
        total={rounds.length}
        score={score}
        combo={combo}
      />

      <div style={{
        background: T.card, borderRadius: 24, padding: "24px 16px",
        textAlign: "center", marginBottom: 16, border: `2px solid ${T.border}`
      }}>
        <div style={{ fontSize: 80, marginBottom: 6 }}>{current.emoji}</div>
        <div style={{ fontSize: 12, color: T.textMid, marginBottom: 12 }}>{current.ko}</div>

        <button onClick={() => speakWord(current.word)}
          style={{
            background: T.accent, color: "white",
            border: "none", borderRadius: 12, padding: "10px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16
          }}>
          🔊 다시 듣기
        </button>

        {/* 만들고 있는 단어 */}
        <div style={{
          display: "flex", gap: 6, justifyContent: "center", marginBottom: 8, flexWrap: "wrap"
        }}>
          {Array.from({ length: targetWord.length }).map((_, i) => {
            const built = builtLetters[i];
            const isCorrect = feedback === "correct";
            const isWrong = feedback === "wrong";
            return (
              <div key={i} style={{
                width: 48, height: 56,
                background: built
                  ? (isCorrect ? T.green : isWrong ? "#fecaca" : T.accentLight)
                  : T.bg,
                border: `2px solid ${built
                  ? (isCorrect ? T.green : isWrong ? T.red : T.accent)
                  : T.border}`,
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 900,
                color: built
                  ? (isCorrect ? "white" : isWrong ? T.red : T.accent)
                  : T.textDim,
                fontFamily: "monospace"
              }}>
                {built ? built.letter : "_"}
              </div>
            );
          })}
        </div>

        {builtLetters.length > 0 && !feedback && (
          <button onClick={undo} style={{
            background: "transparent", color: T.textMid,
            border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "4px 10px", fontSize: 11, fontWeight: 700,
            cursor: "pointer", marginTop: 6
          }}>
            ← 되돌리기
          </button>
        )}

        {feedback === "wrong" && (
          <div style={{ fontSize: 13, color: T.red, fontWeight: 700, marginTop: 10 }}>
            정답: <strong style={{ fontSize: 16 }}>{current.word}</strong>
          </div>
        )}
      </div>

      {/* 글자 보기 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8
      }}>
        {letterChoices.map((entry) => {
          const used = builtLetters.some(b => b.id === entry.id);
          return (
            <button key={entry.id} onClick={() => handleLetterClick(entry)}
              disabled={used || feedback !== null}
              style={{
                background: used ? T.border : T.card,
                color: used ? T.textDim : T.text,
                border: `2px solid ${used ? T.border : T.accent}`,
                borderRadius: 12, padding: "16px 0",
                fontSize: 28, fontWeight: 900,
                cursor: used || feedback ? "default" : "pointer",
                opacity: used ? 0.4 : 1,
                transition: "all 0.2s"
              }}>
              {entry.letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   공통: 게임 헤더 (뒤로/제목/진행률/점수/콤보)
// ══════════════════════════════════════════════════════════════════════════
function GameHeader({ onBack, title, progress, total, score, combo }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={onBack} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.textMid
        }}>← 그만</button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 900, color: T.text }}>{title}</div>
        {combo > 0 && (
          <div style={{
            background: combo >= 3 ? T.orange : T.accent, color: "white",
            padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 900
          }}>
            🔥 {combo}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            width: `${(progress / total) * 100}%`, height: "100%",
            background: T.accent, transition: "width 0.3s"
          }} />
        </div>
        <div style={{ fontSize: 11, color: T.textMid, fontWeight: 700 }}>
          {progress}/{total}
          {typeof score === "number" && <span style={{ marginLeft: 6, color: T.green }}>· ⭐ {score}</span>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   공통: 게임 종료 화면
// ══════════════════════════════════════════════════════════════════════════
function FinishScreen({ score, total, levelId, onBack, onExit }) {
  const stars = getStars(score, total);
  const ratio = total > 0 ? score / total : 0;
  let message, mainEmoji;
  if (ratio === 1.0) { message = "완벽해요! 정말 잘했어요!"; mainEmoji = "🏆"; }
  else if (ratio >= 0.8) { message = "아주 잘했어요!"; mainEmoji = "🌟"; }
  else if (ratio >= 0.5) { message = "잘했어요! 더 연습해봐요"; mainEmoji = "😊"; }
  else { message = "괜찮아요, 다시 도전해봐요!"; mainEmoji = "💪"; }

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <div style={{
        background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
        color: "white", borderRadius: 28, padding: "40px 24px", marginTop: 40
      }}>
        <div style={{ fontSize: 96, marginBottom: 12 }}>{mainEmoji}</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{message}</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 20 }}>
          {score} / {total} 맞췄어요
        </div>

        {/* 별 ⭐⭐⭐ */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <span key={i} style={{
              fontSize: 60,
              opacity: stars >= i ? 1 : 0.3,
              filter: stars >= i ? "drop-shadow(0 0 12px rgba(255,255,255,0.8))" : "none",
              transition: `all 0.5s ${i * 0.2}s`
            }}>⭐</span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: 14, background: T.card,
          color: T.text, border: `2px solid ${T.border}`, borderRadius: 14,
          fontSize: 13, fontWeight: 800, cursor: "pointer"
        }}>
          다시 도전
        </button>
        <button onClick={onExit} style={{
          flex: 1, padding: 14, background: T.accent,
          color: "white", border: "none", borderRadius: 14,
          fontSize: 13, fontWeight: 800, cursor: "pointer"
        }}>
          홈으로
        </button>
      </div>
    </div>
  );
}
