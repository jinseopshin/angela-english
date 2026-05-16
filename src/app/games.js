"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ALL_WORDS, getWordsByLevel } from "./wordData";

// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — games.js
//   8개 신규 게임: 메모리카드 / 데일리챌린지 / 단어월드RPG /
//                  오답노트 / 애너그램 / 타이핑레이스 / 릴레이 / 스무고개
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg:"#f0f7ff", card:"#ffffff", border:"#dce8ff",
  accent:"#4f8ef7", accentLight:"#e8f0ff",
  green:"#22c55e", greenLight:"#dcfce7",
  red:"#ef4444", redLight:"#fee2e2",
  yellow:"#f59e0b", yellowLight:"#fef3c7",
  purple:"#a855f7", purpleLight:"#f3e8ff",
  pink:"#ec4899", pinkLight:"#fce7f3",
  orange:"#f97316", orangeLight:"#fff7ed",
  teal:"#14b8a6", tealLight:"#ccfbf1",
  text:"#1e293b", textMid:"#64748b", textDim:"#94a3b8",
  shadow:"0 4px 16px rgba(79,142,247,0.12)",
  shadowLg:"0 8px 32px rgba(79,142,247,0.18)",
};

// ── SSR 안전 유틸 ──────────────────────────────────────────────────────────
const isBrowser = typeof window !== "undefined";
const ls = {
  get: (key, fallback=null) => {
    if (!isBrowser) return fallback;
    try { const v=ls.raw(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (key, val) => {
    if (!isBrowser) return;
    try { ls.set(key, val); } catch {}
  },
  raw: (key) => {
    if (!isBrowser) return null;
    try { return ls.raw(key); } catch { return null; }
  },
};
const safeRAF = (cb) => isBrowser ? safeRAF(cb) : 0;
const safeCAF = (id) => { if (isBrowser && id) cancelAnimationFrame(id); };

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const uid = () => Math.random().toString(36).slice(2, 9);

function Btn({ children, onClick, v="primary", size="md", style={}, disabled }) {
  const vs = {
    primary:{bg:T.accent,color:"white"}, secondary:{bg:T.accentLight,color:T.accent},
    danger:{bg:T.red,color:"white"}, success:{bg:T.green,color:"white"},
    ghost:{bg:"transparent",color:T.textMid}, warning:{bg:T.yellow,color:"white"},
  }[v];
  const sz = {sm:{padding:"5px 10px",fontSize:11},md:{padding:"9px 16px",fontSize:13},lg:{padding:"12px 20px",fontSize:14}}[size];
  return <button onClick={onClick} disabled={disabled} style={{...sz,...vs,border:"none",borderRadius:10,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,transition:"all 0.15s",...style}}>{children}</button>;
}

function Card({ children, style={}, onClick }) {
  return <div onClick={onClick} style={{background:T.card,borderRadius:16,padding:16,boxShadow:T.shadow,border:`1px solid ${T.border}`,cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}

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

  // 타이머
  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startTime)/1000)), 200);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  const initGame = useCallback((n) => {
    const pool = shuffle(ALL_WORDS).slice(0, n);
    const deck = shuffle([
      ...pool.map((w,i) => ({ id:`en${i}`, word:w, side:"en", pairId:i })),
      ...pool.map((w,i) => ({ id:`ko${i}`, word:w, side:"ko", pairId:i })),
    ]);
    setCards(deck); setFlipped([]); setMatched(new Set());
    setMoves(0); setDone(false); setElapsed(0);
    setStartTime(Date.now());
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
          const bonus = Math.max(0, 200 - elapsed);
          if (typeof setStudents==="function") {
            setStudents(prev => {
              const s = prev[name]||{};
              const pts = nm.size * 10 + bonus;
              return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"메모리카드",score:nm.size,total:nm.size,points:pts,date:new Date().toISOString()}].slice(-50)}};
            });
          }
        }
      } else setTimeout(() => setFlipped([]), 900);
    }
  }, [flipped, matched, cards, elapsed, name, setStudents]);

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
    if (typeof setStudents==="function") {
      setStudents(prev=>{
        const s=prev[name]||{};
        return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"데일리챌린지",score,total:5,points:pts,date:new Date().toISOString()}].slice(-50)}};
      });
    }
    ls.set(storageKey, {score, completedAt:new Date().toISOString()});
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
    setPicked(idx);
    if (idx===q.ansIdx) setScore(s=>s+1);
  };

  const next = () => {
    setPicked(null);
    if (round < dailyWords.length-1) setRound(r=>r+1);
    else setPhase("result");
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
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
      <Card style={{marginBottom:12,textAlign:"center",padding:"24px 16px",background:T.yellowLight}}>
        <div style={{fontSize:11,color:T.textMid,marginBottom:8,fontWeight:700}}>뜻을 보고 영어 단어를 고르세요</div>
        <div style={{fontSize:38,fontWeight:900,color:T.yellow}}>{q.ko}</div>
        <div style={{fontSize:11,color:T.textMid,marginTop:6}}>{q.cat}</div>
      </Card>

      {/* 보기 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;
          if (answered){if(isAns){bg=T.green;color="white";border=T.green;}else if(idx===picked){bg=T.red;color="white";border=T.red;}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"18px 10px",borderRadius:13,border:`2px solid ${border}`,background:bg,color,fontSize:15,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s"}}>{o.en}</button>;
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

  if (wrongWords.length===0) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:12}}>🎉</div>
      <div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:8}}>오답 노트가 비어있어요!</div>
      <div style={{fontSize:13,color:T.textMid,marginBottom:20}}>단어 게임을 더 많이 해보면<br/>틀린 단어들이 여기 모여요</div>
      <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
    </div>
  );

  if (done || round>=wrongWords.length) {
    const pts=score*12;
    if(typeof setStudents==="function"){
      setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"오답노트",score,total:wrongWords.length,points:pts,date:new Date().toISOString()}].slice(-50)}};});
    }
    return <ResultScreen score={score} total={wrongWords.length} title="오답 노트 복습 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setDone(false);setPicked(null);}} />;
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
      if(idx===q.ansIdx){data[q.en].correct++;setScore(s=>s+1);}
      else data[q.en].wrong++;
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
      <Card style={{marginBottom:12,textAlign:"center",padding:"22px 16px",background:T.redLight,border:`1.5px solid ${T.red}30`}}>
        <div style={{fontSize:11,color:T.red,marginBottom:6,fontWeight:800}}>📝 복습 단어</div>
        <div style={{fontSize:38,fontWeight:900,color:T.red}}>{q.ko}</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;}else if(idx===picked){bg=T.red;color="white";border=T.red;}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"18px 10px",borderRadius:13,border:`2px solid ${border}`,background:bg,color,fontSize:15,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s"}}>{o.en}</button>;
        })}
      </div>
      {answered&&<div><div style={{textAlign:"center",fontSize:14,fontWeight:900,color:picked===q.ansIdx?T.green:T.red,marginBottom:10}}>{picked===q.ansIdx?"✓ 이번엔 맞았어요!":"✗ 정답: "+q.en}</div><Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>{round<wrongWords.length-1?"다음 →":"결과 보기"}</Btn></div>}
    </div>
  );
}

// 오답 기록 저장 헬퍼 (다른 게임에서 호출)
export function recordWrong(name, wordEn, isCorrect) {
  try {
    const key=`angela_wrong_${name}`;
    const data=ls.get(key, {});
    data[wordEn]=data[wordEn]||{wrong:0,correct:0};
    if(isCorrect)data[wordEn].correct++; else data[wordEn].wrong++;
    ls.set(key, data);
  } catch {}
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

  const questions = useMemo(()=>shuffle(ALL_WORDS.filter(w=>w.en.length>=3&&w.en.length<=8&&!w.en.includes(" "))).slice(0,10),[]);

  useEffect(()=>{
    if(round<questions.length){
      const w=questions[round];
      setTiles(shuffle(w.en.split("").map((c,i)=>({id:`${i}_${c}`,char:c}))));
      setAnswer([]);
      setFeedback(null);
    }
  },[round,questions]);

  if(done||round>=questions.length){
    const pts=score*15;
    if(typeof setStudents==="function"){setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"애너그램",score,total:questions.length,points:pts,date:new Date().toISOString()}].slice(-50)}};});}
    return <ResultScreen score={score} total={questions.length} title="애너그램 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setDone(false);}} />;
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
    if(correct)setScore(s=>s+1);
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
        <span style={{fontSize:12,fontWeight:700,color:T.yellow}}>⭐{score}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:T.purple,borderRadius:3,transition:"width 0.3s"}}/>
      </div>

      <Card style={{marginBottom:14,textAlign:"center",padding:"20px 16px",background:T.purpleLight}}>
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
    const pts=score*8;
    if(typeof setStudents==="function"){setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"타이핑레이스",score,total:score,points:pts,date:new Date().toISOString()}].slice(-50)}};});}
    return <ResultScreen score={score} total={score} title={`Lv.${level} 도달! · 단어 ${score}개 격파!`} onExit={onExit} onRetry={()=>{setScore(0);setLives(3);setFalling([]);setDone(false);setLevel(1);setStarted(false);}} />;
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
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
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

  if(done||round>=chain.length){
    const bonus=maxCombo>=5?50:maxCombo>=3?20:0;
    const pts=score*10+bonus;
    if(typeof setStudents==="function"){setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"단어릴레이",score,total:chain.length,points:pts,date:new Date().toISOString()}].slice(-50)}};});}
    return <ResultScreen score={score} total={chain.length} bonus={bonus} title={`최고 콤보 ${maxCombo}! 릴레이 완료!`} onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setCombo(0);setMaxCombo(0);setDone(false);setPicked(null);}} />;
  }

  const q=chain[round];
  const prev=round>0?chain[round-1]:null;
  const answered=picked!==null;

  const pick=(idx)=>{
    if(answered)return;
    setPicked(idx);
    if(idx===q.ansIdx){
      setScore(s=>s+1);
      const nc=combo+1;
      setCombo(nc);
      setMaxCombo(m=>Math.max(m,nc));
      if(nc>=2){setComboFlash(true);setTimeout(()=>setComboFlash(false),600);}
    } else {setCombo(0);}
    recordWrong(name,q.en,idx===q.ansIdx);
  };

  const next=()=>{setPicked(null);if(round<chain.length-1)setRound(r=>r+1);else setDone(true);};

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {combo>=2&&<span style={{fontSize:11,fontWeight:900,background:comboFlash?T.orange:T.orangeLight,color:T.orange,padding:"3px 8px",borderRadius:8,transition:"all 0.2s"}}>🔥 {combo}콤보!</span>}
          <span style={{fontSize:12,fontWeight:700,color:T.textMid}}>{round+1}/{chain.length}</span>
        </div>
        <span style={{fontSize:12,fontWeight:700,color:T.yellow}}>⭐{score}</span>
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

      <Card style={{marginBottom:12,textAlign:"center",padding:"20px 16px",background:T.tealLight}}>
        <div style={{fontSize:11,color:T.teal,fontWeight:800,marginBottom:6}}>
          {prev?`'${prev.en.slice(-1).toUpperCase()}'로 시작하는 단어의 뜻은?`:"첫 번째 단어의 뜻은?"}
        </div>
        <div style={{fontSize:36,fontWeight:900,color:T.teal}}>{q.en}</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {q.opts.map((o,idx)=>{
          const isAns=idx===q.ansIdx;
          let bg=T.card,color=T.text,border=T.border;
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;}else if(idx===picked){bg=T.red;color="white";border=T.red;}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"16px 10px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s"}}>{o.ko}</button>;
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

  if(done||round>=questions.length){
    const pts=score*15;
    if(typeof setStudents==="function"){setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"단어스무고개",score,total:questions.length,points:pts,date:new Date().toISOString()}].slice(-50)}};});}
    return <ResultScreen score={score} total={questions.length} title="스무고개 완료!" onExit={onExit} onRetry={()=>{setRound(0);setScore(0);setHintIdx(0);setPicked(null);setDone(false);}} />;
  }

  const q=questions[round];
  const answered=picked!==null;
  const shownHints=q.hints.slice(0,hintIdx+1);
  const bonusPts=Math.max(0,5-hintIdx); // 힌트 적게 쓸수록 보너스

  const pick=(idx)=>{
    if(answered)return;
    setPicked(idx);
    if(idx===q.ansIdx)setScore(s=>s+1+bonusPts);
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
          let bg=T.card,color=T.text,border=T.border;
          if(answered){if(isAns){bg=T.green;color="white";border=T.green;}else if(idx===picked){bg=T.red;color="white";border=T.red;}}
          return <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"16px 10px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3}}>{o.en}<div style={{fontSize:11,fontWeight:500,opacity:.7,marginTop:2}}>{o.ko}</div></button>;
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
  { id:1, name:"초록 숲",    emoji:"🌲", bg:"#dcfce7", color:"#22c55e", level:"유치원~초등저", wordLevel:"kinder",  bosses:5, desc:"쉬운 단어들이 모험을 기다려요!" },
  { id:2, name:"꽃 마을",    emoji:"🌸", bg:"#fce7f3", color:"#ec4899", level:"초등 저학년",  wordLevel:"elem1",   bosses:7, desc:"마을 사람들과 영어로 대화해요!" },
  { id:3, name:"학교 성",    emoji:"🏰", bg:"#e8f0ff", color:"#4f8ef7", level:"초등 고학년",  wordLevel:"elem2",   bosses:8, desc:"어려운 단어들이 성을 지키고 있어요!" },
  { id:4, name:"미지의 동굴", emoji:"🦇", bg:"#f3e8ff", color:"#a855f7", level:"중학교",      wordLevel:"middle",  bosses:10,desc:"강력한 단어 보스를 물리쳐요!" },
  { id:5, name:"전설의 탑",   emoji:"⚡", bg:"#fef3c7", color:"#f59e0b", level:"종합 최강",    wordLevel:"all",     bosses:12,desc:"최고 난이도! 전설의 탐험가에 도전!" },
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

  const persist=(s)=>{setSaveState(s);try{ls.set(saveKey, s);}catch{}};

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
              style={{marginBottom:10,background:locked?"#f8fafc":w.bg,opacity:locked?.6:1,border:`2px solid ${locked?"#e2e8f0":w.color}33`,display:"flex",alignItems:"center",gap:12}}>
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
      // 배틀 종료
      const cleared=round>=questions.length&&hp>0;
      const stars=cleared?3:score>questions.length/2?1:0;
      const pts=score*20+(cleared?50:0);
      if(typeof setStudents==="function"){setStudents(prev=>{const s=prev[name]||{};return {...prev,[name]:{...s,points:(s.points||0)+pts,records:[...(s.records||[]),{type:"game",gameType:"단어월드RPG",score,total:questions.length,points:pts,date:new Date().toISOString()}].slice(-50)}};});}
      if(cleared){
        const newSave={...save,clearedWorlds:[...new Set([...save.clearedWorlds,selectedWorld.id])],totalStars:save.totalStars+stars,questLog:[...save.questLog,{world:selectedWorld.name,score,clearedAt:new Date().toISOString()}]};
        persist(newSave);
      }
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
          <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
            <Btn v="secondary" size="lg" onClick={()=>startBattle(selectedWorld)} style={{flex:1}}>🔄 재도전</Btn>
            <Btn v="primary" size="lg" onClick={()=>setScreen("worldMap")} style={{flex:1}}>🗺️ 월드맵</Btn>
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
      if(correct){setScore(s=>s+1);setBossHp(h=>h-1);}
      else{
        if(shieldActive)setShieldActive(false);
        else setHp(h=>h-1);
      }
      setTimeout(()=>{setPicked(null);setFeedback(null);setRound(r=>r+1);},900);
    };

    const hpBar="❤️".repeat(hp)+"🖤".repeat(Math.max(0,3-hp));
    const bossHpPct=(bossHp/bossMax)*100;

    return(
      <div style={{minHeight:"100vh",background:T.bg,padding:14}}>
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
        <Card style={{marginBottom:12,textAlign:"center",padding:"18px 14px",background:selectedWorld.bg}}>
          <div style={{fontSize:11,fontWeight:800,color:selectedWorld.color,marginBottom:6}}>이 단어의 뜻은?</div>
          <div style={{fontSize:32,fontWeight:900,color:T.text}}>{q.en}</div>
          <div style={{fontSize:11,color:T.textMid,marginTop:4}}>{q.cat}</div>
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
            let bg=T.card,color=T.text,border=T.border;
            if(answered){if(isAns){bg=T.green;color="white";border=T.green;}else if(idx===picked){bg=T.red;color="white";border=T.red;}}
            return<button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"15px 8px",borderRadius:12,border:`2px solid ${border}`,background:bg,color,fontSize:14,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s",lineHeight:1.3}}>{o.ko}</button>;
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
