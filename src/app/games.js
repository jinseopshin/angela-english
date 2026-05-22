"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ALL_WORDS, getWordsByLevel } from "./wordData";
import { T, Btn, Card } from "./theme";
import { onCorrect, onWrong, onFinish, triggerConfetti } from "./soundEffects";

// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — games.js v2.0 (theme.js T/Btn/Card 통일)
//   12개 게임: 메모리카드 / 데일리챌린지 / 오답노트 / 애너그램 /
//              타이핑레이스 / 단어릴레이 / 스무고개 / 단어월드RPG /
//              그림단어 / 단어연결 / 단어찾기퍼즐 / 받아쓰기
//
//   ⚠️ 모든 게임의 결과 화면에서 setStudents 호출은 useEffect 안에서
//      awardedRef.current 로 단 한 번만 실행되도록 패턴 통일.
//      (렌더 중 setState 호출 → React error #185 무한루프 방지)
// ══════════════════════════════════════════════════════════════════════════

// 영어 발음 재생 헬퍼
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
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

// ── Angela 캐릭터 컴포넌트 ──────────────────────────────────────────────────
// 게임 상태에 따라 다른 표정을 보여줍니다
function AngelaCharacter({ state = "thinking", size = 120, style = {} }) {
  // state: "thinking" | "happy" | "oops"
  const images = {
    thinking: "/angela/angela-think.png",
    happy: "/angela/angela-happy.png",
    oops: "/angela/angela-oops.png",
  };

  const animations = {
    thinking: "angela-float 2s ease-in-out infinite",
    happy: "angela-celebrate 0.6s ease-out",
    oops: "angela-oops 0.5s ease-out",
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: animations[state] || animations.thinking,
        ...style,
      }}
    >
      <img
        src={images[state] || images.thinking}
        alt="Angela"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
        }}
      />
    </div>
  );
}

// (T는 ./theme 에서 import — 자체 정의 제거하여 디자인 통일)

// ── SSR 안전 유틸 ──────────────────────────────────────────────────────────
const isBrowser = typeof window !== "undefined";
const ls = {
  get: (key, fallback=null) => {
    if (!isBrowser) return fallback;
    try { const v=ls.raw(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (key, val) => {
    if (!isBrowser) return;
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  raw: (key) => {
    if (!isBrowser) return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
};
const safeRAF = (cb) => isBrowser ? requestAnimationFrame(cb) : 0;
const safeCAF = (id) => { if (isBrowser && id) cancelAnimationFrame(id); };

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const uid = () => Math.random().toString(36).slice(2, 9);

// ── 공통: 학생 기록 저장 헬퍼 ──────────────────────────────────────────
// 모든 게임에서 동일하게 사용하기 위한 헬퍼.
// 결과 화면 렌더링 중이 아니라 useEffect 안에서만 호출되어야 함.
function saveGameRecord(setStudents, name, gameType, score, total, points) {
  if (typeof setStudents !== "function") return;
  setStudents(prev => {
    const s = prev[name] || {};
    return {
      ...prev,
      [name]: {
        ...s,
        points: (s.points || 0) + points,
        records: [
          ...(s.records || []),
          {
            type: "game",
            gameType,
            score,
            total,
            points,
            date: new Date().toISOString()
          }
        ].slice(-50)
      }
    };
  });
}

// (Btn은 ./theme 에서 import)

// (Card는 ./theme 에서 import)

// 공통 결과 화면
function ResultScreen({ score, total, bonus=0, title, emoji, onExit, onRetry }) {
  const pct = total > 0 ? Math.round(score / total * 100) : 0;
  const pts = score * 10 + bonus;
  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"48px 20px",textAlign:"center"}}>
      <div style={{fontSize:72,marginBottom:12}}>{pct>=80?"🎉":pct>=60?"👏":"💪"}</div>
      <div style={{fontSize:22,fontWeight:900,color:T.text,marginBottom:4}}>{score} / {total}</div>
      <div style={{fontSize:14,color:T.textMid,marginBottom:4}}>{title}</div>
      {bonus>0 && <div style={{fontSize:13,color:T.purple,fontWeight:800,marginBottom:4}}>🎁 보너스 +{bonus}점!</div>}
      <Card style={{maxWidth:280,margin:"16px auto 20px",background:T.yellowLight,padding:14}}>
        <div style={{fontSize:32}}>⭐</div>
        <div style={{fontSize:18,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
      </Card>
      <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
        {onRetry && <Btn v="secondary" size="lg" onClick={onRetry} style={{flex:1}}>🔄 다시</Btn>}
        <Btn v="primary" size="lg" onClick={onExit} style={{flex:1}}>홈으로</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ① 메모리 카드 (짝 맞추기)
// ══════════════════════════════════════════════════════════════════════════
export function MemoryCardGame({ name, setStudents, onExit }) {
  const [size, setSize] = useState(null); // null = 난이도 선택, 8|12|16
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const awardedRef = useRef(false);

  // 타이머
  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startTime)/1000)), 200);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  // ✅ 게임 완료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!done || awardedRef.current) return;
    awardedRef.current = true;
    const bonus = Math.max(0, 200 - elapsed);
    const pts = matched.size * 10 + bonus;
    saveGameRecord(setStudents, name, "메모리카드", matched.size, matched.size, pts);
    onFinish(matched.size, matched.size);
  }, [done, elapsed, matched.size, name, setStudents]);

  const initGame = useCallback((n) => {
    const pool = shuffle(ALL_WORDS).slice(0, n);
    const deck = shuffle([
      ...pool.map((w,i) => ({ id:`en${i}`, word:w, side:"en", pairId:i })),
      ...pool.map((w,i) => ({ id:`ko${i}`, word:w, side:"ko", pairId:i })),
    ]);
    setCards(deck); setFlipped([]); setMatched(new Set());
    setMoves(0); setDone(false); setElapsed(0);
    setStartTime(Date.now());
    awardedRef.current = false;
  }, []);

  const flip = useCallback((idx) => {
    if (flipped.length === 2 || matched.has(cards[idx].pairId) || flipped.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(m => m+1);
      const [a, b] = [cards[next[0]], cards[next[1]]];
      if (a.pairId === b.pairId && a.side !== b.side) {
        const nm = new Set(matched); nm.add(a.pairId);
        setMatched(nm);
        setFlipped([]);
        if (nm.size === cards.length / 2) {
          clearInterval(timerRef.current);
          setDone(true);
        }
      } else setTimeout(() => setFlipped([]), 900);
    }
  }, [flipped, matched, cards]);

  // 난이도 선택
  if (!size) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:48,marginBottom:8}}>🧠</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>메모리 카드</div>
        <div style={{fontSize:13,color:T.textMid,marginTop:4}}>난이도를 선택하세요</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:380,margin:"0 auto"}}>
        {[{n:8,label:"쉬움",desc:"8쌍 · 초보자용",emoji:"🌱",bg:T.greenLight,color:T.green},
          {n:12,label:"보통",desc:"12쌍 · 기본",emoji:"🌿",bg:T.accentLight,color:T.accent},
          {n:16,label:"어려움",desc:"16쌍 · 고수용",emoji:"🌳",bg:T.purpleLight,color:T.purple},
        ].map(d=>(
          <Card key={d.n} onClick={()=>{setSize(d.n);initGame(d.n);}} style={{display:"flex",alignItems:"center",gap:14,background:d.bg,border:`2px solid ${d.color}33`}}>
            <div style={{fontSize:32}}>{d.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:900,color:T.text}}>{d.label}</div>
              <div style={{fontSize:12,color:T.textMid}}>{d.desc}</div>
            </div>
            <div style={{fontSize:20,color:T.textDim}}>›</div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (done) return <ResultScreen score={matched.size} total={matched.size} bonus={Math.max(0,200-elapsed)} title={`${moves}번 만에 클리어! ⏱️ ${elapsed}초`} onExit={onExit} onRetry={()=>{setSize(null);}} />;

  const cols = size === 8 ? 4 : size === 12 ? 4 : 4;
  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <div style={{display:"flex",gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>👆 {moves}번</span>
          <span style={{fontSize:12,fontWeight:700,color:T.accent}}>⏱️ {elapsed}초</span>
          <span style={{fontSize:12,fontWeight:700,color:T.green}}>✓ {matched.size}/{cards.length/2}</span>
        </div>
      </div>
      {/* 진도바 */}
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${matched.size/(cards.length/2)*100}%`,background:T.green,borderRadius:3,transition:"width 0.3s"}} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:7}}>
        {cards.map((c,i) => {
          const isFlipped = flipped.includes(i) || matched.has(c.pairId);
          const isMatched = matched.has(c.pairId);
          return (
            <div key={c.id} onClick={()=>flip(i)} style={{
              aspectRatio:"3/4",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
              cursor:isMatched||flipped.length===2&&!flipped.includes(i)?"default":"pointer",
              transition:"all 0.25s",fontSize:c.side==="en"?13:12,fontWeight:800,textAlign:"center",padding:4,lineHeight:1.3,
              background:isMatched?T.greenLight:isFlipped?T.card:T.accent,
              color:isMatched?T.green:isFlipped?T.text:"transparent",
              border:`2px solid ${isMatched?T.green:isFlipped?T.border:T.accent}`,
              boxShadow:isFlipped&&!isMatched?T.shadow:"none",
              userSelect:"none",
            }}>
              {isFlipped ? (c.side==="en" ? c.word.en : c.word.ko) : "?"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ② 데일리 챌린지 (매일 바뀌는 5단어)
// ══════════════════════════════════════════════════════════════════════════
export function DailyChallenge({ name, setStudents, onExit }) {
  const today = new Date().toISOString().slice(0, 10);
  const storageKey = `angela_daily_${name}_${today}`;
  const [status, setStatus] = useState(() => {
    try { return ls.get(storageKey, null); } catch { return null; }
  });
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [phase, setPhase] = useState("quiz"); // quiz | result
  const [angelaState, setAngelaState] = useState("thinking"); // Angela 즉시 반응용
  const awardedRef = useRef(false);

  // 오늘 날짜 시드로 고정 단어 5개 (매일 같은 단어)
  const dailyWords = useMemo(() => {
    const seed = today.replace(/-/g,"").split("").reduce((a,c)=>a*31+c.charCodeAt(0),0);
    const pool = [...ALL_WORDS];
    for (let i=pool.length-1;i>0;i--){const j=Math.abs(seed*i)%pool.length;[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,5).map(w=>{
      const wrongs=shuffle(ALL_WORDS.filter(x=>x.en!==w.en)).slice(0,3);
      const opts=shuffle([w,...wrongs]);
      return {...w,opts,ansIdx:opts.findIndex(o=>o.en===w.en)};
    });
  },[today]);

  // ✅ 결과 화면 진입 시 점수 저장 + localStorage 기록 (한 번만)
  useEffect(() => {
    if (phase !== "result" || awardedRef.current) return;
    awardedRef.current = true;
    const bonus = score === 5 ? 50 : 0;
    const pts = score * 15 + bonus;
    saveGameRecord(setStudents, name, "데일리챌린지", score, 5, pts);
    onFinish(score, 5);
    ls.set(storageKey, { score, completedAt: new Date().toISOString() });
  }, [phase, score, name, setStudents, storageKey]);

  // 이미 오늘 완료했으면
  if (status) {
    const streak = getStreak(name);
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"48px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:12}}>✅</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:8}}>오늘 챌린지 완료!</div>
        <div style={{fontSize:13,color:T.textMid,marginBottom:20}}>점수: {status.score}/5 · 내일 또 도전하세요!</div>
        <Card style={{maxWidth:280,margin:"0 auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:28,marginBottom:4}}>🔥</div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>{streak}일 연속 챌린지 클리어!</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  if (phase==="result") {
    const bonus = score===5?50:0;
    const pts = score*15+bonus;
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"48px 20px",textAlign:"center"}}>
        <div style={{fontSize:72,marginBottom:12}}>{score===5?"🏆":score>=3?"🎉":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>{score} / 5</div>
        <div style={{fontSize:13,color:T.textMid,marginTop:4,marginBottom:16}}>
          {score===5?"만점! 오늘의 영웅!":score>=3?"잘했어요!":"내일 다시 도전!"}
        </div>
        {score===5&&<div style={{fontSize:13,color:T.purple,fontWeight:800,marginBottom:8}}>🎁 만점 보너스 +{bonus}점!</div>}
        <Card style={{maxWidth:280,margin:"0 auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:32}}>⭐</div>
          <div style={{fontSize:18,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
        </Card>
        <div style={{fontSize:12,color:T.textMid,marginBottom:16}}>내일 다시 새 챌린지가 열려요!</div>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  const q = dailyWords[round];
  const answered = picked !== null;

  const pick = (idx) => {
    if (answered) return;
    
    // 즉시 Angela 상태 변경 (React 상태 업데이트 전)
    const isCorrect = idx === q.ansIdx;
    setAngelaState(isCorrect ? "happy" : "oops");
    
    setPicked(idx);
    if (isCorrect) { setScore(s=>s+1); onCorrect(); }
    else onWrong();
  };

  const next = () => {
    setPicked(null);
    setAngelaState("thinking"); // Angela 다시 thinking으로
    if (round < dailyWords.length-1) setRound(r=>r+1);
    else setPhase("result");
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      {/* 상단 종료 버튼 */}
      <div style={{display:"flex",justifyContent:"flex-start",marginBottom:10}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
      </div>
      {/* 헤더 */}
      <div style={{background:`linear-gradient(135deg,${T.orange},${T.yellow})`,borderRadius:14,padding:"12px 16px",marginBottom:16,color:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,opacity:.9}}>📅 오늘의 챌린지</div>
            <div style={{fontSize:15,fontWeight:900}}>{today}</div>
          </div>
          <div style={{textAlign:"center",background:"rgba(255,255,255,0.25)",borderRadius:10,padding:"8px 12px"}}>
            <div style={{fontSize:18,fontWeight:900}}>{round+1}/5</div>
            <div style={{fontSize:10,opacity:.85}}>문제</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8}}>
          {dailyWords.map((_,i)=>(
            <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<round?"rgba(255,255,255,0.9)":i===round?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.25)"}} />
          ))}
        </div>
      </div>

      {/* 문제 */}
      <Card key={round} style={{marginBottom:12,textAlign:"center",padding:"24px 16px",background:T.yellowLight,animation:"fade-in-up 0.35s ease-out"}}>
        <div style={{fontSize:11,color:T.textMid,marginBottom:8,fontWeight:700}}>뜻을 보고 영어 단어를 고르세요</div>
        <div style={{fontSize:38,fontWeight:900,color:T.yellow}}>{q.ko}</div>
        <div style={{fontSize:11,color:T.textMid,marginTop:6}}>{q.cat}</div>
      </Card>

      {/* 보기 위 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.slice(0, 2).map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if (answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"18px 10px",borderRadius:13,border:`2px solid ${border}`,background:bg,color,fontSize:15,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",animation:anim?`${anim} 0.45s ease`:"none"}}>{o.en}</button>;
        })}
      </div>

      {/* Angela - 보기 사이 */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
        <AngelaCharacter 
          state={angelaState}
          size={90}
        />
      </div>

      {/* 보기 아래 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.slice(2, 4).map((o,idx)=>{
          const realIdx = idx + 2;
          const isAns=realIdx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if (answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(realIdx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={realIdx} onClick={()=>pick(realIdx)} disabled={answered} style={{padding:"18px 10px",borderRadius:13,border:`2px solid ${border}`,background:bg,color,fontSize:15,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",animation:anim?`${anim} 0.45s ease`:"none"}}>{o.en}</button>;
        })}
      </div>

      {answered && (
        <div>
          <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:picked===q.ansIdx?T.green:T.red,marginBottom:10}}>
            {picked===q.ansIdx?"✓ 정답!":"✗ 정답: "+q.en}
          </div>
          <Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>
            {round<dailyWords.length-1?"다음 →":"결과 보기"}
          </Btn>
        </div>
      )}
    </div>
  );
}

function getStreak(name) {
  let streak=0;
  const today=new Date();
  for(let i=0;i<30;i++){
    const d=new Date(today);d.setDate(today.getDate()-i);
    const key=`angela_daily_${name}_${d.toISOString().slice(0,10)}`;
    if(ls.raw(key)) streak++; else break;
  }
  return streak;
}

// ══════════════════════════════════════════════════════════════════════════
//  ③ 오답 노트 복습 게임
// ══════════════════════════════════════════════════════════════════════════
export function WrongNoteGame({ name, students, setStudents, onExit }) {
  const me = students?.[name]||{};
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const awardedRef = useRef(false);

  // 오답 단어 추출 (과거 기록에서 틀린 것들)
  const wrongWords = useMemo(()=>{
    const wrongKey = `angela_wrong_${name}`;
    try {
      const data = ls.get(wrongKey, {});
      const candidates = Object.entries(data)
        .filter(([,v])=>v.wrong>0)
        .sort(([,a],[,b])=>b.wrong-a.wrong)
        .slice(0,10)
        .map(([en])=>ALL_WORDS.find(w=>w.en===en))
        .filter(Boolean);
      if (candidates.length<3) return [];
      return shuffle(candidates).slice(0,Math.min(8,candidates.length)).map(w=>{
        const wrongs=shuffle(ALL_WORDS.filter(x=>x.en!==w.en)).slice(0,3);
        const opts=shuffle([w,...wrongs]);
        return {...w,opts,ansIdx:opts.findIndex(o=>o.en===w.en)};
      });
    } catch { return []; }
  },[name]);

  const gameOver = done || round >= wrongWords.length;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (wrongWords.length === 0 || !gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 12;
    saveGameRecord(setStudents, name, "오답노트", score, wrongWords.length, pts);
    onFinish(score, wrongWords.length);
  }, [gameOver, wrongWords.length, score, name, setStudents]);

  if (wrongWords.length===0) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:12}}>🎉</div>
      <div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:8}}>오답 노트가 비어있어요!</div>
      <div style={{fontSize:13,color:T.textMid,marginBottom:20}}>단어 게임을 더 많이 해보면<br/>틀린 단어들이 여기 모여요</div>
      <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
    </div>
  );

  if (gameOver) {
    return <ResultScreen score={score} total={wrongWords.length} title="오답 노트 복습 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setDone(false);setPicked(null);awardedRef.current=false;}} />;
  }

  const q = wrongWords[round];
  const answered = picked!==null;

  const pick=(idx)=>{
    if(answered)return;
    setPicked(idx);
    // 오답 기록 업데이트
    const key=`angela_wrong_${name}`;
    try{
      const data=ls.get(key, {});
      data[q.en]=data[q.en]||{wrong:0,correct:0};
      if(idx===q.ansIdx){data[q.en].correct++;setScore(s=>s+1);onCorrect();}
      else {data[q.en].wrong++;onWrong();}
      ls.set(key, data);
    }catch{}
  };

  const next=()=>{setPicked(null);if(round<wrongWords.length-1)setRound(r=>r+1);else setDone(true);};

  const wrongCount=()=>{try{const d=ls.get(`angela_wrong_${name}`, {});return d[q.en]?.wrong||0;}catch{return 0;}};

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:T.red}}>⚠️ {wrongCount()}회 틀린 단어</span>
        <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>{round+1}/{wrongWords.length}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/wrongWords.length)*100}%`,background:T.red,borderRadius:3,transition:"width 0.3s"}} />
      </div>
      <Card key={round} style={{marginBottom:12,textAlign:"center",padding:"22px 16px",background:T.redLight,border:`1.5px solid ${T.red}30`,animation:"fade-in-up 0.35s ease-out"}}>
        <div style={{fontSize:11,color:T.red,marginBottom:6,fontWeight:800}}>📝 복습 단어</div>
        <div style={{fontSize:38,fontWeight:900,color:T.red}}>{q.ko}</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"18px 10px",borderRadius:13,border:`2px solid ${border}`,background:bg,color,fontSize:15,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",animation:anim?`${anim} 0.45s ease`:"none"}}>{o.en}</button>;
        })}
      </div>
      {answered&&<div><div style={{textAlign:"center",fontSize:14,fontWeight:900,color:picked===q.ansIdx?T.green:T.red,marginBottom:10}}>{picked===q.ansIdx?"✓ 이번엔 맞았어요!":"✗ 정답: "+q.en}</div><Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>{round<wrongWords.length-1?"다음 →":"결과 보기"}</Btn></div>}
    </div>
  );
}

// 오답 기록 저장 헬퍼 (다른 게임에서 호출)
// Phase 2: 이제 망각 곡선까지 자동 업데이트됨
export function recordWrong(name, wordEn, isCorrect, wordKo = "") {
  // 1) localStorage 폴백 (오프라인 대비)
  try {
    const key=`angela_wrong_${name}`;
    const data=ls.get(key, {});
    data[wordEn]=data[wordEn]||{wrong:0,correct:0};
    if(isCorrect)data[wordEn].correct++; else data[wordEn].wrong++;
    if (wordKo) data[wordEn].ko = wordKo;
    ls.set(key, data);
  } catch {}

  // 2) Supabase의 student_words 테이블에도 기록 (망각 곡선 자동 업데이트)
  if (!name || !wordEn) return;
  // 동적 import로 순환 참조 방지 + 비동기로 실행 (게임 흐름 막지 않음)
  import("./studentWords").then(m => {
    m.recordWordEncounter(name, { en: wordEn, ko: wordKo || "" }, isCorrect);
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════════
//  ④ 애너그램 (철자 조립)
// ══════════════════════════════════════════════════════════════════════════
export function AnagramGame({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);
  const awardedRef = useRef(false);

  const questions = useMemo(()=>shuffle(ALL_WORDS.filter(w=>w.en.length>=3&&w.en.length<=8&&!w.en.includes(" "))).slice(0,10),[]);

  useEffect(()=>{
    if(round<questions.length){
      const w=questions[round];
      setTiles(shuffle(w.en.split("").map((c,i)=>({id:`${i}_${c}`,char:c}))));
      setAnswer([]);
      setFeedback(null);
    }
  },[round,questions]);

  const gameOver = done || round >= questions.length;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 15;
    saveGameRecord(setStudents, name, "애너그램", score, questions.length, pts);
    onFinish(score, questions.length);
  }, [gameOver, score, questions.length, name, setStudents]);

  if (gameOver) {
    return <ResultScreen score={score} total={questions.length} title="애너그램 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setDone(false);awardedRef.current=false;}} />;
  }

  const q=questions[round];

  const pickTile=(tile)=>{
    if(feedback)return;
    setTiles(t=>t.filter(x=>x.id!==tile.id));
    setAnswer(a=>[...a,tile]);
  };

  const removeTile=(tile)=>{
    if(feedback)return;
    setAnswer(a=>a.filter(x=>x.id!==tile.id));
    setTiles(t=>[...t,tile]);
  };

  const check=()=>{
    const built=answer.map(t=>t.char).join("");
    const correct=built.toLowerCase()===q.en.toLowerCase();
    setFeedback(correct?"correct":"wrong");
    if(correct){setScore(s=>s+1);onCorrect();} else onWrong();
    recordWrong(name,q.en,correct);
    setTimeout(()=>{
      if(round<questions.length-1)setRound(r=>r+1); else setDone(true);
    },1000);
  };

  const hint=()=>{
    // 힌트: 첫 글자 자동 배치
    const first=tiles.find(t=>t.char===q.en[answer.length]);
    if(first)pickTile(first);
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:T.purple}}>{round+1}/{questions.length}</span>
        <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:T.purple,borderRadius:3,transition:"width 0.3s"}}/>
      </div>

      <Card key={round} style={{marginBottom:14,textAlign:"center",padding:"20px 16px",background:T.purpleLight,animation:"fade-in-up 0.35s ease-out"}}>
        <div style={{fontSize:11,color:T.purple,fontWeight:800,marginBottom:8}}>철자를 조립해서 단어를 만들어요</div>
        <div style={{fontSize:36,fontWeight:900,color:T.purple}}>{q.ko}</div>
        <div style={{fontSize:11,color:T.textMid,marginTop:6}}>{q.en.length}글자</div>
      </Card>

      {/* 답안 영역 */}
      <div style={{minHeight:56,background:T.card,borderRadius:12,border:`2px dashed ${feedback==="correct"?T.green:feedback==="wrong"?T.red:T.purple}`,padding:"10px 12px",marginBottom:12,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",justifyContent:"center"}}>
        {answer.length===0
          ? <span style={{fontSize:13,color:T.textDim}}>타일을 눌러서 배치하세요</span>
          : answer.map(t=>(
              <button key={t.id} onClick={()=>removeTile(t)} style={{width:38,height:42,borderRadius:9,background:feedback==="correct"?T.green:T.accent,color:"white",fontSize:18,fontWeight:900,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{t.char}</button>
            ))
        }
      </div>

      {feedback&&<div style={{textAlign:"center",fontSize:14,fontWeight:900,color:feedback==="correct"?T.green:T.red,marginBottom:10}}>{feedback==="correct"?"🎉 정답!":"✗ 정답은 "+q.en}</div>}

      {/* 타일 영역 */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:14}}>
        {tiles.map(t=>(
          <button key={t.id} onClick={()=>pickTile(t)} disabled={!!feedback} style={{width:42,height:48,borderRadius:10,background:T.card,border:`2px solid ${T.border}`,fontSize:20,fontWeight:900,color:T.text,cursor:feedback?"default":"pointer",boxShadow:T.shadow,transition:"all 0.15s"}}>{t.char}</button>
        ))}
      </div>

      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" size="md" onClick={hint} disabled={!!feedback||tiles.length===0} style={{flex:1}}>💡 힌트</Btn>
        <Btn v="ghost" size="md" onClick={()=>{setTiles(t=>[...t,...answer]);setAnswer([]);}} disabled={!!feedback||answer.length===0} style={{flex:1}}>↩ 초기화</Btn>
        <Btn v="primary" size="md" onClick={check} disabled={!!feedback||answer.length!==q.en.length} style={{flex:1}}>✓ 확인</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑤ 타이핑 레이스 (단어가 내려옴)
// ══════════════════════════════════════════════════════════════════════════
export function TypingRace({ name, setStudents, onExit }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1); // 1~5
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [input, setInput] = useState("");
  const [falling, setFalling] = useState([]); // [{id, word, x, y, speed}]
  const [done, setDone] = useState(false);
  const [wave, setWave] = useState(1);
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const lastSpawn = useRef(0);
  const awardedRef = useRef(false);
  const BOARD_H = 320;

  const wordPool = useMemo(()=>shuffle(ALL_WORDS.filter(w=>!w.en.includes(" "))).map(w=>w.en),[]);
  const wordIdx = useRef(0);

  const spawnWord = useCallback(()=>{
    const w=wordPool[wordIdx.current%wordPool.length];
    wordIdx.current++;
    const speed=0.4+level*0.15;
    setFalling(prev=>[...prev,{id:uid(),word:w,x:Math.random()*60+5,y:0,speed}]);
  },[level,wordPool]);

  const tick = useCallback(()=>{
    if(!started||done)return;
    const now=Date.now();
    const spawnInterval=Math.max(800,2500-level*300);
    if(now-lastSpawn.current>spawnInterval){spawnWord();lastSpawn.current=now;}
    setFalling(prev=>{
      const next=prev.map(f=>({...f,y:f.y+f.speed}));
      const hit=next.filter(f=>f.y>=95);
      const alive=next.filter(f=>f.y<95);
      if(hit.length>0){
        setLives(l=>{
          const nl=l-hit.length;
          if(nl<=0){setDone(true);}
          return Math.max(0,nl);
        });
      }
      return alive;
    });
    frameRef.current=safeRAF(tick);
  },[started,done,level,spawnWord]);

  useEffect(()=>{
    if(started&&!done){
      lastSpawn.current=Date.now();
      frameRef.current=safeRAF(tick);
      inputRef.current?.focus();
    }
    return ()=>{if(frameRef.current)safeCAF(frameRef.current);};
  },[started,done,tick]);

  // 레벨업
  useEffect(()=>{if(score>0&&score%5===0&&level<5)setLevel(l=>l+1);},[score]);

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!done || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 8;
    saveGameRecord(setStudents, name, "타이핑레이스", score, score, pts);
    onFinish(score, score);
  }, [done, score, name, setStudents]);

  const tryType=(e)=>{
    const val=e.target.value.trim().toLowerCase();
    setInput(e.target.value);
    setFalling(prev=>{
      const hit=prev.findIndex(f=>f.word.toLowerCase()===val);
      if(hit>=0){
        setScore(s=>s+1);
        setInput("");
        e.target.value="";
        return prev.filter((_,i)=>i!==hit);
      }
      return prev;
    });
  };

  if(done){
    return <ResultScreen score={score} total={score} title={`Lv.${level} 도달! · 단어 ${score}개 격파!`} onExit={onExit} onRetry={()=>{setScore(0);setLives(3);setFalling([]);setDone(false);setLevel(1);setStarted(false);awardedRef.current=false;}} />;
  }

  if(!started) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:48,marginBottom:8}}>⌨️</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>타이핑 레이스</div>
        <div style={{fontSize:13,color:T.textMid,marginTop:6,lineHeight:1.7}}>단어가 내려와요!<br/>바닥에 닿기 전에 타이핑해서 격파하세요<br/>❤️❤️❤️ 목숨 3개</div>
      </div>
      <Btn v="primary" size="lg" onClick={()=>setStarted(true)} style={{width:"100%",marginTop:20}}>🚀 시작!</Btn>
    </div>
  );

  const livesDisplay="❤️".repeat(lives)+"🖤".repeat(3-lives);

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center",gap:8}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:13}}>{livesDisplay}</span>
        <span style={{fontSize:11,fontWeight:800,color:T.purple,background:T.purpleLight,padding:"3px 8px",borderRadius:8}}>Lv.{level}</span>
        <span style={{fontSize:13,fontWeight:800,color:T.accent}}>💥{score}</span>
      </div>
      {/* 게임판 */}
      <div style={{position:"relative",height:BOARD_H,background:T.card,border:`2px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
        {/* 위험선 */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:28,background:T.redLight,borderTop:`2px dashed ${T.red}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:10,color:T.red,fontWeight:700}}>여기 닿으면 목숨 감소!</span>
        </div>
        {falling.map(f=>(
          <div key={f.id} style={{position:"absolute",left:`${f.x}%`,top:`${f.y}%`,background:T.accent,color:"white",padding:"4px 10px",borderRadius:8,fontSize:14,fontWeight:800,whiteSpace:"nowrap",boxShadow:T.shadow}}>
            {f.word}
          </div>
        ))}
      </div>
      <input ref={inputRef} onChange={tryType} placeholder="단어를 타이핑하고 Enter!" style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",fontSize:16,borderRadius:11,border:`2px solid ${T.accent}`,outline:"none",fontWeight:700}} onKeyDown={e=>{if(e.key==="Enter")tryType({target:{value:input}});}} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑥ 단어 릴레이 (협동 퀴즈 — 혼자도 OK)
// ══════════════════════════════════════════════════════════════════════════
export function WordRelay({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const [comboFlash, setComboFlash] = useState(false);
  const [angelaState, setAngelaState] = useState("thinking"); // Angela 즉시 반응용
  const awardedRef = useRef(false);

  // 릴레이: 앞 단어의 마지막 글자로 시작하는 다음 단어 맞추기
  const chain = useMemo(()=>{
    const pool=shuffle(ALL_WORDS.filter(w=>!w.en.includes(" ")&&w.en.length>=3));
    const result=[pool[0]];
    for(let i=0;i<9;i++){
      const last=result[result.length-1].en.slice(-1).toLowerCase();
      const next=pool.find(w=>w.en[0].toLowerCase()===last&&!result.includes(w));
      if(next)result.push(next); else result.push(pool[i+1]||pool[0]);
    }
    return result.map(w=>{
      const wrongs=shuffle(ALL_WORDS.filter(x=>x.en!==w.en&&!x.en.includes(" "))).slice(0,3);
      const opts=shuffle([w,...wrongs]);
      return {...w,opts,ansIdx:opts.findIndex(o=>o.en===w.en)};
    });
  },[]);

  const gameOver = done || round >= chain.length;
  const bonus = maxCombo>=5?50:maxCombo>=3?20:0;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 10 + bonus;
    saveGameRecord(setStudents, name, "단어릴레이", score, chain.length, pts);
    onFinish(score, chain.length);
  }, [gameOver, score, bonus, chain.length, name, setStudents]);

  if (gameOver) {
    return <ResultScreen score={score} total={chain.length} bonus={bonus} title={`최고 콤보 ${maxCombo}! 릴레이 완료!`} onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setCombo(0);setMaxCombo(0);setDone(false);setPicked(null);awardedRef.current=false;}} />;
  }

  const q=chain[round];
  const prev=round>0?chain[round-1]:null;
  const answered=picked!==null;

  const pick=(idx)=>{
    if(answered)return;
    
    // 즉시 Angela 상태 변경
    const isCorrect = idx === q.ansIdx;
    setAngelaState(isCorrect ? "happy" : "oops");
    
    setPicked(idx);
    if(isCorrect){
      setScore(s=>s+1);
      const nc=combo+1;
      setCombo(nc);
      setMaxCombo(m=>Math.max(m,nc));
      onCorrect();
      if(nc>=5) triggerConfetti();  // 5콤보 이상 색종이!
      if(nc>=2){setComboFlash(true);setTimeout(()=>setComboFlash(false),600);}
    } else {setCombo(0);onWrong();}
    recordWrong(name,q.en,isCorrect);
  };

  const next=()=>{
    setPicked(null);
    setAngelaState("thinking"); // Angela 다시 thinking으로
    if(round<chain.length-1)setRound(r=>r+1);else setDone(true);
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {combo>=2&&<span className={combo>=10?"rainbow-active":combo>=5?"golden-glow-active":""} style={{
            fontSize:combo>=10?13:combo>=5?12:11,
            fontWeight:900,
            background:combo>=10?`linear-gradient(90deg,${T.red},${T.orange},${T.yellow},${T.green},${T.accent},${T.purple})`:combo>=5?`linear-gradient(135deg,${T.yellow},${T.orange})`:comboFlash?T.orange:T.orangeLight,
            color:combo>=5?"white":T.orange,
            padding:combo>=5?"4px 10px":"3px 8px",
            borderRadius:T.radiusFull,
            transition:"all 0.2s",
            transform:comboFlash?"scale(1.15)":"scale(1)",
            display:"inline-block"
          }}>{combo>=10?"🌈":combo>=5?"⚡":"🔥"} {combo}콤보!{combo>=10?" 🌈":combo>=5?" ⚡":""}</span>}
          <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>{round+1}/{chain.length}</span>
        </div>
        <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/chain.length)*100}%`,background:T.teal,borderRadius:3,transition:"width 0.3s"}}/>
      </div>

      {/* 릴레이 연결 표시 */}
      {prev&&(
        <div style={{background:T.tealLight,borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,color:T.teal,fontWeight:700}}>앞 단어:</span>
          <span style={{fontSize:14,fontWeight:900,color:T.teal}}>{prev.en}</span>
          <span style={{fontSize:12,color:T.textMid}}>→ 마지막 글자: </span>
          <span style={{fontSize:18,fontWeight:900,color:T.teal,background:"white",padding:"2px 8px",borderRadius:7}}>{prev.en.slice(-1).toUpperCase()}</span>
        </div>
      )}

      <Card key={round} style={{marginBottom:12,textAlign:"center",padding:"20px 16px",background:T.tealLight,animation:"fade-in-up 0.35s ease-out"}}>
        <div style={{fontSize:11,color:T.teal,fontWeight:800,marginBottom:6}}>
          {prev?`'${prev.en.slice(-1).toUpperCase()}'로 시작하는 단어의 뜻은?`:"첫 번째 단어의 뜻은?"} <span style={{color:T.accent,fontWeight:800}}>(단어 탭하면 발음!)</span>
        </div>
        <div
          onClick={()=>speak(q.en)}
          style={{fontSize:36,fontWeight:900,color:T.teal,cursor:"pointer",userSelect:"none",transition:"transform 0.1s",display:"inline-block"}}
          onMouseDown={e=>e.currentTarget.style.transform="scale(0.94)"}
          onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
          onTouchStart={e=>e.currentTarget.style.transform="scale(0.94)"}
          onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
          title="탭하면 발음을 들을 수 있어요"
        >{q.en}</div>
        <div style={{marginTop:10}}>
          <button
            onClick={(e)=>{e.stopPropagation();speak(q.en);}}
            style={{
              background:"rgba(255,255,255,0.9)",
              border:`2px solid ${T.teal}`,
              borderRadius:10,
              padding:"5px 14px",
              fontSize:12,
              fontWeight:800,
              cursor:"pointer",
              color:T.teal,
            }}
          >🔊 발음 듣기</button>
        </div>
      </Card>

      {/* 보기 위 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.slice(0, 2).map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"16px 10px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",animation:anim?`${anim} 0.45s ease`:"none"}}>{o.ko}</button>;
        })}
      </div>

      {/* Angela - 보기 사이 + 콤보 효과 */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
        <AngelaCharacter 
          state={angelaState}
          size={combo >= 5 ? 110 : 90}
          style={{
            transition: "all 0.3s ease-out",
            filter: combo >= 10 
              ? "drop-shadow(0 0 20px rgba(255,100,100,0.6)) drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
              : combo >= 5
              ? "drop-shadow(0 0 15px rgba(255,200,0,0.5)) drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
              : "drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
          }}
        />
      </div>

      {/* 보기 아래 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.slice(2, 4).map((o,idx)=>{
          const realIdx = idx + 2;
          const isAns=realIdx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(realIdx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={realIdx} onClick={()=>pick(realIdx)} disabled={answered} style={{padding:"16px 10px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",animation:anim?`${anim} 0.45s ease`:"none"}}>{o.ko}</button>;
        })}
      </div>
      {answered&&<div><div style={{textAlign:"center",fontSize:14,fontWeight:900,color:picked===q.ansIdx?T.green:T.red,marginBottom:8}}>{picked===q.ansIdx?`✓ 정답! ${combo>=2?"🔥"+combo+"콤보!":""}`:"✗ 정답: "+q.ko}</div><Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>{round<chain.length-1?"다음 →":"결과 보기"}</Btn></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑦ 단어 스무고개 (AI 힌트 → 추리)
// ══════════════════════════════════════════════════════════════════════════
export function WordTwenty({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const awardedRef = useRef(false);

  const generateHints = (w)=>[
    `카테고리: ${w.cat}`,
    `글자 수: ${w.en.length}글자`,
    `첫 글자는 '${w.en[0].toUpperCase()}'예요`,
    `마지막 글자는 '${w.en.slice(-1).toUpperCase()}'예요`,
    `한글 뜻: ${w.ko.slice(0,1)}${"_".repeat(w.ko.length-1)}`,
    `영어 힌트: ${w.en[0]}${"_".repeat(w.en.length-2)}${w.en.slice(-1)}`,
    `정답: ${w.ko}`,
  ];

  const questions = useMemo(()=>shuffle(ALL_WORDS.filter(w=>!w.en.includes(" "))).slice(0,8).map(w=>{
    const wrongs=shuffle(ALL_WORDS.filter(x=>x.en!==w.en&&!x.en.includes(" "))).slice(0,3);
    const opts=shuffle([w,...wrongs]);
    return {...w,opts,ansIdx:opts.findIndex(o=>o.en===w.en),hints:generateHints(w)};
  }),[]);

  const gameOver = done || round >= questions.length;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 15;
    saveGameRecord(setStudents, name, "단어스무고개", score, questions.length, pts);
    onFinish(score, questions.length);
  }, [gameOver, score, questions.length, name, setStudents]);

  if (gameOver) {
    return <ResultScreen score={score} total={questions.length} title="스무고개 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setHintIdx(0);setPicked(null);setDone(false);awardedRef.current=false;}} />;
  }

  const q=questions[round];
  const answered=picked!==null;
  const shownHints=q.hints.slice(0,hintIdx+1);
  const bonusPts=Math.max(0,5-hintIdx); // 힌트 적게 쓸수록 보너스

  const pick=(idx)=>{
    if(answered)return;
    setPicked(idx);
    if(idx===q.ansIdx){setScore(s=>s+1+bonusPts);onCorrect();} else onWrong();
    recordWrong(name,q.en,idx===q.ansIdx);
  };

  const showHint=()=>{if(hintIdx<q.hints.length-1)setHintIdx(h=>h+1);};

  const next=()=>{setPicked(null);setHintIdx(0);if(round<questions.length-1)setRound(r=>r+1);else setDone(true);};

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:11,fontWeight:700,color:T.yellow,background:T.yellowLight,padding:"3px 8px",borderRadius:8}}>힌트 적게 = 보너스 +{bonusPts}</span>
        <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>{round+1}/{questions.length}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:T.orange,borderRadius:3,transition:"width 0.3s"}}/>
      </div>

      {/* 힌트 박스 */}
      <Card style={{marginBottom:12,background:T.orangeLight,border:`1.5px solid ${T.orange}30`}}>
        <div style={{fontSize:12,fontWeight:800,color:T.orange,marginBottom:8}}>🔍 힌트 ({hintIdx+1}/{q.hints.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {shownHints.map((h,i)=>(
            <div key={i} style={{fontSize:14,fontWeight:700,color:T.text,background:"white",padding:"8px 12px",borderRadius:9}}>
              {i+1}. {h}
            </div>
          ))}
        </div>
        {!answered&&hintIdx<q.hints.length-1&&(
          <Btn v="warning" size="sm" onClick={showHint} style={{marginTop:10,width:"100%",background:T.orange,color:"white"}}>
            💡 힌트 더 보기 (보너스 -{bonusPts>0?1:0})
          </Btn>
        )}
      </Card>

      {/* 보기 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"16px 10px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3,animation:anim?`${anim} 0.45s ease`:"none"}}>{o.en}<div style={{fontSize:11,fontWeight:500,opacity:.7,marginTop:2}}>{o.ko}</div></button>;
        })}
      </div>
      {answered&&<div><div style={{textAlign:"center",fontSize:14,fontWeight:900,color:picked===q.ansIdx?T.green:T.red,marginBottom:8}}>{picked===q.ansIdx?`✓ 정답! ${bonusPts>0?"+"+bonusPts+"보너스!":""}`:"✗ 정답: "+q.en+" ("+q.ko+")"}</div><Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>{round<questions.length-1?"다음 →":"결과 보기"}</Btn></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑧ 단어 월드 RPG
// ══════════════════════════════════════════════════════════════════════════
const RPG_WORLDS = [
  { id:1, name:"초록 숲",    emoji:"🌲", bg:T.greenLight,  color:T.green,  level:"유치원~초등저", wordLevel:"kinder",  bosses:5, desc:"쉬운 단어들이 모험을 기다려요!" },
  { id:2, name:"꽃 마을",    emoji:"🌸", bg:T.pinkLight,   color:T.pink,   level:"초등 저학년",  wordLevel:"elem1",   bosses:7, desc:"마을 사람들과 영어로 대화해요!" },
  { id:3, name:"학교 성",    emoji:"🏰", bg:T.accentLight, color:T.accent, level:"초등 고학년",  wordLevel:"elem2",   bosses:8, desc:"어려운 단어들이 성을 지키고 있어요!" },
  { id:4, name:"미지의 동굴", emoji:"🦇", bg:T.purpleLight, color:T.purple, level:"중학교",      wordLevel:"middle",  bosses:10,desc:"강력한 단어 보스를 물리쳐요!" },
  { id:5, name:"전설의 탑",   emoji:"⚡", bg:T.yellowLight, color:T.yellow, level:"종합 최강",    wordLevel:"all",     bosses:12,desc:"최고 난이도! 전설의 탐험가에 도전!" },
];

const ITEMS = [
  {id:"shield",  emoji:"🛡️", name:"방패",     effect:"다음 오답 무효화"},
  {id:"potion",  emoji:"🧪", name:"체력 포션", effect:"목숨 1 회복"},
  {id:"star",    emoji:"🌟", name:"별빛",      effect:"포인트 2배"},
  {id:"clock",   emoji:"⏰", name:"모래시계",  effect:"시간 5초 추가"},
];

export function WordWorldRPG({ name, setStudents, onExit }) {
  const saveKey = `angela_rpg_${name}`;
  const initSave = ()=>{try{return ls.get(saveKey, null);}catch{return null;}};

  const [screen, setScreen] = useState("worldMap"); // worldMap | battle | result
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [save, setSaveState] = useState(()=>initSave()||{clearedWorlds:[],totalStars:0,items:[],questLog:[]});

  // 배틀 상태
  const [hp, setHp] = useState(3);
  const [bossHp, setBossHp] = useState(0);
  const [bossMax, setBossMax] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [picked, setPicked] = useState(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [battleItems, setBattleItems] = useState([]);
  const awardedRef = useRef(false);

  const persist=(s)=>{setSaveState(s);try{ls.set(saveKey, s);}catch{}};

  // 배틀 종료 시 보상/저장 — 렌더 중이 아니라 effect에서 1회만 처리
  const battleOver = screen==="battle" && questions.length>0 && (hp<=0 || round>=questions.length);
  useEffect(()=>{
    if(!battleOver || awardedRef.current) return;
    awardedRef.current = true;
    const cleared=round>=questions.length&&hp>0;
    const stars=cleared?3:score>questions.length/2?1:0;
    const pts=score*20+(cleared?50:0);
    saveGameRecord(setStudents, name, "단어월드RPG", score, questions.length, pts);
    onFinish(score, questions.length);
    if(cleared){
      const newSave={...save,clearedWorlds:[...new Set([...save.clearedWorlds,selectedWorld.id])],totalStars:save.totalStars+stars,questLog:[...save.questLog,{world:selectedWorld.name,score,clearedAt:new Date().toISOString()}]};
      persist(newSave);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[battleOver]);

  const startBattle=(world)=>{
    const pool=getWordsByLevel(world.wordLevel);
    const qs=shuffle(pool).slice(0,world.bosses).map(w=>{
      const wrongs=shuffle(pool.filter(x=>x.en!==w.en)).slice(0,3);
      const opts=shuffle([w,...wrongs]);
      return {...w,opts,ansIdx:opts.findIndex(o=>o.en===w.en)};
    });
    setQuestions(qs);
    setHp(3); setBossHp(world.bosses); setBossMax(world.bosses);
    setRound(0); setScore(0); setPicked(null); setFeedback(null);
    setBattleItems(save.items.slice(0,2));
    setSelectedWorld(world);
    awardedRef.current=false;
    setScreen("battle");
  };

  const useItem=(item)=>{
    if(item.id==="shield")setShieldActive(true);
    if(item.id==="potion")setHp(h=>Math.min(5,h+1));
    setBattleItems(prev=>prev.filter(i=>i.id!==item.id));
  };

  if(screen==="worldMap"){
    return(
      <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,alignItems:"center"}}>
          <Btn v="ghost" size="sm" onClick={onExit}>← 홈</Btn>
          <div style={{fontSize:13,fontWeight:800,color:T.yellow}}>⭐ {save.totalStars} · 🗺️ 월드</div>
        </div>

        <div style={{background:`linear-gradient(135deg,${T.purple},${T.accent})`,borderRadius:16,padding:"16px",color:"white",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:4}}>🗺️</div>
          <div style={{fontSize:18,fontWeight:900}}>단어 월드 RPG</div>
          <div style={{fontSize:11,opacity:.85,marginTop:4}}>월드를 클리어하고 별을 모으세요!</div>
        </div>

        {RPG_WORLDS.map(w=>{
          const cleared=save.clearedWorlds.includes(w.id);
          const locked=w.id>1&&!save.clearedWorlds.includes(w.id-1);
          return(
            <Card key={w.id} onClick={!locked?()=>startBattle(w):undefined}
              style={{marginBottom:10,background:locked?T.bgSoft:w.bg,opacity:locked?.6:1,border:`2px solid ${locked?T.borderMid:w.color}33`,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:36,flexShrink:0}}>{locked?"🔒":w.emoji}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:14,fontWeight:900,color:T.text}}>World {w.id}: {w.name}</span>
                  {cleared&&<span style={{fontSize:16}}>✅</span>}
                </div>
                <div style={{fontSize:11,color:T.textMid}}>{w.level} · 보스 {w.bosses}마리</div>
                <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{w.desc}</div>
              </div>
              {!locked&&<div style={{fontSize:20,color:locked?T.textDim:w.color}}>›</div>}
            </Card>
          );
        })}
      </div>
    );
  }

  if(screen==="battle"&&questions.length>0){
    if(hp<=0||round>=questions.length){
      // 배틀 종료 (보상/저장은 위 useEffect에서 처리 — 렌더 중 setState 금지)
      const cleared=round>=questions.length&&hp>0;
      const stars=cleared?3:score>questions.length/2?1:0;
      return(
        <div style={{minHeight:"100vh",background:T.bg,padding:"40px 20px",textAlign:"center"}}>
          <div style={{fontSize:72,marginBottom:12}}>{cleared?"🏆":hp<=0?"💀":"🎯"}</div>
          <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:6}}>
            {cleared?`World ${selectedWorld.id} 클리어!`:hp<=0?"쓰러졌어요...":"전투 종료"}
          </div>
          {cleared&&<div style={{fontSize:16,marginBottom:8}}>{"⭐".repeat(stars)}</div>}
          <div style={{fontSize:14,color:T.textMid,marginBottom:20}}>보스 {score}/{questions.length} 처치</div>
          <Card style={{maxWidth:280,margin:"0 auto 20px",background:T.yellowLight,padding:14}}>
            <div style={{fontSize:32}}>⭐</div>
            <div style={{fontSize:18,fontWeight:900,color:T.text}}>+{score*20+(cleared?50:0)} 포인트</div>
          </Card>
          <div style={{display:"flex",gap:10,maxWidth:340,margin:"0 auto",flexWrap:"wrap"}}>
            <Btn v="secondary" size="lg" onClick={()=>startBattle(selectedWorld)} style={{flex:1,minWidth:90}}>🔄 재도전</Btn>
            <Btn v="secondary" size="lg" onClick={()=>setScreen("worldMap")} style={{flex:1,minWidth:90}}>🗺️ 월드맵</Btn>
            <Btn v="primary" size="lg" onClick={onExit} style={{flex:1,minWidth:90}}>🏠 홈으로</Btn>
          </div>
        </div>
      );
    }

    const q=questions[round];
    const answered=picked!==null;

    const pick=(idx)=>{
      if(answered)return;
      setPicked(idx);
      const correct=idx===q.ansIdx;
      setFeedback(correct?"correct":"wrong");
      recordWrong(name,q.en,correct);
      if(correct){setScore(s=>s+1);setBossHp(h=>h-1);onCorrect();}
      else{
        onWrong();
        if(shieldActive)setShieldActive(false);
        else setHp(h=>h-1);
      }
      setTimeout(()=>{setPicked(null);setFeedback(null);setRound(r=>r+1);},900);
    };

    const hpBar="❤️".repeat(hp)+"🖤".repeat(Math.max(0,3-hp));
    const bossHpPct=(bossHp/bossMax)*100;

    return(
      <div style={{minHeight:"100vh",background:T.bg,padding:14}}>
        {/* 상단 헤더 - 종료 버튼 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
          <span style={{fontSize:11,fontWeight:700,color:T.textMid}}>World {selectedWorld.id}</span>
          <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
        </div>

        {/* 상태바 */}
        <div style={{background:`linear-gradient(135deg,${selectedWorld.color},${T.purple})`,borderRadius:14,padding:"12px 14px",marginBottom:12,color:"white"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:900}}>{selectedWorld.emoji} {selectedWorld.name}</div>
            <div style={{fontSize:13}}>{hpBar}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6,opacity:.9}}>
            <span>보스 체력</span>
            <span>{bossHp}/{bossMax}</span>
          </div>
          <div style={{height:8,background:"rgba(255,255,255,0.3)",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${bossHpPct}%`,background:"white",borderRadius:4,transition:"width 0.4s"}}/>
          </div>
        </div>

        {/* 보스 */}
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:56,marginBottom:2,filter:feedback==="wrong"?"brightness(0.5)":"none",transition:"filter 0.3s"}}>
            {bossHpPct>60?"😈":bossHpPct>30?"😤":"💀"}
          </div>
          <div style={{fontSize:11,color:T.textMid}}>보스 #{round+1}</div>
        </div>

        {/* 문제 카드 */}
        <Card key={round} style={{marginBottom:12,textAlign:"center",padding:"18px 14px",background:selectedWorld.bg,animation:"fade-in-up 0.35s ease-out"}}>
          <div style={{fontSize:11,fontWeight:800,color:selectedWorld.color,marginBottom:6}}>이 단어의 뜻은? <span style={{color:T.accent,fontWeight:800}}>(단어 탭하면 발음!)</span></div>
          <div
            onClick={()=>speak(q.en)}
            style={{fontSize:32,fontWeight:900,color:T.text,cursor:"pointer",userSelect:"none",transition:"transform 0.1s",display:"inline-block"}}
            onMouseDown={e=>e.currentTarget.style.transform="scale(0.94)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
            onTouchStart={e=>e.currentTarget.style.transform="scale(0.94)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
            title="탭하면 발음을 들을 수 있어요"
          >{q.en}</div>
          <div style={{fontSize:11,color:T.textMid,marginTop:4}}>{q.cat}</div>
          <button
            onClick={(e)=>{e.stopPropagation();speak(q.en);}}
            style={{
              marginTop:10,
              background:"rgba(255,255,255,0.9)",
              border:`2px solid ${selectedWorld.color}`,
              borderRadius:10,
              padding:"5px 14px",
              fontSize:12,
              fontWeight:800,
              cursor:"pointer",
              color:selectedWorld.color,
            }}
          >🔊 발음 듣기</button>
        </Card>

        {/* 아이템 */}
        {battleItems.length>0&&(
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {battleItems.map(item=>(
              <button key={item.id} onClick={()=>useItem(item)} title={item.effect} style={{padding:"6px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,background:T.card,fontSize:13,cursor:"pointer",fontWeight:700}}>
                {item.emoji} {item.name}
              </button>
            ))}
            {shieldActive&&<span style={{fontSize:11,color:T.accent,alignSelf:"center"}}>🛡️ 방어중</span>}
          </div>
        )}

        {/* 보기 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          {q.opts.map((o,idx)=>{
            const isAns=idx===q.ansIdx;
            let bg=T.card,color=T.text,border=T.border;let anim="";
            if(answered){if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";}else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";}}
            return<button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"15px 8px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3,animation:anim?`${anim} 0.45s ease`:"none"}}>{o.ko}</button>;
          })}
        </div>

        {feedback&&(
          <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:feedback==="correct"?T.green:T.red}}>
            {feedback==="correct"?"⚔️ 보스 격파!":shieldActive?"🛡️ 방패가 막았어요!":"💔 목숨 -1"}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑨ 그림 보고 단어 맞추기 (이모지 → 영단어)
// ══════════════════════════════════════════════════════════════════════════

const EMOJI_WORDS = [
  {en:"dog",ko:"강아지",emoji:"🐶"},{en:"cat",ko:"고양이",emoji:"🐱"},
  {en:"pig",ko:"돼지",emoji:"🐷"},{en:"cow",ko:"소",emoji:"🐮"},
  {en:"rabbit",ko:"토끼",emoji:"🐰"},{en:"bear",ko:"곰",emoji:"🐻"},
  {en:"tiger",ko:"호랑이",emoji:"🐯"},{en:"lion",ko:"사자",emoji:"🦁"},
  {en:"elephant",ko:"코끼리",emoji:"🐘"},{en:"monkey",ko:"원숭이",emoji:"🐵"},
  {en:"horse",ko:"말",emoji:"🐴"},{en:"sheep",ko:"양",emoji:"🐑"},
  {en:"chicken",ko:"닭",emoji:"🐔"},{en:"duck",ko:"오리",emoji:"🦆"},
  {en:"fish",ko:"물고기",emoji:"🐟"},{en:"frog",ko:"개구리",emoji:"🐸"},
  {en:"snake",ko:"뱀",emoji:"🐍"},{en:"turtle",ko:"거북",emoji:"🐢"},
  {en:"apple",ko:"사과",emoji:"🍎"},{en:"banana",ko:"바나나",emoji:"🍌"},
  {en:"orange",ko:"오렌지",emoji:"🍊"},{en:"grape",ko:"포도",emoji:"🍇"},
  {en:"strawberry",ko:"딸기",emoji:"🍓"},{en:"watermelon",ko:"수박",emoji:"🍉"},
  {en:"bread",ko:"빵",emoji:"🍞"},{en:"pizza",ko:"피자",emoji:"🍕"},
  {en:"hamburger",ko:"햄버거",emoji:"🍔"},{en:"cake",ko:"케이크",emoji:"🎂"},
  {en:"ice cream",ko:"아이스크림",emoji:"🍦"},{en:"egg",ko:"달걀",emoji:"🥚"},
  {en:"sun",ko:"해",emoji:"☀️"},{en:"moon",ko:"달",emoji:"🌙"},
  {en:"star",ko:"별",emoji:"⭐"},{en:"rain",ko:"비",emoji:"🌧️"},
  {en:"snow",ko:"눈",emoji:"❄️"},{en:"tree",ko:"나무",emoji:"🌳"},
  {en:"flower",ko:"꽃",emoji:"🌸"},{en:"book",ko:"책",emoji:"📚"},
  {en:"pencil",ko:"연필",emoji:"✏️"},{en:"school",ko:"학교",emoji:"🏫"},
  {en:"car",ko:"자동차",emoji:"🚗"},{en:"bus",ko:"버스",emoji:"🚌"},
  {en:"airplane",ko:"비행기",emoji:"✈️"},{en:"ship",ko:"배",emoji:"🚢"},
  {en:"house",ko:"집",emoji:"🏠"},{en:"hospital",ko:"병원",emoji:"🏥"},
  {en:"heart",ko:"심장/하트",emoji:"❤️"},{en:"fire",ko:"불",emoji:"🔥"},
  {en:"water",ko:"물",emoji:"💧"},{en:"music",ko:"음악",emoji:"🎵"},
];

export function PictureWordGame({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState(null); // null=선택 | "en" | "ko"
  const [angelaState, setAngelaState] = useState("thinking"); // Angela 즉시 반응용
  const awardedRef = useRef(false);

  const questions = useMemo(() => {
    const pool = shuffle(EMOJI_WORDS).slice(0, 10);
    return pool.map(w => {
      const wrongs = shuffle(EMOJI_WORDS.filter(x => x.en !== w.en)).slice(0, 3);
      const opts = shuffle([w, ...wrongs]);
      return { ...w, opts };
    });
  }, []);

  const gameOver = mode !== null && round >= questions.length;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 10;
    saveGameRecord(setStudents, name, "그림단어", score, questions.length, pts);
    onFinish(score, questions.length);
  }, [gameOver, score, questions.length, name, setStudents]);

  if (!mode) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:56,marginBottom:8}}>🖼️</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text}}>그림 보고 단어 맞추기</div>
        <div style={{fontSize:13,color:T.textMid,marginTop:4}}>어떤 방향으로 풀까요?</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:400,margin:"0 auto"}}>
        {[
          {id:"en",label:"🖼️ → 🇺🇸 영어 맞추기",desc:"그림 보고 영어 단어 선택",bg:T.accentLight,c:T.accent},
          {id:"ko",label:"🖼️ → 🇰🇷 한글 맞추기",desc:"그림 보고 한글 뜻 선택",bg:T.greenLight,c:T.green},
        ].map(m => (
          <Card key={m.id} onClick={()=>setMode(m.id)} style={{display:"flex",alignItems:"center",gap:14,background:m.bg,border:`2px solid ${m.c}33`}}>
            <div style={{fontSize:28,flex:0}}>{m.id==="en"?"🇺🇸":"🇰🇷"}</div>
            <div><div style={{fontSize:15,fontWeight:900,color:T.text}}>{m.label}</div><div style={{fontSize:12,color:T.textMid}}>{m.desc}</div></div>
            <div style={{marginLeft:"auto",fontSize:20,color:T.textDim}}>›</div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (gameOver) {
    const pts = score * 10;
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:14}}>{score>=8?"🎉":score>=5?"👏":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>{score} / {questions.length}</div>
        <Card style={{maxWidth:280,margin:"16px auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:32}}>⭐</div><div style={{fontSize:16,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
        </Card>
        <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
          <Btn v="secondary" size="lg" onClick={()=>{setRound(0);setScore(0);setPicked(null);setMode(null);awardedRef.current=false;}} style={{flex:1}}>🔄 다시</Btn>
          <Btn v="primary" size="lg" onClick={onExit} style={{flex:1}}>홈으로</Btn>
        </div>
      </div>
    );
  }

  const q = questions[round];
  const answered = picked !== null;
  const ansIdx = q.opts.findIndex(o => o.en === q.en);

  const pick = (idx) => {
    if (answered) return;
    
    // 즉시 Angela 상태 변경
    const isCorrect = idx === ansIdx;
    setAngelaState(isCorrect ? "happy" : "oops");
    
    setPicked(idx);
    if (isCorrect) { setScore(s => s+1); onCorrect(); } else onWrong();
    recordWrong(name, q.en, isCorrect);
    setTimeout(() => { 
      setPicked(null); 
      setAngelaState("thinking"); // 다음 문제로
      setRound(r => r+1); 
    }, 900);
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>{round+1}/{questions.length}</span>
        <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
      </div>
      <div style={{height:9,background:T.border,borderRadius:T.radiusFull,marginBottom:16,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:`linear-gradient(90deg,${mode==="en"?T.accent:T.green},${mode==="en"?T.purple:T.teal})`,borderRadius:T.radiusFull,transition:"width 0.4s cubic-bezier(.34,1.56,.64,1)"}}/>
      </div>

      <Card key={round} style={{marginBottom:16,textAlign:"center",padding:"28px 16px 32px",background:mode==="en"?T.accentLight:T.greenLight,animation:"fade-in-up 0.35s ease-out",position:"relative",overflow:"hidden"}}>
        {/* 은은한 배경 데코 */}
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.4)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-40,left:-20,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,0.3)",pointerEvents:"none"}}/>
        <div style={{fontSize:11,color:T.textMid,fontWeight:700,marginBottom:14,position:"relative"}}>이 그림의 {mode==="en"?"영어 단어는?":"한글 뜻은?"} <span style={{color:T.accent,fontWeight:800}}>(그림 탭하면 발음! 🔊)</span></div>
        
        {/* 이모지 원형 - 중앙 */}
        <div
          onClick={()=>speak(q.en)}
          style={{
            width:150,height:150,margin:"0 auto 14px",
            background:"white",borderRadius:"50%",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:84,lineHeight:1,cursor:"pointer",userSelect:"none",
            boxShadow:"0 8px 24px rgba(0,0,0,0.10), inset 0 -4px 8px rgba(0,0,0,0.04)",
            transition:"transform 0.15s cubic-bezier(.34,1.56,.64,1)",position:"relative"
          }}
          onMouseDown={e=>e.currentTarget.style.transform="scale(0.92)"}
          onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
          onTouchStart={e=>e.currentTarget.style.transform="scale(0.92)"}
          onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
          title="탭하면 발음을 들을 수 있어요"
        >{q.emoji}</div>
        <div style={{fontSize:13,fontWeight:700,color:T.textMid,marginBottom:12,position:"relative"}}>{mode==="en"?q.ko:q.en}</div>
        <button
          onClick={(e)=>{e.stopPropagation();speak(q.en);}}
          style={{
            background:"white",
            border:"none",
            borderRadius:T.radiusFull,
            padding:"9px 20px",
            fontSize:13,
            fontWeight:800,
            cursor:"pointer",
            color:mode==="en"?T.accent:T.green,
            display:"inline-flex",
            alignItems:"center",
            gap:6,
            boxShadow:"0 3px 10px rgba(0,0,0,0.08)",
            position:"relative",
          }}
        >🔊 발음 듣기</button>
      </Card>
      
      {/* 보기 위 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {q.opts.slice(0, 2).map((o,idx) => {
          const isAns = idx === ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if (answered){ if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";} else if(idx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";} }
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"20px 12px",borderRadius:T.radiusLg,border:`2.5px solid ${border}`,background:bg,color,fontSize:16,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3,animation:anim?`${anim} 0.45s ease`:"none",boxShadow:answered?"none":"0 2px 8px rgba(0,0,0,0.05)"}}>
            {mode==="en"?o.en:o.ko}
          </button>;
        })}
      </div>

      {/* Angela - 보기 사이에 배치 */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
        <AngelaCharacter 
          state={angelaState}
          size={90}
        />
      </div>

      {/* 보기 아래 2개 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {q.opts.slice(2, 4).map((o,idx) => {
          const realIdx = idx + 2; // 실제 인덱스는 2, 3
          const isAns = realIdx === ansIdx;
          let bg=T.card,color=T.text,border=T.border;let anim="";
          if (answered){ if(isAns){bg=T.green;color="white";border=T.green;anim="answer-pop";} else if(realIdx===picked){bg=T.red;color="white";border=T.red;anim="wrong-shake";} }
          return <button key={realIdx} onClick={()=>pick(realIdx)} disabled={answered} style={{padding:"20px 12px",borderRadius:T.radiusLg,border:`2.5px solid ${border}`,background:bg,color,fontSize:16,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3,animation:anim?`${anim} 0.45s ease`:"none",boxShadow:answered?"none":"0 2px 8px rgba(0,0,0,0.05)"}}>
            {mode==="en"?o.en:o.ko}
          </button>;
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑩ 단어-뜻 연결하기 (Match Lines)
// ══════════════════════════════════════════════════════════════════════════
export function WordMatchLines({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);   // 라운드 (6단어 1세트)
  const [score, setScore] = useState(0);
  const [selLeft, setSelLeft] = useState(null);  // 선택된 왼쪽 idx
  const [matched, setMatched] = useState({});    // {leftIdx: rightIdx}
  const [wrong, setWrong] = useState(null);      // 틀린 쌍 표시용
  const [done, setDone] = useState(false);
  const awardedRef = useRef(false);

  const ROUNDS = 3;
  const PER = 6;

  const sets = useMemo(() => {
    const pool = shuffle(ALL_WORDS.filter(w=>!w.en.includes(" "))).slice(0, ROUNDS * PER);
    return Array.from({length: ROUNDS}, (_, i) => {
      const words = pool.slice(i*PER, (i+1)*PER);
      return { left: words, right: shuffle([...words]) };
    });
  }, []);

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!done || awardedRef.current) return;
    awardedRef.current = true;
    const total = ROUNDS * PER;
    const pts = score * 10;
    saveGameRecord(setStudents, name, "단어연결", score, total, pts);
    onFinish(score, total);
  }, [done, score, name, setStudents]);

  const cur = sets[round];
  const allMatched = Object.keys(matched).length === PER;

  const handleLeft = (idx) => { if (matched[idx] !== undefined) return; setSelLeft(idx); };

  const handleRight = (idx) => {
    if (selLeft === null) return;
    const correctRightIdx = cur.right.findIndex(w => w.en === cur.left[selLeft].en);
    if (idx === correctRightIdx) {
      setMatched(m => ({...m, [selLeft]: idx}));
      setScore(s => s+1);
      setSelLeft(null);
    } else {
      setWrong({left:selLeft, right:idx});
      setTimeout(() => { setWrong(null); setSelLeft(null); }, 600);
    }
  };

  const nextRound = () => {
    if (round < ROUNDS-1) { setRound(r=>r+1); setMatched({}); setSelLeft(null); }
    else setDone(true);
  };

  if (done) {
    const total = ROUNDS * PER;
    const pts = score * 10;
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:14}}>{score>=total*.8?"🎉":score>=total*.5?"👏":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>{score} / {ROUNDS*PER}</div>
        <Card style={{maxWidth:280,margin:"16px auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:32}}>⭐</div><div style={{fontSize:16,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  // 매칭된 왼쪽 idx → 오른쪽 idx 역방향 맵
  const matchedRight = new Set(Object.values(matched));

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:T.purple}}>라운드 {round+1}/{ROUNDS}</span>
        <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(Object.keys(matched).length/PER)*100}%`,background:T.purple,borderRadius:3,transition:"width 0.3s"}}/>
      </div>
      <div style={{fontSize:12,color:T.textMid,textAlign:"center",marginBottom:12}}>
        왼쪽 영어 단어와 오른쪽 한글 뜻을 연결하세요
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {/* 왼쪽: 영어 */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {cur.left.map((w,i) => {
            const isMatched = matched[i] !== undefined;
            const isSel = selLeft === i;
            const isWrong = wrong?.left === i;
            return (
              <button key={i} onClick={()=>handleLeft(i)} style={{
                padding:"12px 10px",borderRadius:11,fontSize:13,fontWeight:800,
                border:`2px solid ${isWrong?T.red:isSel?T.purple:isMatched?T.green:T.border}`,
                background:isWrong?T.redLight:isSel?T.purpleLight:isMatched?T.greenLight:T.card,
                color:isMatched?T.green:isSel?T.purple:T.text,
                cursor:isMatched?"default":"pointer",textAlign:"center",transition:"all 0.2s"
              }}>{w.en}</button>
            );
          })}
        </div>
        {/* 오른쪽: 한글 */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {cur.right.map((w,i) => {
            const isMatched = matchedRight.has(i);
            const isWrong = wrong?.right === i;
            return (
              <button key={i} onClick={()=>handleRight(i)} style={{
                padding:"12px 10px",borderRadius:11,fontSize:13,fontWeight:800,
                border:`2px solid ${isWrong?T.red:isMatched?T.green:T.border}`,
                background:isWrong?T.redLight:isMatched?T.greenLight:T.card,
                color:isMatched?T.green:T.text,
                cursor:isMatched?"default":"pointer",textAlign:"center",transition:"all 0.2s"
              }}>{w.ko}</button>
            );
          })}
        </div>
      </div>

      {allMatched && (
        <Btn v="primary" size="lg" onClick={nextRound} style={{width:"100%"}}>
          {round<ROUNDS-1?"다음 라운드 →":"결과 보기 🎉"}
        </Btn>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑪ 단어 찾기 퍼즐 (Word Search)
// ══════════════════════════════════════════════════════════════════════════
function buildGrid(words, size=10) {
  const grid = Array.from({length:size}, ()=>Array(size).fill(""));
  const placed = [];
  const dirs = [[0,1],[1,0],[1,1],[0,-1],[-1,0]]; // 가로/세로/대각/역방향

  for (const word of words) {
    const w = word.en.toUpperCase().replace(/\s/g,"");
    if (w.length > size) continue;
    let success = false;
    for (let attempt=0; attempt<80 && !success; attempt++) {
      const [dr,dc] = dirs[Math.floor(Math.random()*dirs.length)];
      const maxR = dr>0?size-w.length:dr<0?w.length-1:size-1;
      const maxC = dc>0?size-w.length:dc<0?w.length-1:size-1;
      if (maxR<0||maxC<0) continue;
      const r = Math.floor(Math.random()*(maxR+1))+(dr<0?w.length-1:0);
      const c = Math.floor(Math.random()*(maxC+1))+(dc<0?w.length-1:0);
      let ok = true;
      for (let k=0;k<w.length;k++) {
        const cr=r+dr*k, cc=c+dc*k;
        if (cr<0||cr>=size||cc<0||cc>=size) {ok=false;break;}
        if (grid[cr][cc]&&grid[cr][cc]!==w[k]) {ok=false;break;}
      }
      if (ok) {
        for (let k=0;k<w.length;k++) grid[r+dr*k][c+dc*k]=w[k];
        placed.push({word:w,original:word,r,c,dr,dc,len:w.length});
        success = true;
      }
    }
  }
  const alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r=0;r<size;r++) for (let c=0;c<size;c++)
    if (!grid[r][c]) grid[r][c]=alpha[Math.floor(Math.random()*alpha.length)];
  return {grid, placed};
}

export function WordSearchGame({ name, setStudents, onExit }) {
  const SIZE = 10;
  const WORD_COUNT = 8;

  const { grid, placed, words } = useMemo(() => {
    const ws = shuffle(ALL_WORDS.filter(w=>!w.en.includes(" ")&&w.en.length>=3&&w.en.length<=7)).slice(0, WORD_COUNT);
    const {grid,placed} = buildGrid(ws, SIZE);
    return {grid,placed,words:ws};
  }, []);

  const [selecting, setSelecting] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const [curCell, setCurCell] = useState(null);
  const [found, setFound] = useState([]); // [wordStr]
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const awardedRef = useRef(false);

  useEffect(()=>{
    timerRef.current = setInterval(()=>setElapsed(e=>e+1),1000);
    return ()=>clearInterval(timerRef.current);
  },[]);

  useEffect(()=>{
    if (found.length===placed.length&&placed.length>0) {
      clearInterval(timerRef.current);
      setDone(true);
    }
  },[found,placed]);

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!done || awardedRef.current) return;
    awardedRef.current = true;
    const pts = found.length * 15;
    saveGameRecord(setStudents, name, "단어찾기퍼즐", found.length, placed.length, pts);
    onFinish(found.length, placed.length);
  }, [done, found.length, placed.length, name, setStudents]);

  // 현재 선택 중인 셀들 계산
  const getSelected = () => {
    if (!startCell||!curCell) return new Set();
    const cells = new Set();
    const dr = Math.sign(curCell.r-startCell.r);
    const dc = Math.sign(curCell.c-startCell.c);
    const steps = Math.max(Math.abs(curCell.r-startCell.r),Math.abs(curCell.c-startCell.c));
    for (let k=0;k<=steps;k++) cells.add(`${startCell.r+dr*k},${startCell.c+dc*k}`);
    return cells;
  };

  // 찾은 단어 셀들
  const foundCells = useMemo(()=>{
    const s=new Set();
    placed.filter(p=>found.includes(p.word)).forEach(p=>{
      for (let k=0;k<p.len;k++) s.add(`${p.r+p.dr*k},${p.c+p.dc*k}`);
    });
    return s;
  },[found,placed]);

  const tryMatch = (start,end) => {
    const dr=Math.sign(end.r-start.r), dc=Math.sign(end.c-start.c);
    const steps=Math.max(Math.abs(end.r-start.r),Math.abs(end.c-start.c));
    let word="";
    for (let k=0;k<=steps;k++) {
      const r=start.r+dr*k,c=start.c+dc*k;
      if (r<0||r>=SIZE||c<0||c>=SIZE) return;
      word+=grid[r][c];
    }
    const hit=placed.find(p=>p.word===word&&!found.includes(p.word));
    if (hit) setFound(f=>[...f,hit.word]);
  };

  const selected = getSelected();
  const CELL = 30;

  if (done) {
    const pts = found.length * 15;
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"48px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:12}}>🔍</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:4}}>{found.length}/{placed.length}단어 발견!</div>
        <div style={{fontSize:13,color:T.textMid,marginBottom:16}}>⏱️ {elapsed}초</div>
        <Card style={{maxWidth:280,margin:"0 auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:32}}>⭐</div><div style={{fontSize:16,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:T.green}}>✓ {found.length}/{placed.length}</span>
        <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>⏱️ {elapsed}초</span>
      </div>

      {/* 찾을 단어 목록 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {placed.map(p=>(
          <span key={p.word} style={{fontSize:12,fontWeight:800,padding:"3px 10px",borderRadius:8,
            background:found.includes(p.word)?T.green:T.card,
            color:found.includes(p.word)?"white":T.text,
            border:`1px solid ${found.includes(p.word)?T.green:T.border}`,
            textDecoration:found.includes(p.word)?"line-through":"none"}}>
            {p.original.en}
          </span>
        ))}
      </div>

      {/* 그리드 */}
      <div style={{overflowX:"auto",marginBottom:12}}>
        <div style={{display:"inline-block",userSelect:"none",touchAction:"none"}}>
          {grid.map((row,r)=>(
            <div key={r} style={{display:"flex"}}>
              {row.map((ch,c)=>{
                const key=`${r},${c}`;
                const isSel=selected.has(key);
                const isFound=foundCells.has(key);
                return (
                  <div key={c}
                    onMouseDown={()=>{setSelecting(true);setStartCell({r,c});setCurCell({r,c});}}
                    onMouseEnter={()=>{if(selecting){setCurCell({r,c});}}}
                    onMouseUp={()=>{if(selecting&&startCell){tryMatch(startCell,{r,c});}setSelecting(false);setStartCell(null);setCurCell(null);}}
                    onTouchStart={()=>{setSelecting(true);setStartCell({r,c});setCurCell({r,c});}}
                    onTouchMove={(e)=>{
                      const t=e.touches[0];
                      const el=document.elementFromPoint(t.clientX,t.clientY);
                      if(el?.dataset?.cell){const[cr,cc]=el.dataset.cell.split(",").map(Number);setCurCell({r:cr,c:cc});}
                    }}
                    onTouchEnd={()=>{if(selecting&&startCell&&curCell)tryMatch(startCell,curCell);setSelecting(false);setStartCell(null);setCurCell(null);}}
                    data-cell={`${r},${c}`}
                    style={{
                      width:CELL,height:CELL,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,fontWeight:800,borderRadius:6,margin:1,cursor:"pointer",
                      background:isFound?T.green:isSel?T.purple:T.card,
                      color:isFound||isSel?"white":T.text,
                      border:`1px solid ${isFound?T.green:isSel?T.purpleDark||T.purple:T.border}`,
                      transition:"background 0.1s"
                    }}>{ch}</div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 뜻 힌트 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {placed.map(p=>(
          <span key={p.word} style={{fontSize:10,color:T.textMid,padding:"2px 7px",borderRadius:6,background:T.bg,border:`1px solid ${T.border}`}}>
            {p.original.en} = {p.original.ko}
          </span>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ⑫ 받아쓰기 (Dictation)
// ══════════════════════════════════════════════════════════════════════════
export function DictationGame({ name, setStudents, onExit }) {
  const [mode, setMode] = useState(null); // null | "word" | "sentence"
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [played, setPlayed] = useState(false);
  const inputRef = useRef(null);
  const awardedRef = useRef(false);

  const SENTENCES = [
    "I am a student.","She is my friend.","They are happy.",
    "He eats breakfast every day.","We go to school together.",
    "Can you speak English?","I like to read books.",
    "The dog is very cute.","May I use your pencil?",
    "She studied hard for the test.",
  ];

  const questions = useMemo(() => {
    if (!mode) return [];
    if (mode==="word") return shuffle(ALL_WORDS.filter(w=>!w.en.includes(" "))).slice(0,10);
    return shuffle(SENTENCES).slice(0,8).map(s=>({en:s,ko:"문장 받아쓰기"}));
  },[mode]);

  const gameOver = mode !== null && round >= questions.length;

  // ✅ 게임 종료 시 점수 저장 (한 번만)
  useEffect(() => {
    if (!gameOver || awardedRef.current) return;
    awardedRef.current = true;
    const pts = score * 12;
    saveGameRecord(setStudents, name, "받아쓰기", score, questions.length, pts);
    onFinish(score, questions.length);
  }, [gameOver, score, questions.length, name, setStudents]);

  const speakQ = () => {
    if (!questions[round]) return;
    const text = questions[round].en;
    if (!isBrowser||!window.speechSynthesis) { alert("이 브라우저는 음성을 지원하지 않아요"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang="en-US"; u.rate=mode==="word"?0.8:0.7;
    window.speechSynthesis.speak(u);
    setPlayed(true);
    setTimeout(()=>inputRef.current?.focus(), 300);
  };

  const check = () => {
    if (!input.trim()) return;
    const ans = questions[round].en.toLowerCase().replace(/[.,!?]/g,"").trim();
    const inp = input.toLowerCase().replace(/[.,!?]/g,"").trim();
    const correct = ans===inp;
    setFeedback(correct?"correct":"wrong");
    if (correct) { setScore(s=>s+1); onCorrect(); } else onWrong();
    recordWrong(name, questions[round].en, correct);
  };

  const next = () => { setFeedback(null); setInput(""); setPlayed(false); setRound(r=>r+1); };

  if (!mode) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:52,marginBottom:8}}>🎤</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text}}>받아쓰기</div>
        <div style={{fontSize:13,color:T.textMid,marginTop:4}}>듣고 영어로 써보세요!</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:400,margin:"0 auto"}}>
        {[
          {id:"word",label:"🔤 단어 받아쓰기",desc:"영어 단어를 듣고 타이핑",bg:T.accentLight,c:T.accent},
          {id:"sentence",label:"📝 문장 받아쓰기",desc:"영어 문장을 듣고 타이핑",bg:T.purpleLight,c:T.purple},
        ].map(m=>(
          <Card key={m.id} onClick={()=>setMode(m.id)} style={{display:"flex",alignItems:"center",gap:14,background:m.bg,border:`2px solid ${m.c}33`}}>
            <div style={{fontSize:28}}>{m.id==="word"?"🔤":"📝"}</div>
            <div><div style={{fontSize:15,fontWeight:900,color:T.text}}>{m.label}</div><div style={{fontSize:12,color:T.textMid}}>{m.desc}</div></div>
            <div style={{marginLeft:"auto",fontSize:20,color:T.textDim}}>›</div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (gameOver) {
    const total=questions.length;
    const pts=score*12;
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:14}}>{score>=total*.8?"🎉":score>=total*.5?"👏":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>{score}/{total}</div>
        <Card style={{maxWidth:280,margin:"16px auto 20px",background:T.yellowLight,padding:14}}>
          <div style={{fontSize:32}}>⭐</div><div style={{fontSize:16,fontWeight:900,color:T.text}}>+{pts} 포인트</div>
        </Card>
        <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
          <Btn v="secondary" size="lg" onClick={()=>{setRound(0);setScore(0);setInput("");setFeedback(null);setPlayed(false);setMode(null);awardedRef.current=false;}} style={{flex:1}}>🔄 다시</Btn>
          <Btn v="primary" size="lg" onClick={onExit} style={{flex:1}}>홈으로</Btn>
        </div>
      </div>
    );
  }

  const q = questions[round];
  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <span style={{fontSize:12,fontWeight:700,color:mode==="word"?T.accent:T.purple}}>{round+1}/{questions.length}</span>
        <span key={score} style={{fontSize:12,fontWeight:700,color:T.yellow,display:"inline-block",animation:"pop-once 0.35s ease-out"}}>⭐{score}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:20,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:mode==="word"?T.accent:T.purple,borderRadius:3,transition:"width 0.3s"}}/>
      </div>

      {/* 듣기 버튼 */}
      <Card style={{marginBottom:16,textAlign:"center",padding:"28px 20px",background:mode==="word"?T.accentLight:T.purpleLight}}>
        <div style={{fontSize:13,color:T.textMid,fontWeight:700,marginBottom:12}}>
          {mode==="word"?"단어를 듣고 영어로 써보세요":"문장을 듣고 영어로 받아쓰세요"}
        </div>
        <button onClick={speakQ} style={{width:72,height:72,borderRadius:"50%",border:"none",fontSize:36,cursor:"pointer",background:mode==="word"?T.accent:T.purple,color:"white",boxShadow:T.shadow,marginBottom:8}}>🔊</button>
        <div style={{fontSize:12,color:T.textMid}}>버튼을 눌러 듣기</div>
        {feedback==="correct"&&<div style={{marginTop:8,fontSize:13,fontWeight:900,color:T.green}}>정답: {q.en}</div>}
        {feedback==="wrong"&&<div style={{marginTop:8,fontSize:13,fontWeight:900,color:T.red}}>정답: <strong>{q.en}</strong></div>}
        {q.ko&&mode==="word"&&<div style={{marginTop:6,fontSize:12,color:T.textMid}}>힌트: {q.ko}</div>}
      </Card>

      <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!feedback){check();}else if(e.key==="Enter"&&feedback)next();}}
        placeholder={played?"영어로 입력하세요...":"🔊 버튼을 먼저 눌러주세요"}
        disabled={!!feedback||!played}
        style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:12,border:`2px solid ${feedback==="correct"?T.green:feedback==="wrong"?T.red:T.accent}`,fontSize:16,outline:"none",marginBottom:10,fontWeight:700}}
      />

      {!feedback ? (
        <Btn v="primary" size="lg" onClick={check} disabled={!input.trim()||!played} style={{width:"100%"}}>✓ 확인 (Enter)</Btn>
      ) : (
        <Btn v={feedback==="correct"?"success":"danger"} size="lg" onClick={next} style={{width:"100%"}}>
          {feedback==="correct"?"✓ 정답! → 다음":"✗ 오답 → 다음"}
        </Btn>
      )}
    </div>
  );
}
