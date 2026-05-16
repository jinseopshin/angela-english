"use client";
import { useState, useMemo, useEffect, useCallback } from "react";

// ── THEME ─────────────────────────────────────────────────────────────────
const T = {
  bg: "#f0f7ff",
  card: "#ffffff",
  border: "#dce8ff",
  accent: "#4f8ef7",
  accentDark: "#2563eb",
  accentLight: "#e8f0ff",
  green: "#22c55e",
  greenLight: "#dcfce7",
  red: "#ef4444",
  redLight: "#fee2e2",
  yellow: "#f59e0b",
  yellowLight: "#fef3c7",
  purple: "#a855f7",
  purpleLight: "#f3e8ff",
  pink: "#ec4899",
  pinkLight: "#fce7f3",
  orange: "#f97316",
  orangeLight: "#fff7ed",
  text: "#1e293b",
  textMid: "#64748b",
  textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
  shadowLg: "0 8px 32px rgba(79,142,247,0.18)",
};

const GRADES = ["초등3","초등4","초등5","초등6","중1","중2","중3"];
const TAGS = ["be동사","일반동사","조동사","시제","의문문","부정문","어휘","기타"];
const MARKS = ["①","②","③","④","⑤"];
let _uid = Date.now();
const uid = () => (++_uid).toString(36);

const INIT_BANK = {
  bp:{id:"bp",title:"Be동사 현재시제",grade:"초등5",tag:"be동사",questions:[
    {id:1,q:"I ______ a student.",opts:["am","is","are","was","were"],ans:1,exp:"I → am"},
    {id:2,q:"She ______ my best friend.",opts:["am","are","is","was","were"],ans:3,exp:"3인칭 단수 → is"},
    {id:3,q:"They ______ soccer players.",opts:["am","is","are","was","were"],ans:3,exp:"복수 주어 → are"},
    {id:4,q:"He ______ a kind teacher.",opts:["am","are","is","was","were"],ans:3,exp:"He → is"},
    {id:5,q:"______ you a new student?",opts:["Am","Is","Are","Was","Were"],ans:3,exp:"의문문 You → Are"},
  ]},
  vpa:{id:"vpa",title:"일반동사 과거시제",grade:"중1",tag:"일반동사",questions:[
    {id:1,q:"I ______ pizza for lunch yesterday.",opts:["eat","eats","ate","am eat","do eat"],ans:3,exp:"eat → ate"},
    {id:2,q:"She ______ to school by bus last week.",opts:["go","goes","went","goed","going"],ans:3,exp:"go → went"},
    {id:3,q:"A: Did you sleep well? Yes, ______.",opts:["I did","I does","I do","I was","I slept"],ans:1,exp:"Yes, I did."},
  ]},
};

const WORD_LIST = [
  {word:"apple",meaning:"사과",hint:"🍎",level:1},
  {word:"banana",meaning:"바나나",hint:"🍌",level:1},
  {word:"school",meaning:"학교",hint:"🏫",level:1},
  {word:"teacher",meaning:"선생님",hint:"👩‍🏫",level:1},
  {word:"student",meaning:"학생",hint:"👦",level:1},
  {word:"happy",meaning:"행복한",hint:"😊",level:1},
  {word:"beautiful",meaning:"아름다운",hint:"✨",level:2},
  {word:"mountain",meaning:"산",hint:"⛰️",level:2},
  {word:"computer",meaning:"컴퓨터",hint:"💻",level:2},
  {word:"library",meaning:"도서관",hint:"📚",level:2},
  {word:"elephant",meaning:"코끼리",hint:"🐘",level:2},
  {word:"important",meaning:"중요한",hint:"⭐",level:3},
  {word:"adventure",meaning:"모험",hint:"🗺️",level:3},
  {word:"wonderful",meaning:"훌륭한",hint:"🌟",level:3},
  {word:"chocolate",meaning:"초콜릿",hint:"🍫",level:3},
  {word:"friendship",meaning:"우정",hint:"🤝",level:3},
];

// ── STORAGE ───────────────────────────────────────────────────────────────
function useStorage(key, def) {
  const [val, setVal] = useState(() => {
    if (typeof window === "undefined") return def;
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [val, key]);
  return [val, setVal];
}

// ── MINI COMPONENTS ───────────────────────────────────────────────────────
function Btn({children,onClick,v="default",size="md",disabled,full,style={}}) {
  const base={fontFamily:"inherit",cursor:disabled?"not-allowed":"pointer",border:"none",borderRadius:12,fontWeight:700,transition:"all .18s",opacity:disabled?.45:1,outline:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,width:full?"100%":undefined,...style};
  const vs={
    default:{background:T.card,color:T.text,border:`2px solid ${T.border}`,boxShadow:T.shadow},
    primary:{background:`linear-gradient(135deg,${T.accent},${T.accentDark})`,color:"#fff",boxShadow:"0 4px 14px rgba(79,142,247,0.4)"},
    success:{background:`linear-gradient(135deg,#22c55e,#16a34a)`,color:"#fff",boxShadow:"0 4px 14px rgba(34,197,94,0.4)"},
    danger:{background:`linear-gradient(135deg,#ef4444,#dc2626)`,color:"#fff"},
    ghost:{background:"transparent",color:T.textMid,border:`2px solid ${T.border}`},
    soft:{background:T.accentLight,color:T.accent,border:`2px solid ${T.border}`},
    pink:{background:`linear-gradient(135deg,#ec4899,#db2777)`,color:"#fff",boxShadow:"0 4px 14px rgba(236,72,153,0.4)"},
    purple:{background:`linear-gradient(135deg,#a855f7,#9333ea)`,color:"#fff",boxShadow:"0 4px 14px rgba(168,85,247,0.4)"},
    orange:{background:`linear-gradient(135deg,#f97316,#ea580c)`,color:"#fff",boxShadow:"0 4px 14px rgba(249,115,22,0.4)"},
  };
  const ss={sm:{fontSize:12,padding:"6px 14px"},md:{fontSize:14,padding:"10px 20px"},lg:{fontSize:16,padding:"14px 28px"},xl:{fontSize:18,padding:"18px 36px"}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...vs[v],...ss[size]}}>{children}</button>;
}

function Card({children,style={},onClick,hover=false}) {
  const [hov,setHov]=useState(false);
  return <div onClick={onClick} onMouseEnter={()=>hover&&setHov(true)} onMouseLeave={()=>setHov(false)} style={{background:T.card,border:`2px solid ${hov?T.accent:T.border}`,borderRadius:16,padding:18,boxShadow:hov?T.shadowLg:T.shadow,transition:"all .2s",transform:hov?"translateY(-2px)":"none",cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}

function Tag({children,color="blue"}) {
  const m={blue:[T.accentLight,T.accent],green:[T.greenLight,T.green],yellow:[T.yellowLight,T.yellow],purple:[T.purpleLight,T.purple],red:[T.redLight,T.red],pink:[T.pinkLight,T.pink],orange:[T.orangeLight,T.orange]};
  const [bg,fg]=m[color]||m.blue;
  return <span style={{background:bg,color:fg,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap",border:`1px solid ${fg}33`}}>{children}</span>;
}

function Inp({value,onChange,placeholder,multi,type="text",style={}}) {
  const s={background:"#f8faff",border:`2px solid ${T.border}`,color:T.text,borderRadius:12,padding:"11px 14px",fontSize:14,width:"100%",outline:"none",resize:"vertical",transition:"border-color .15s",fontFamily:"inherit",...style};
  return multi
    ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...s,minHeight:80}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
    :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function Sel({value,onChange,options,style={}}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{background:"#f8faff",border:`2px solid ${T.border}`,color:T.text,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none",width:"100%",fontFamily:"inherit",...style}}>{options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}</select>;
}

function Field({label,children,hint}) {
  return <div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div style={{fontSize:12,fontWeight:700,color:T.textMid,letterSpacing:.3}}>{label}</div>{hint&&<div style={{fontSize:11,color:T.textDim}}>{hint}</div>}</div>{children}</div>;
}

function Modal({open,onClose,title,children}) {
  if(!open) return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:T.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:680,maxHeight:"92vh",overflow:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:`2px solid ${T.border}`,position:"sticky",top:0,background:T.card,zIndex:1}}>
        <div style={{fontWeight:800,fontSize:16,color:T.text}}>{title}</div>
        <button onClick={onClose} style={{background:T.accentLight,border:"none",color:T.accent,fontSize:18,cursor:"pointer",width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}

// ── LANDING PAGE ──────────────────────────────────────────────────────────
function Landing({onTeacher,onStudent}) {
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#667eea 0%,#764ba2 50%,#f093fb 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      {/* Decorative circles */}
      {[{w:300,h:300,t:-80,r:-80,o:.12},{w:200,h:200,b:-60,l:-60,o:.1},{w:150,h:150,t:"40%",l:"5%",o:.08},{w:100,h:100,t:"20%",r:"10%",o:.1}].map((c,i)=>(
        <div key={i} style={{position:"absolute",width:c.w,height:c.h,borderRadius:"50%",background:"white",opacity:c.o,top:c.t,right:c.r,bottom:c.b,left:c.l,pointerEvents:"none"}}/>
      ))}

      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:40,position:"relative",zIndex:1}}>
        <div style={{fontSize:72,marginBottom:8,filter:"drop-shadow(0 4px 8px rgba(0,0,0,.2))"}}>🎀</div>
        <div style={{fontSize:32,fontWeight:900,color:"white",letterSpacing:-1,textShadow:"0 2px 12px rgba(0,0,0,.2)",lineHeight:1.1,marginBottom:6}}>
          Angela's<br/>English Academy
        </div>
        <div style={{fontSize:14,color:"rgba(255,255,255,.85)",fontWeight:600,letterSpacing:1}}>
          ✨ Learn English with Fun! ✨
        </div>
      </div>

      {/* Mode selection */}
      <div style={{width:"100%",maxWidth:380,position:"relative",zIndex:1}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.8)",textAlign:"center",marginBottom:16,fontWeight:600}}>
          누구로 접속할까요?
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {/* Teacher */}
          <div onClick={onTeacher} style={{background:"rgba(255,255,255,.15)",backdropFilter:"blur(10px)",border:"2px solid rgba(255,255,255,.3)",borderRadius:20,padding:"24px 16px",textAlign:"center",cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.25)";e.currentTarget.style.transform="translateY(-4px)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.15)";e.currentTarget.style.transform="";}}>
            <div style={{fontSize:48,marginBottom:8}}>👩‍🏫</div>
            <div style={{fontSize:16,fontWeight:900,color:"white",marginBottom:4}}>선생님</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.75)"}}>Teacher Mode</div>
          </div>
          {/* Student */}
          <div onClick={onStudent} style={{background:"rgba(255,255,255,.15)",backdropFilter:"blur(10px)",border:"2px solid rgba(255,255,255,.3)",borderRadius:20,padding:"24px 16px",textAlign:"center",cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.25)";e.currentTarget.style.transform="translateY(-4px)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.15)";e.currentTarget.style.transform="";}}>
            <div style={{fontSize:48,marginBottom:8}}>🧒</div>
            <div style={{fontSize:16,fontWeight:900,color:"white",marginBottom:4}}>학생</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.75)"}}>Student Mode</div>
          </div>
        </div>
      </div>

      <div style={{position:"absolute",bottom:20,fontSize:11,color:"rgba(255,255,255,.5)",zIndex:1}}>
        Angela's English Academy © 2024
      </div>
    </div>
  );
}

// ── TEACHER LOGIN ─────────────────────────────────────────────────────────
function TeacherLogin({onSuccess,onBack}) {
  const [pw,setPw]=useState("");
  const [error,setError]=useState("");
  const [savedPw,setSavedPw]=useStorage("angela_pw","1111");

  function login(){
    if(pw===savedPw){onSuccess();}
    else{setError("비밀번호가 틀렸어요! 🔐");setPw("");}
  }

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#667eea 0%,#764ba2 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:32,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:56,marginBottom:8}}>🔐</div>
          <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:4}}>선생님 로그인</div>
          <div style={{fontSize:13,color:T.textMid}}>Teacher Mode</div>
        </div>
        <Field label="비밀번호">
          <Inp type="password" value={pw} onChange={v=>{setPw(v);setError("");}} placeholder="비밀번호 입력"/>
        </Field>
        {error&&<div style={{background:T.redLight,borderRadius:10,padding:"8px 12px",fontSize:13,color:T.red,marginBottom:12,textAlign:"center"}}>{error}</div>}
        <Btn v="primary" full size="lg" onClick={login} disabled={!pw}>로그인</Btn>
        <div style={{textAlign:"center",marginTop:14}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:13}}>← 돌아가기</button>
        </div>
      </div>
    </div>
  );
}

// ── STUDENT LOGIN ─────────────────────────────────────────────────────────
function StudentLogin({onSuccess,onBack}) {
  const [name,setName]=useState("");

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#f093fb 0%,#f5576c 50%,#fda085 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:32,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:56,marginBottom:8}}>🧒</div>
          <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:4}}>학생 입장</div>
          <div style={{fontSize:13,color:T.textMid}}>Student Mode</div>
        </div>
        <Field label="이름을 입력하세요 😊">
          <Inp value={name} onChange={setName} placeholder="예: 홍길동"/>
        </Field>
        <Btn v="pink" full size="lg" onClick={()=>name.trim()&&onSuccess(name.trim())} disabled={!name.trim()}>
          입장하기 🚀
        </Btn>
        <div style={{textAlign:"center",marginTop:14}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:T.textMid,cursor:"pointer",fontSize:13}}>← 돌아가기</button>
        </div>
      </div>
    </div>
  );
}

// ── STUDENT HOME ──────────────────────────────────────────────────────────
function StudentHome({name,bank,assignments,onLogout}) {
  const [screen,setScreen]=useState("home");
  const [gameType,setGameType]=useState(null);
  const [points,setPoints]=useStorage(`angela_pts_${name}`,0);

  function addPoints(p){setPoints(prev=>prev+p);}

  if(screen==="quiz") return <StudentQuiz name={name} bank={bank} assignments={assignments} onBack={()=>setScreen("home")} onPoints={addPoints}/>;
  if(screen==="game") return <WordGame name={name} gameType={gameType} onBack={()=>setScreen("home")} onPoints={addPoints}/>;

  const h=new Date().getHours();
  const greet=h<12?"Good Morning":"h<18?Good Afternoon":"Good Evening";

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#ffecd2 0%,#fcb69f 100%)`}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#f093fb,#f5576c)`,padding:"20px 16px 24px",color:"white",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,background:"rgba(255,255,255,.1)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:-30,left:20,width:70,height:70,background:"rgba(255,255,255,.08)",borderRadius:"50%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
          <div>
            <div style={{fontSize:13,opacity:.85,marginBottom:2}}>🎀 Angela's English Academy</div>
            <div style={{fontSize:22,fontWeight:900,marginBottom:2}}>안녕, {name}! 👋</div>
            <div style={{fontSize:12,opacity:.8}}>오늘도 영어 공부 화이팅!</div>
          </div>
          <div style={{textAlign:"center",background:"rgba(255,255,255,.2)",borderRadius:14,padding:"10px 14px"}}>
            <div style={{fontSize:22,fontWeight:900}}>{points}</div>
            <div style={{fontSize:10,opacity:.85}}>⭐ 포인트</div>
          </div>
        </div>
      </div>

      <div style={{padding:"16px 12px 100px",maxWidth:480,margin:"0 auto"}}>
        {/* Streak / motivation */}
        <div style={{background:"white",borderRadius:16,padding:"14px 16px",marginBottom:16,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:36}}>🔥</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:T.text}}>오늘의 목표를 달성해봐요!</div>
            <div style={{fontSize:12,color:T.textMid}}>게임하고 포인트를 모아보세요 ⭐</div>
          </div>
        </div>

        {/* Assignment section */}
        <div style={{fontSize:13,fontWeight:800,color:T.textMid,marginBottom:10,letterSpacing:.5,textTransform:"uppercase"}}>📚 내 과제</div>
        {assignments.length===0
          ?<div style={{background:"white",borderRadius:16,padding:"24px 16px",textAlign:"center",marginBottom:20,boxShadow:T.shadow}}>
            <div style={{fontSize:32,marginBottom:8}}>📭</div>
            <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>아직 과제가 없어요</div>
            <div style={{fontSize:12,color:T.textMid}}>선생님이 과제를 내주실 거예요!</div>
          </div>
          :<div style={{marginBottom:20}}>
            {assignments.map((a,i)=>(
              <div key={i} onClick={()=>setScreen("quiz")} style={{background:"white",borderRadius:16,padding:"14px 16px",marginBottom:10,boxShadow:T.shadow,cursor:"pointer",display:"flex",alignItems:"center",gap:12,border:`2px solid ${T.border}`,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.pink;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";}}>
                <div style={{width:44,height:44,background:T.pinkLight,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📝</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{a.title}</div>
                  <div style={{fontSize:11,color:T.textMid,marginTop:2}}>{a.count}문항 · {a.grade}</div>
                </div>
                <div style={{fontSize:20,color:T.textDim}}>›</div>
              </div>
            ))}
          </div>
        }

        {/* Games */}
        <div style={{fontSize:13,fontWeight:800,color:T.textMid,marginBottom:10,letterSpacing:.5,textTransform:"uppercase"}}>🎮 단어 게임</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[
            {icon:"🎯",name:"단어 맞추기",sub:"뜻을 보고 단어 선택!",type:"meaning",color:T.purple,bg:T.purpleLight},
            {icon:"🔤",name:"스펠링 게임",sub:"철자를 맞춰봐요!",type:"spelling",color:T.orange,bg:T.orangeLight},
            {icon:"⚡",name:"스피드 퀴즈",sub:"빠르게 맞춰봐!",type:"speed",color:T.pink,bg:T.pinkLight},
            {icon:"🧩",name:"단어 카드",sub:"플래시카드로 외우기",type:"flash",color:T.green,bg:T.greenLight},
          ].map(g=>(
            <div key={g.type} onClick={()=>{setGameType(g.type);setScreen("game");}}
              style={{background:"white",borderRadius:16,padding:"16px 12px",textAlign:"center",cursor:"pointer",boxShadow:T.shadow,border:`2px solid ${T.border}`,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=g.color;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=T.shadowLg;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=T.shadow;}}>
              <div style={{width:52,height:52,background:g.bg,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 8px"}}>
                {g.icon}
              </div>
              <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:3}}>{g.name}</div>
              <div style={{fontSize:11,color:T.textMid}}>{g.sub}</div>
            </div>
          ))}
        </div>

        <Btn v="ghost" full onClick={onLogout}>← 처음으로</Btn>
      </div>
    </div>
  );
}

// ── STUDENT QUIZ ──────────────────────────────────────────────────────────
function StudentQuiz({name,bank,assignments,onBack,onPoints}) {
  const allQs=Object.values(bank).flatMap(s=>s.questions.map(q=>({...q,setTitle:s.title})));
  const [idx,setIdx]=useState(0);
  const [sel,setSel]=useState(null);
  const [answered,setAnswered]=useState(false);
  const [score,setScore]=useState(0);
  const [done,setDone]=useState(false);
  const qs=allQs.slice(0,Math.min(10,allQs.length));

  function answer(v){
    if(answered) return;
    setSel(v);setAnswered(true);
    if(v===qs[idx].ans) setScore(s=>s+1);
  }
  function next(){
    if(idx+1>=qs.length){setDone(true);onPoints(score*10);}
    else{setIdx(i=>i+1);setSel(null);setAnswered(false);}
  }

  if(qs.length===0) return <div style={{padding:24,textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>📭</div><div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:8}}>문제가 없어요</div><Btn v="ghost" onClick={onBack}>← 돌아가기</Btn></div>;

  if(done) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#ffecd2,#fcb69f)`,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:32,textAlign:"center",maxWidth:360,width:"100%",boxShadow:T.shadowLg}}>
        <div style={{fontSize:64,marginBottom:12}}>{score/qs.length>=0.8?"🏆":score/qs.length>=0.5?"🎉":"💪"}</div>
        <div style={{fontSize:24,fontWeight:900,color:T.text,marginBottom:8}}>
          {Math.round(score/qs.length*100)}점!
        </div>
        <div style={{fontSize:14,color:T.textMid,marginBottom:8}}>{score}/{qs.length}개 정답</div>
        <div style={{background:T.yellowLight,borderRadius:12,padding:"10px 16px",marginBottom:24,fontSize:14,color:T.yellow,fontWeight:700}}>
          ⭐ {score*10} 포인트 획득!
        </div>
        <Btn v="pink" full onClick={onBack}>← 홈으로</Btn>
      </div>
    </div>
  );

  const q=qs[idx];
  const progress=(idx/qs.length)*100;

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#ffecd2,#fcb69f)`}}>
      <div style={{background:`linear-gradient(135deg,#f093fb,#f5576c)`,padding:"16px 16px 20px",color:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.2)",border:"none",color:"white",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700}}>← 나가기</button>
          <div style={{fontSize:13,fontWeight:700}}>{idx+1} / {qs.length}</div>
        </div>
        <div style={{background:"rgba(255,255,255,.3)",borderRadius:100,height:8}}>
          <div style={{width:`${progress}%`,height:"100%",background:"white",borderRadius:100,transition:"width .4s"}}/>
        </div>
      </div>

      <div style={{padding:"20px 16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{background:"white",borderRadius:20,padding:"20px 18px",marginBottom:16,boxShadow:T.shadowLg}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textDim,marginBottom:8,background:T.accentLight,display:"inline-block",padding:"3px 10px",borderRadius:20}}>{q.setTitle}</div>
          <div style={{fontSize:16,lineHeight:1.75,color:T.text,fontWeight:600}}>{q.q}</div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {q.opts.map((o,j)=>{
            const v=j+1,isSel=sel===v,isAns=q.ans===v;
            const bg=!answered?"white":isAns?T.greenLight:isSel?T.redLight:"white";
            const border=!answered?(isSel?T.accent:T.border):isAns?T.green:isSel?T.red:T.border;
            return (
              <div key={j} onClick={()=>answer(v)}
                style={{background:bg,border:`2px solid ${border}`,borderRadius:14,padding:"14px 16px",cursor:answered?"default":"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s",boxShadow:T.shadow}}>
                <div style={{width:32,height:32,borderRadius:10,background:!answered?(isSel?T.accent:T.accentLight):isAns?T.green:isSel?T.red:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:900,color:!answered?(isSel?"white":T.accent):isAns?"white":isSel?"white":T.accent}}>{MARKS[j]}</span>
                </div>
                <span style={{fontSize:14,fontWeight:600,color:T.text,flex:1}}>{o}</span>
                {answered&&isAns&&<span style={{fontSize:18}}>✅</span>}
                {answered&&isSel&&!isAns&&<span style={{fontSize:18}}>❌</span>}
              </div>
            );
          })}
        </div>

        {answered&&(
          <div style={{marginTop:16}}>
            {q.exp&&<div style={{background:T.yellowLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:T.yellow,fontWeight:600,marginBottom:12}}>💡 {q.exp}</div>}
            <Btn v="pink" full size="lg" onClick={next}>{idx+1>=qs.length?"결과 보기 🏆":"다음 문제 →"}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WORD GAME ─────────────────────────────────────────────────────────────
function WordGame({name,gameType,onBack,onPoints}) {
  const [score,setScore]=useState(0);
  const [lives,setLives]=useState(3);
  const [done,setDone]=useState(false);
  const [current,setCurrent]=useState(0);
  const [answered,setAnswered]=useState(false);
  const [sel,setSel]=useState(null);
  const [input,setInput]=useState("");
  const [flashSide,setFlashSide]=useState("front");
  const [timeLeft,setTimeLeft]=useState(10);
  const [timerActive,setTimerActive]=useState(false);

  const words=useMemo(()=>[...WORD_LIST].sort(()=>Math.random()-.5).slice(0,8),[]);

  // Speed mode timer
  useEffect(()=>{
    if(gameType!=="speed"||!timerActive||done) return;
    if(timeLeft<=0){handleWrong();return;}
    const t=setTimeout(()=>setTimeLeft(p=>p-1),1000);
    return ()=>clearTimeout(t);
  },[timeLeft,timerActive,gameType,done]);

  useEffect(()=>{
    if(gameType==="speed"&&!answered&&!done){setTimeLeft(10);setTimerActive(true);}
    return ()=>setTimerActive(false);
  },[current,gameType,answered,done]);

  function getOptions(w){
    const others=WORD_LIST.filter(x=>x.word!==w.word).sort(()=>Math.random()-.5).slice(0,3).map(x=>x.meaning);
    const all=[w.meaning,...others].sort(()=>Math.random()-.5);
    return all;
  }

  function handleCorrect(){setScore(s=>s+1);}
  function handleWrong(){setLives(l=>{const n=l-1;if(n<=0)setDone(true);return n;});}

  function answerMeaning(opt){
    if(answered) return;
    const w=words[current];
    setSel(opt);setAnswered(true);setTimerActive(false);
    if(opt===w.meaning) handleCorrect();
    else handleWrong();
  }

  function answerSpelling(){
    if(answered) return;
    const w=words[current];
    setAnswered(true);
    if(input.trim().toLowerCase()===w.word.toLowerCase()) handleCorrect();
    else handleWrong();
  }

  function next(){
    if(current+1>=words.length){setDone(true);onPoints(score*15);}
    else{setCurrent(i=>i+1);setSel(null);setAnswered(false);setInput("");setFlashSide("front");}
  }

  if(done) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#a18cd1,#fbc2eb)`,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:32,textAlign:"center",maxWidth:360,width:"100%",boxShadow:T.shadowLg}}>
        <div style={{fontSize:64,marginBottom:12}}>{score>=6?"🏆":score>=4?"🎉":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text,marginBottom:8}}>게임 완료!</div>
        <div style={{fontSize:16,color:T.textMid,marginBottom:8}}>{score}/{words.length} 정답</div>
        <div style={{background:T.yellowLight,borderRadius:12,padding:"10px 16px",marginBottom:24,fontSize:14,color:T.yellow,fontWeight:700}}>
          ⭐ {score*15} 포인트 획득!
        </div>
        <Btn v="purple" full onClick={onBack}>← 홈으로</Btn>
      </div>
    </div>
  );

  const w=words[current];
  const gameColors={meaning:[T.purple,"#a855f7"],spelling:[T.orange,"#f97316"],speed:[T.pink,"#ec4899"],flash:[T.green,"#22c55e"]};
  const [gc,gcd]=gameColors[gameType]||gameColors.meaning;

  // Flash card mode
  if(gameType==="flash") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#d4fc79,#96e6a1)`}}>
      <div style={{background:`linear-gradient(135deg,#22c55e,#16a34a)`,padding:"16px 16px 20px",color:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.2)",border:"none",color:"white",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700}}>← 나가기</button>
          <div style={{fontSize:13,fontWeight:700}}>{current+1} / {words.length}</div>
        </div>
      </div>
      <div style={{padding:"24px 16px",maxWidth:400,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:13,color:T.textMid,marginBottom:8,fontWeight:600}}>카드를 눌러 뒤집어보세요! 👆</div>
        <div onClick={()=>setFlashSide(s=>s==="front"?"back":"front")}
          style={{width:"100%",minHeight:220,background:"white",borderRadius:24,boxShadow:T.shadowLg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`3px solid ${T.green}`,marginBottom:24,padding:24,transition:"all .3s"}}>
          {flashSide==="front"
            ?<><div style={{fontSize:64,marginBottom:12}}>{w.hint}</div><div style={{fontSize:28,fontWeight:900,color:T.text,letterSpacing:1}}>{w.word}</div><div style={{fontSize:12,color:T.textDim,marginTop:8}}>뜻 보기 →</div></>
            :<><div style={{fontSize:48,marginBottom:8}}>{w.hint}</div><div style={{fontSize:20,fontWeight:900,color:T.green}}>{w.meaning}</div><div style={{fontSize:14,color:T.textMid,marginTop:4}}>{w.word}</div></>
          }
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,width:"100%"}}>
          <Btn v="ghost" size="lg" onClick={()=>{if(current+1>=words.length){setDone(true);}else{setCurrent(i=>i+1);setFlashSide("front");}}}>다음 →</Btn>
          <Btn v="success" size="lg" onClick={()=>{setScore(s=>s+1);if(current+1>=words.length){setDone(true);}else{setCurrent(i=>i+1);setFlashSide("front");}}}>알아요! ✓</Btn>
        </div>
      </div>
    </div>
  );

  const opts=useMemo(()=>getOptions(w),[current]);

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#ffecd2,#fcb69f)`}}>
      <div style={{background:`linear-gradient(135deg,${gc},${gcd})`,padding:"16px 16px 20px",color:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.2)",border:"none",color:"white",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700}}>← 나가기</button>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {gameType==="speed"&&!answered&&<div style={{background:"rgba(255,255,255,.25)",borderRadius:10,padding:"4px 10px",fontSize:13,fontWeight:900}}>{timeLeft}s ⏱</div>}
            <div>{"❤️".repeat(lives)}{"🖤".repeat(3-lives)}</div>
            <div style={{fontSize:13,fontWeight:700}}>⭐{score}</div>
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.3)",borderRadius:100,height:6}}>
          <div style={{width:`${(current/words.length)*100}%`,height:"100%",background:"white",borderRadius:100,transition:"width .4s"}}/>
        </div>
      </div>

      <div style={{padding:"20px 16px",maxWidth:480,margin:"0 auto"}}>
        {/* Word card */}
        <div style={{background:"white",borderRadius:20,padding:"24px 18px",textAlign:"center",marginBottom:20,boxShadow:T.shadowLg}}>
          <div style={{fontSize:52,marginBottom:8}}>{w.hint}</div>
          {gameType==="meaning"||gameType==="speed"
            ?<div style={{fontSize:24,fontWeight:900,color:T.text,letterSpacing:1}}>{w.word}</div>
            :<><div style={{fontSize:16,color:T.textMid,marginBottom:4}}>이 뜻의 영어 단어는?</div><div style={{fontSize:24,fontWeight:900,color:T.text}}>{w.meaning}</div></>
          }
        </div>

        {/* Options / Input */}
        {(gameType==="meaning"||gameType==="speed")
          ?<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {opts.map((o,j)=>{
              const isSel=sel===o,isAns=o===w.meaning;
              const bg=!answered?"white":isAns?T.greenLight:isSel?T.redLight:"white";
              const border=!answered?(isSel?gc:T.border):isAns?T.green:isSel?T.red:T.border;
              return <div key={j} onClick={()=>answerMeaning(o)} style={{background:bg,border:`2px solid ${border}`,borderRadius:14,padding:"14px 16px",cursor:answered?"default":"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s",boxShadow:T.shadow}}>
                <div style={{width:30,height:30,borderRadius:8,background:isAns&&answered?T.green:isSel&&answered?T.red:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:900,color:answered&&(isAns||isSel)?"white":T.accent}}>{["A","B","C","D"][j]}</span>
                </div>
                <span style={{fontSize:15,fontWeight:600,color:T.text,flex:1}}>{o}</span>
                {answered&&isAns&&<span>✅</span>}
                {answered&&isSel&&!isAns&&<span>❌</span>}
              </div>;
            })}
          </div>
          :<div>
            <Inp value={input} onChange={setInput} placeholder="영어 단어를 입력하세요..." style={{fontSize:16,marginBottom:12}} onKeyDown={e=>e.key==="Enter"&&!answered&&answerSpelling()}/>
            {!answered&&<Btn v="purple" full size="lg" onClick={answerSpelling} disabled={!input.trim()}>확인 ✓</Btn>}
            {answered&&<div style={{background:input.trim().toLowerCase()===w.word.toLowerCase()?T.greenLight:T.redLight,borderRadius:12,padding:"12px 16px",textAlign:"center",fontSize:15,fontWeight:700,color:input.trim().toLowerCase()===w.word.toLowerCase()?T.green:T.red}}>
              {input.trim().toLowerCase()===w.word.toLowerCase()?"✅ 정답!":"❌ 정답: "+w.word}
            </div>}
          </div>
        }

        {answered&&<div style={{marginTop:14}}><Btn v="orange" full size="lg" onClick={next}>{current+1>=words.length?"결과 보기 🏆":"다음 →"}</Btn></div>}
      </div>
    </div>
  );
}

// ── TEACHER APP (기존 기능) ───────────────────────────────────────────────
function Btn2({children,onClick,v="default",size="md",disabled,full,style={}}) {
  return <Btn children={children} onClick={onClick} v={v} size={size} disabled={disabled} full={full} style={style}/>;
}

function TeacherApp({onLogout,bank,setBank,exams,setExams,savedPw,setSavedPw}) {
  const [screen,setScreen]=useState("dashboard");
  const [arg,setArg]=useState(null);
  const [showPwChange,setShowPwChange]=useState(false);
  const [newPw,setNewPw]=useState("");
  const [assignments,setAssignments]=useStorage("angela_assignments",[]);

  function onNav(s,a=null){setScreen(s);setArg(a);if(typeof window!=="undefined")window.scrollTo(0,0);}
  const examView=arg?exams.find(e=>e.id===arg):null;

  const NAV=[
    {id:"dashboard",icon:"🏠",label:"홈"},
    {id:"bank",icon:"📚",label:"문제 은행"},
    {id:"exam-builder",icon:"📝",label:"출제"},
    {id:"exams",icon:"🖨️",label:"시험지"},
  ];

  return (
    <div style={{background:T.bg,minHeight:"100vh",color:T.text}}>
      {/* Top bar */}
      <div className="topbar" style={{background:`linear-gradient(135deg,${T.accent},${T.accentDark})`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 20px rgba(79,142,247,0.3)"}}>
        <div style={{fontSize:28,flexShrink:0}}>🎀</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:900,color:"white",lineHeight:1.1}}>Angela's English Academy</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.7)"}}>선생님 모드 · 데이터 자동 저장</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {screen==="exam-view"&&examView&&<button onClick={()=>window.print()} style={{background:"rgba(255,255,255,.2)",border:"none",color:"white",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>🖨️ 인쇄</button>}
          <button onClick={()=>setShowPwChange(true)} style={{background:"rgba(255,255,255,.15)",border:"none",color:"white",borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:12}}>🔑</button>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"none",color:"white",borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:12}}>나가기</button>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"16px 12px 100px"}}>
        {screen==="dashboard"&&<TeacherDashboard bank={bank} exams={exams} onNav={onNav}/>}
        {screen==="bank"&&<QuestionBank bank={bank} setBank={setBank} onNav={onNav}/>}
        {screen==="ai-gen"&&<AIGenScreen bank={bank} setBank={setBank}/>}
        {screen==="exam-builder"&&<ExamBuilder bank={bank} setExams={setExams} onNav={onNav}/>}
        {screen==="exams"&&<ExamList exams={exams} setExams={setExams} onNav={onNav}/>}
        {screen==="exam-view"&&(examView?<ExamPrintView exam={examView} onBack={()=>onNav("exams")}/>:<div style={{textAlign:"center",padding:48,color:T.textDim}}>시험지를 찾을 수 없어요.</div>)}
      </div>

      {/* Bottom nav */}
      <div className="bottomnav" style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:`2px solid ${T.border}`,display:"flex",zIndex:100,boxShadow:"0 -4px 20px rgba(79,142,247,.1)"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>onNav(n.id)} style={{flex:1,background:"none",border:"none",padding:"10px 4px 16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{fontSize:22,transition:"transform .15s",transform:screen===n.id?"scale(1.2)":"scale(1)"}}>{n.icon}</div>
            <div style={{fontSize:10,fontWeight:800,color:screen===n.id?T.accent:T.textDim}}>{n.label}</div>
            {screen===n.id&&<div style={{width:20,height:3,borderRadius:2,background:T.accent}}/>}
          </button>
        ))}
      </div>

      {/* Password change modal */}
      <Modal open={showPwChange} onClose={()=>{setShowPwChange(false);setNewPw("");}} title="🔑 비밀번호 변경">
        <Field label="새 비밀번호"><Inp type="password" value={newPw} onChange={setNewPw} placeholder="새 비밀번호 입력"/></Field>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={()=>{setShowPwChange(false);setNewPw("");}}>취소</Btn>
          <Btn v="primary" disabled={!newPw.trim()} onClick={()=>{setSavedPw(newPw);setShowPwChange(false);setNewPw("");alert("비밀번호가 변경됐어요! 🎉");}}>변경하기</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── TEACHER DASHBOARD ─────────────────────────────────────────────────────
function TeacherDashboard({bank,exams,onNav}) {
  const totalQ=Object.values(bank).reduce((s,b)=>s+b.questions.length,0);
  const h=new Date().getHours();
  const greet=h<12?"좋은 아침이에요 🌅":h<18?"좋은 오후예요 ☀️":"좋은 저녁이에요 🌆";
  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${T.accent},${T.accentDark})`,borderRadius:20,padding:"22px 20px 24px",marginBottom:20,color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-20,width:130,height:130,background:"rgba(255,255,255,.08)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:-40,right:30,width:80,height:80,background:"rgba(255,255,255,.05)",borderRadius:"50%"}}/>
        <div style={{fontSize:13,opacity:.85,marginBottom:3}}>{greet}</div>
        <div style={{fontSize:24,fontWeight:900,marginBottom:1}}>Angela 선생님 👋</div>
        <div style={{fontSize:12,opacity:.75,marginBottom:20}}>오늘도 멋진 수업 준비 함께해요!</div>
        <div style={{display:"flex",gap:20}}>
          {[{n:Object.keys(bank).length,l:"문제 세트",icon:"📚"},{n:totalQ,l:"총 문항",icon:"✏️"},{n:exams.length,l:"시험지",icon:"📄"}].map(s=>(
            <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:11,opacity:.7,marginBottom:2}}>{s.icon} {s.l}</div><div style={{fontSize:28,fontWeight:900,lineHeight:1}}>{s.n}</div></div>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,fontWeight:800,color:T.textDim,marginBottom:10,letterSpacing:.8,textTransform:"uppercase"}}>빠른 실행</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {icon:"🤖",label:"AI 문제 생성",sub:"Claude로 자동 생성",screen:"ai-gen",v:"purple"},
          {icon:"📝",label:"시험지 출제",sub:"문제 선택 후 출력",screen:"exam-builder",v:"success"},
          {icon:"📚",label:"문제 은행",sub:"세트 및 문항 관리",screen:"bank",v:"soft"},
          {icon:"🖨️",label:"출력 목록",sub:"저장된 시험지",screen:"exams",v:"default"},
        ].map(a=>(
          <Card key={a.label} onClick={()=>onNav(a.screen)} hover style={{cursor:"pointer"}}>
            <div style={{fontSize:28,marginBottom:7}}>{a.icon}</div>
            <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:2}}>{a.label}</div>
            <div style={{fontSize:11,color:T.textMid}}>{a.sub}</div>
          </Card>
        ))}
      </div>
      <div style={{fontSize:11,fontWeight:800,color:T.textDim,marginBottom:10,letterSpacing:.8,textTransform:"uppercase"}}>최근 시험지</div>
      {exams.length===0
        ?<div style={{textAlign:"center",padding:"32px 24px",background:T.card,borderRadius:16,border:`2px dashed ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:36,marginBottom:8}}>📝</div>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>아직 시험지가 없어요</div>
          <div style={{fontSize:12,color:T.textMid,marginBottom:16}}>출제 버튼을 눌러 만들어보세요!</div>
          <Btn v="primary" onClick={()=>onNav("exam-builder")}>시험지 출제하기</Btn>
        </div>
        :exams.slice(-4).reverse().map(e=>(
          <Card key={e.id} onClick={()=>onNav("exam-view",e.id)} hover style={{marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,background:T.accentLight,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📄</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
              <div style={{fontSize:11,color:T.textMid,marginTop:2}}>{e.questions.length}문항 · {e.grade} · {e.createdAt}</div>
            </div>
            <div style={{color:T.textDim,fontSize:20}}>›</div>
          </Card>
        ))}
    </div>
  );
}

// ── QUESTION BANK ─────────────────────────────────────────────────────────
function QuestionBank({bank,setBank,onNav}) {
  const [sel,setSel]=useState(null);
  const [showNewSet,setShowNewSet]=useState(false);
  const [showNewQ,setShowNewQ]=useState(false);
  const [editQ,setEditQ]=useState(null);
  const [nset,setNset]=useState({title:"",grade:"중1",tag:"be동사"});
  const [nq,setNq]=useState({q:"",opts:["","","","",""],ans:1,exp:""});
  const [search,setSearch]=useState("");
  const cur=sel?bank[sel]:null;
  function createSet(){if(!nset.title.trim())return;const id=uid();setBank(b=>({...b,[id]:{id,title:nset.title,grade:nset.grade,tag:nset.tag,questions:[]}}));setSel(id);setShowNewSet(false);setNset({title:"",grade:"중1",tag:"be동사"});}
  function delSet(id){if(!confirm("이 세트를 삭제할까요?"))return;setBank(b=>{const n={...b};delete n[id];return n;});if(sel===id)setSel(null);}
  function addQ(){if(!nq.q.trim()||nq.opts.some(o=>!o.trim()))return;const maxId=Math.max(0,...cur.questions.map(q=>q.id));setBank(b=>({...b,[sel]:{...b[sel],questions:[...b[sel].questions,{...nq,opts:[...nq.opts],id:maxId+1}]}}));setNq({q:"",opts:["","","","",""],ans:1,exp:""});setShowNewQ(false);}
  function saveEdit(){setBank(b=>({...b,[sel]:{...b[sel],questions:b[sel].questions.map(q=>q.id===editQ.id?editQ:q)}}));setEditQ(null);}
  function delQ(qid){setBank(b=>({...b,[sel]:{...b[sel],questions:b[sel].questions.filter(q=>q.id!==qid)}}));}
  const sets=Object.values(bank).filter(s=>s.title.includes(search)||s.grade.includes(search)||s.tag.includes(search));
  if(!sel) return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:18,fontWeight:900,color:T.text}}>📚 문제 은행</div>
        <Btn v="primary" onClick={()=>setShowNewSet(true)}>+ 새 세트</Btn>
      </div>
      <Card onClick={()=>onNav("ai-gen")} hover style={{marginBottom:14,cursor:"pointer",background:`linear-gradient(135deg,#a855f7,#9333ea)`,border:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,color:"white"}}>
          <div style={{fontSize:28,flexShrink:0}}>🤖</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:800,marginBottom:2}}>Claude로 문제 자동 생성</div><div style={{fontSize:11,opacity:.85}}>원하는 주제 입력 → AI가 문제 생성!</div></div>
          <div style={{fontSize:20,opacity:.7}}>›</div>
        </div>
      </Card>
      <Inp value={search} onChange={setSearch} placeholder="🔍 세트 검색..." style={{marginBottom:12}}/>
      {sets.length===0
        ?<div style={{textAlign:"center",padding:"40px 24px",background:T.card,borderRadius:16,border:`2px dashed ${T.border}`}}><div style={{fontSize:40,marginBottom:8}}>📚</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>문제 세트가 없어요</div><div style={{fontSize:12,color:T.textMid,marginBottom:14}}>새 세트를 만들어보세요!</div><Btn v="primary" onClick={()=>setShowNewSet(true)}>새 세트 만들기</Btn></div>
        :sets.map(s=>(
          <Card key={s.id} hover onClick={()=>setSel(s.id)} style={{marginBottom:10,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:T.text,marginBottom:7}}>{s.title}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Tag color="blue">{s.grade}</Tag><Tag color="purple">{s.tag}</Tag><Tag color="green">{s.questions.length}문항</Tag></div></div>
              <button onClick={e=>{e.stopPropagation();delSet(s.id);}} style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:18,padding:"0 4px"}}>🗑</button>
            </div>
          </Card>
        ))}
      <Modal open={showNewSet} onClose={()=>setShowNewSet(false)} title="새 문제 세트 만들기">
        <Field label="세트 제목 *"><Inp value={nset.title} onChange={v=>setNset(s=>({...s,title:v}))} placeholder="예: Be동사 현재시제 연습"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Field label="학년"><Sel value={nset.grade} onChange={v=>setNset(s=>({...s,grade:v}))} options={GRADES}/></Field><Field label="태그"><Sel value={nset.tag} onChange={v=>setNset(s=>({...s,tag:v}))} options={TAGS}/></Field></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn v="ghost" onClick={()=>setShowNewSet(false)}>취소</Btn><Btn v="primary" onClick={createSet}>만들기</Btn></div>
      </Modal>
    </div>
  );
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>← 목록</button>
        <div style={{flex:1,fontWeight:900,fontSize:16,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cur.title}</div>
        <Btn v="primary" size="sm" onClick={()=>setShowNewQ(true)}>+ 추가</Btn>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14}}><Tag color="blue">{cur.grade}</Tag><Tag color="purple">{cur.tag}</Tag><Tag color="green">{cur.questions.length}문항</Tag></div>
      {cur.questions.length===0
        ?<div style={{textAlign:"center",padding:"40px 24px",background:T.card,borderRadius:16,border:`2px dashed ${T.border}`}}><div style={{fontSize:40,marginBottom:8}}>✏️</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>문항이 없어요</div><Btn v="primary" onClick={()=>setShowNewQ(true)} style={{marginTop:8}}>문항 추가</Btn></div>
        :cur.questions.map((q,i)=>(
          <Card key={q.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:800,color:T.accent,background:T.accentLight,padding:"2px 8px",borderRadius:6,fontFamily:"monospace"}}>Q{String(i+1).padStart(2,"0")}</span>
              <div style={{display:"flex",gap:6}}><Btn v="ghost" size="sm" onClick={()=>setEditQ({...q,opts:[...q.opts]})}>편집</Btn><Btn v="danger" size="sm" onClick={()=>delQ(q.id)}>삭제</Btn></div>
            </div>
            <div style={{fontSize:14,color:T.text,marginBottom:9,lineHeight:1.65}}>{q.q}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 16px"}}>
              {q.opts.map((o,j)=><div key={j} style={{fontSize:12,color:j+1===q.ans?T.green:T.textMid,display:"flex",gap:5,alignItems:"center",lineHeight:1.6}}><span style={{fontWeight:800,flexShrink:0}}>{MARKS[j]}</span><span>{o}</span>{j+1===q.ans&&<span style={{fontSize:10,color:T.green}}>✓</span>}</div>)}
            </div>
            {q.exp&&<div style={{marginTop:8,fontSize:11,color:T.yellow,borderTop:`1px solid ${T.border}`,paddingTop:7}}>💡 {q.exp}</div>}
          </Card>
        ))}
      <Modal open={showNewQ} onClose={()=>setShowNewQ(false)} title="새 문항 추가">
        <Field label="문제" hint="빈칸 → ______"><Inp value={nq.q} onChange={v=>setNq(q=>({...q,q:v}))} placeholder="예: She ______ my best friend." multi/></Field>
        <Field label="보기 5개">{nq.opts.map((o,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}><span style={{fontSize:14,fontWeight:800,color:i+1===nq.ans?T.green:T.textDim,width:22,flexShrink:0}}>{MARKS[i]}</span><Inp value={o} onChange={v=>setNq(q=>{const opts=[...q.opts];opts[i]=v;return{...q,opts};})} placeholder={`보기 ${i+1}`} style={{flex:1}}/><button onClick={()=>setNq(q=>({...q,ans:i+1}))} style={{background:i+1===nq.ans?T.green:"transparent",border:`2px solid ${i+1===nq.ans?T.green:T.border}`,color:i+1===nq.ans?"#fff":T.textMid,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:11,fontWeight:800,whiteSpace:"nowrap",flexShrink:0}}>{i+1===nq.ans?"✓ 정답":"정답으로"}</button></div>))}</Field>
        <Field label="해설 (선택)"><Inp value={nq.exp} onChange={v=>setNq(q=>({...q,exp:v}))} placeholder="예: 3인칭 단수 → is"/></Field>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="ghost" onClick={()=>setShowNewQ(false)}>취소</Btn><Btn v="primary" onClick={addQ}>추가</Btn></div>
      </Modal>
      <Modal open={!!editQ} onClose={()=>setEditQ(null)} title="문항 편집">
        {editQ&&(<><Field label="문제"><Inp value={editQ.q} onChange={v=>setEditQ(q=>({...q,q:v}))} placeholder="문제 입력" multi/></Field><Field label="보기">{editQ.opts.map((o,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}><span style={{fontSize:14,fontWeight:800,color:i+1===editQ.ans?T.green:T.textDim,width:22}}>{MARKS[i]}</span><Inp value={o} onChange={v=>setEditQ(q=>{const opts=[...q.opts];opts[i]=v;return{...q,opts};})} style={{flex:1}}/><button onClick={()=>setEditQ(q=>({...q,ans:i+1}))} style={{background:i+1===editQ.ans?T.green:"transparent",border:`2px solid ${i+1===editQ.ans?T.green:T.border}`,color:i+1===editQ.ans?"#fff":T.textMid,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{i+1===editQ.ans?"✓ 정답":"정답으로"}</button></div>))}</Field><Field label="해설"><Inp value={editQ.exp} onChange={v=>setEditQ(q=>({...q,exp:v}))}/></Field><div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="ghost" onClick={()=>setEditQ(null)}>취소</Btn><Btn v="success" onClick={saveEdit}>저장</Btn></div></>)}
      </Modal>
    </div>
  );
}

// ── AI GEN ────────────────────────────────────────────────────────────────
function AIGenScreen({bank,setBank}) {
  const [step,setStep]=useState("guide");
  const [preview,setPreview]=useState(null);
  const [targetSet,setTargetSet]=useState("");
  const [newSetName,setNewSetName]=useState("");
  const [newSetGrade,setNewSetGrade]=useState("중1");
  const [newSetTag,setNewSetTag]=useState("be동사");
  const [copied,setCopied]=useState(false);
  const [jsonText,setJsonText]=useState("");
  const [parseError,setParseError]=useState("");
  const prompt=`아래 형식으로 영어 문제를 JSON으로 만들어줘. JSON만 출력하고 설명은 하지 마.\n\n[\n  {\n    "q": "She ______ my best friend.",\n    "opts": ["am", "are", "is", "was", "were"],\n    "ans": 3,\n    "exp": "3인칭 단수 → is"\n  }\n]\n\n조건:\n- opts는 반드시 5개\n- ans는 정답 번호 (1~5)\n- exp는 한 줄 해설\n- 빈칸은 ______로 표시`;
  function copyPrompt(){navigator.clipboard.writeText(prompt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}
  function parseJSON(){setParseError("");setPreview(null);try{const t=jsonText.trim();const s=t.indexOf("["),e=t.lastIndexOf("]");if(s===-1||e===-1)throw new Error("JSON 배열 [ ] 을 찾을 수 없어요");const arr=JSON.parse(t.slice(s,e+1));const valid=arr.filter(q=>q.q&&Array.isArray(q.opts)&&q.opts.length===5&&q.ans>=1&&q.ans<=5);if(valid.length===0)throw new Error("올바른 형식의 문제가 없어요");setPreview(valid);}catch(e){setParseError(e.message);}}
  function handleSave(){let sid=targetSet;if(sid==="new"){if(!newSetName.trim())return;sid=uid();setBank(b=>({...b,[sid]:{id:sid,title:newSetName,grade:newSetGrade,tag:newSetTag,questions:[]}}));}const maxId=Math.max(0,...(bank[sid]?.questions||[]).map(q=>q.id));const newQs=preview.map((q,i)=>({...q,id:maxId+i+1}));setBank(b=>({...b,[sid]:{...b[sid],questions:[...(b[sid]?.questions||[]),...newQs]}}));setStep("done");setPreview(null);setJsonText("");setTargetSet("");setNewSetName("");}
  if(step==="done") return <div style={{textAlign:"center",padding:"48px 24px"}}><div style={{fontSize:56,marginBottom:16}}>🎉</div><div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:8}}>문제 가져오기 완료!</div><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:16}}><Btn v="primary" onClick={()=>{setStep("guide");setPreview(null);}}>🤖 더 만들기</Btn></div></div>;
  if(step==="target") return (<div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><button onClick={()=>setStep("import")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>← 이전</button><div style={{fontSize:18,fontWeight:900,color:T.text}}>어느 세트에 추가할까요?</div></div><div style={{background:T.greenLight,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.green,fontWeight:700,marginBottom:16}}>✅ {preview?.length}개 문제 준비됨</div>{Object.values(bank).map(s=>(<div key={s.id} onClick={()=>setTargetSet(s.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:12,border:`2px solid ${targetSet===s.id?T.accent:T.border}`,marginBottom:8,cursor:"pointer",background:targetSet===s.id?T.accentLight:T.card,transition:"all .15s"}}><div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${targetSet===s.id?T.accent:T.border}`,background:targetSet===s.id?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{targetSet===s.id&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.text}}>{s.title}</div><div style={{display:"flex",gap:5,marginTop:2}}><Tag color="blue">{s.grade}</Tag><Tag color="green">{s.questions.length}문항</Tag></div></div></div>))}<div onClick={()=>setTargetSet("new")} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:12,border:`2px solid ${targetSet==="new"?T.accent:T.border}`,cursor:"pointer",background:targetSet==="new"?T.accentLight:T.card,marginBottom:12,transition:"all .15s"}}><div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${targetSet==="new"?T.accent:T.border}`,background:targetSet==="new"?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{targetSet==="new"&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}</div><div style={{fontSize:13,fontWeight:700,color:T.text}}>➕ 새 세트 만들기</div></div>{targetSet==="new"&&<div style={{paddingLeft:4,marginBottom:12}}><Field label="새 세트 이름"><Inp value={newSetName} onChange={setNewSetName} placeholder="예: Be동사 심화 문제"/></Field><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Field label="학년"><Sel value={newSetGrade} onChange={setNewSetGrade} options={GRADES}/></Field><Field label="태그"><Sel value={newSetTag} onChange={setNewSetTag} options={TAGS}/></Field></div></div>}<Btn v="success" full disabled={!targetSet||(targetSet==="new"&&!newSetName.trim())} onClick={handleSave}>✅ 문제 은행에 저장하기</Btn></div>);
  if(step==="import") return (<div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><button onClick={()=>setStep("guide")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>← 이전</button><div style={{fontSize:18,fontWeight:900,color:T.text}}>JSON 붙여넣기</div></div><div style={{background:T.accentLight,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.accent,marginBottom:14,lineHeight:1.6}}>📋 Claude.ai에서 생성된 JSON을 아래에 붙여넣으세요. <b>[ ] 전체</b>를 복사해서 붙여넣으면 돼요!</div><Field label="JSON 붙여넣기"><Inp value={jsonText} onChange={setJsonText} placeholder="[ ] 전체 붙여넣기" multi style={{minHeight:160,fontFamily:"monospace",fontSize:12}}/></Field>{parseError&&<div style={{background:T.redLight,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.red,marginBottom:10}}>❌ {parseError}</div>}{!preview&&<Btn v="primary" full onClick={parseJSON} disabled={!jsonText.trim()}>미리보기 확인</Btn>}{preview&&<div><div style={{background:T.greenLight,borderRadius:8,padding:"10px 14px",fontSize:13,color:T.green,marginBottom:12,fontWeight:700}}>✅ {preview.length}개 문제 확인됨!</div><div style={{maxHeight:200,overflow:"auto",marginBottom:14,border:`1px solid ${T.border}`,borderRadius:10,padding:"0 12px"}}>{preview.map((q,i)=><div key={i} style={{borderBottom:`1px solid ${T.border}`,padding:"8px 0",fontSize:12,color:T.text}}><span style={{color:T.accent,fontWeight:700}}>{i+1}. </span>{q.q}<span style={{color:T.green,marginLeft:8}}> → {MARKS[q.ans-1]}</span></div>)}</div><div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setPreview(null)}>다시 붙여넣기</Btn><Btn v="success" full onClick={()=>setStep("target")}>다음: 세트 선택 →</Btn></div></div>}</div>);
  return (<div><div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:20}}>🤖 AI 문제 생성</div><div style={{background:`linear-gradient(135deg,#a855f7,#9333ea)`,borderRadius:16,padding:"18px",marginBottom:18,color:"#fff"}}><div style={{fontSize:15,fontWeight:900,marginBottom:4}}>Claude로 문제 자동 생성하기</div><div style={{fontSize:12,opacity:.85,lineHeight:1.6}}>프롬프트를 복사해서 Claude.ai에 붙여넣고 원하는 문제를 요청하세요!</div></div><div style={{marginBottom:18}}><div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:8}}>① 프롬프트 복사하기</div><div style={{background:"#1e293b",borderRadius:12,padding:"14px 16px",fontSize:11,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.8,marginBottom:8,whiteSpace:"pre-wrap"}}>{prompt}</div><Btn v="purple" full onClick={copyPrompt}>{copied?"✓ 복사됨!":"📋 프롬프트 복사"}</Btn></div><div style={{marginBottom:18}}><div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:8}}>② Claude에게 이렇게 요청하세요</div>{["Be동사 현재시제 초등5 문제 10개 만들어줘","중1 일반동사 과거형 의문문 위주로 5문제","조동사 can, may 문제 어렵게 8개","현재시제 부정문 초등6 수준으로 6개"].map((ex,i)=><div key={i} style={{background:T.purpleLight,borderRadius:8,padding:"9px 12px",fontSize:12,color:T.purple,fontWeight:600,marginBottom:6}}>💬 {ex}</div>)}</div><div style={{background:T.yellowLight,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.yellow,marginBottom:18,lineHeight:1.6}}>💡 Claude가 JSON을 만들어주면 <b>[ ]부분 전체</b>를 복사해서 다음 단계에 붙여넣으세요!</div><Btn v="success" full onClick={()=>setStep("import")}>✓ JSON 붙여넣기로 →</Btn></div>);
}

// ── EXAM BUILDER ──────────────────────────────────────────────────────────
function ExamBuilder({bank,setExams,onNav}) {
  const [step,setStep]=useState(1);
  const [meta,setMeta]=useState({title:"",school:"",grade:"중1",teacher:"Angela",date:"",timeLimit:"30",totalScore:"100",note:"",showAns:true,showExp:true,twoCol:false});
  const [selSets,setSelSets]=useState([]);
  const [selQs,setSelQs]=useState([]);
  const [shuffle,setShuffle]=useState(false);
  const allQs=selSets.flatMap(sid=>(bank[sid]?.questions||[]).map(q=>({...q,setId:sid,setTitle:bank[sid]?.title})));
  function go(){let qs=allQs.filter(q=>selQs.includes(`${q.setId}-${q.id}`));if(shuffle)qs=[...qs].sort(()=>Math.random()-.5);const exam={id:uid(),...meta,questions:qs,createdAt:new Date().toLocaleDateString("ko-KR")};setExams(e=>[...e,exam]);onNav("exam-view",exam.id);}
  return (<div><div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:20}}>📝 시험지 출제</div><div style={{background:T.card,borderRadius:14,padding:4,marginBottom:20,display:"flex",border:`2px solid ${T.border}`,boxShadow:T.shadow}}>{["① 기본 정보","② 문항 선택"].map((s,i)=><div key={i} onClick={()=>i===0&&setStep(1)} style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:10,fontSize:12,fontWeight:800,cursor:i===0?"pointer":"default",background:step===i+1?T.accent:"transparent",color:step===i+1?"#fff":T.textMid,transition:"all .15s"}}>{s}</div>)}</div>{step===1&&<div><Card style={{marginBottom:14}}><div style={{fontWeight:800,color:T.text,marginBottom:14,fontSize:14}}>시험지 정보</div><Field label="시험지 제목 *"><Inp value={meta.title} onChange={v=>setMeta(m=>({...m,title:v}))} placeholder="예: 1학기 중간고사"/></Field><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Field label="학교명"><Inp value={meta.school} onChange={v=>setMeta(m=>({...m,school:v}))} placeholder="OO학원"/></Field><Field label="담당 교사"><Inp value={meta.teacher} onChange={v=>setMeta(m=>({...m,teacher:v}))} placeholder="Angela"/></Field><Field label="학년"><Sel value={meta.grade} onChange={v=>setMeta(m=>({...m,grade:v}))} options={GRADES}/></Field><Field label="시험일"><Inp value={meta.date} onChange={v=>setMeta(m=>({...m,date:v}))} placeholder="2024. 5. 15"/></Field><Field label="제한시간(분)"><Inp value={meta.timeLimit} onChange={v=>setMeta(m=>({...m,timeLimit:v}))} placeholder="30"/></Field><Field label="총점"><Inp value={meta.totalScore} onChange={v=>setMeta(m=>({...m,totalScore:v}))} placeholder="100"/></Field></div><Field label="유의사항 (선택)"><Inp value={meta.note} onChange={v=>setMeta(m=>({...m,note:v}))} placeholder="모든 답은 OMR 카드에 기입하세요." multi style={{minHeight:52}}/></Field><div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:4}}>{[{k:"showAns",l:"✅ 답안표"},{k:"showExp",l:"💡 해설"},{k:"twoCol",l:"📰 2단 편집"}].map(o=><label key={o.k} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,color:T.textMid}}><input type="checkbox" checked={meta[o.k]} onChange={e=>setMeta(m=>({...m,[o.k]:e.target.checked}))} style={{width:16,height:16,accentColor:T.accent}}/>{o.l}</label>)}</div></Card><Btn v="primary" full onClick={()=>setStep(2)} disabled={!meta.title.trim()}>다음: 문항 선택 →</Btn>{!meta.title.trim()&&<div style={{fontSize:11,color:T.red,textAlign:"center",marginTop:6}}>시험지 제목을 입력해주세요</div>}</div>}{step===2&&<div><Card style={{marginBottom:14}}><div style={{fontWeight:800,color:T.text,marginBottom:12,fontSize:13}}>① 문제 세트 선택</div>{Object.values(bank).length===0?<div style={{textAlign:"center",color:T.textDim,padding:20,fontSize:12}}>문제 은행에 세트를 먼저 추가해주세요.</div>:Object.values(bank).map(s=><div key={s.id} onClick={()=>setSelSets(p=>p.includes(s.id)?p.filter(x=>x!==s.id):[...p,s.id])} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}><div style={{width:22,height:22,borderRadius:6,border:`2px solid ${selSets.includes(s.id)?T.accent:T.border}`,background:selSets.includes(s.id)?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>{selSets.includes(s.id)&&<span style={{color:"#fff",fontSize:14,fontWeight:900}}>✓</span>}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.text}}>{s.title}</div><div style={{display:"flex",gap:5,marginTop:3}}><Tag color="blue">{s.grade}</Tag><Tag color="green">{s.questions.length}문항</Tag></div></div></div>)}</Card>{selSets.length>0&&<Card style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontWeight:800,color:T.text,fontSize:13}}>② 문항 선택 <span style={{color:T.accent}}>({selQs.length}/{allQs.length})</span></div><Btn v="ghost" size="sm" onClick={()=>setSelQs(selQs.length===allQs.length?[]:allQs.map(q=>`${q.setId}-${q.id}`))}>{selQs.length===allQs.length?"전체 해제":"전체 선택"}</Btn></div>{allQs.map(q=>{const key=`${q.setId}-${q.id}`;return<div key={key} onClick={()=>setSelQs(p=>p.includes(key)?p.filter(x=>x!==key):[...p,key])} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${T.border}`,cursor:"pointer",alignItems:"flex-start"}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${selQs.includes(key)?T.green:T.border}`,background:selQs.includes(key)?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all .15s"}}>{selQs.includes(key)&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}</div><div style={{flex:1}}><div style={{fontSize:11,color:T.textMid,marginBottom:1}}>{q.setTitle}</div><div style={{fontSize:13,color:T.text,lineHeight:1.5}}>{q.q}</div></div></div>})}<label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,color:T.textMid,marginTop:12}}><input type="checkbox" checked={shuffle} onChange={e=>setShuffle(e.target.checked)} style={{width:16,height:16,accentColor:T.accent}}/>문항 순서 랜덤 섞기</label></Card>}<div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setStep(1)}>← 이전</Btn><Btn v="primary" full disabled={selQs.length===0} onClick={go}>🖨️ 시험지 생성 ({selQs.length}문항)</Btn></div></div>}</div>);
}

// ── EXAM PRINT VIEW ───────────────────────────────────────────────────────
function ExamPrintView({exam,onBack}) {
  const qs=exam.questions||[];
  const perQ=qs.length>0?Math.floor(parseInt(exam.totalScore||100)/qs.length):0;
  const [mode,setMode]=useState("print");
  const [ans,setAns]=useState({});
  const [graded,setGraded]=useState(false);
  const score=useMemo(()=>{if(!graded)return null;const c=qs.filter((q,i)=>ans[i]===q.ans).length;return{c,total:qs.length,pct:Math.round(c/qs.length*100)};},[graded,ans,qs]);
  if(mode==="student") return (<div><div className="no-print" style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><Btn v="ghost" onClick={()=>{setMode("print");setAns({});setGraded(false);}}>← 출력 보기</Btn>{graded?<Btn v="ghost" onClick={()=>{setAns({});setGraded(false);}}>🔄 다시 풀기</Btn>:<Btn v="primary" disabled={Object.keys(ans).length<qs.length} onClick={()=>setGraded(true)}>채점하기 ({Object.keys(ans).length}/{qs.length})</Btn>}</div>{graded&&score&&<div className="no-print" style={{background:`linear-gradient(135deg,${T.accent},${T.accentDark})`,borderRadius:16,padding:"20px 16px",marginBottom:20,color:"#fff",textAlign:"center"}}><div style={{fontSize:52,fontWeight:900}}>{score.pct}점</div><div style={{fontSize:14,opacity:.85}}>{score.c}/{score.total}개 정답</div></div>}{qs.map((q,i)=>{const ua=ans[i],ok=graded&&ua===q.ans,bad=graded&&ua&&ua!==q.ans;return(<div key={i} style={{background:T.card,border:`2px solid ${ok?T.green:bad?T.red:T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:12,boxShadow:T.shadow}}><div style={{display:"grid",gridTemplateColumns:"28px 1fr",gap:6,marginBottom:10}}><span style={{fontWeight:800,fontSize:14,color:T.accent,fontFamily:"monospace"}}>{String(i+1).padStart(2,"0")}</span><span style={{fontSize:14,lineHeight:1.7,color:T.text}}>{q.q}</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>{q.opts.map((o,j)=>{const v=j+1,isSel=ua===v,isAns=q.ans===v;return<div key={j} onClick={()=>!graded&&setAns(a=>({...a,[i]:v}))} style={{display:"flex",gap:5,padding:"7px 9px",borderRadius:8,fontSize:13,lineHeight:1.6,cursor:graded?"default":"pointer",transition:"all .15s",alignItems:"baseline",background:graded?(isAns?T.greenLight:isSel?T.redLight:"transparent"):(isSel?T.accentLight:"transparent"),border:`1px solid ${graded?(isAns?T.green:isSel?T.red:T.border):(isSel?T.accent:T.border)}`}}><span style={{fontWeight:800,flexShrink:0,color:graded?(isAns?T.green:isSel?T.red:T.textDim):(isSel?T.accent:T.textDim)}}>{MARKS[j]}</span><span style={{color:T.text}}>{o}</span></div>})}</div>{graded&&bad&&q.exp&&<div style={{marginTop:8,fontSize:12,color:T.yellow,padding:"6px 10px",background:T.yellowLight,borderRadius:8}}>💡 {MARKS[q.ans-1]} {q.exp}</div>}</div>);})}</div>);
  return (<div><div className="no-print" style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}><Btn v="ghost" onClick={onBack}>← 목록</Btn><Btn v="soft" onClick={()=>setMode("student")}>✏️ 학생 풀기</Btn><Btn v="primary" onClick={()=>window.print()}>🖨️ 인쇄 / PDF</Btn></div><div className="no-print" style={{fontSize:11,color:T.textMid,marginBottom:14,padding:"9px 13px",background:T.accentLight,borderRadius:10,lineHeight:1.6}}>💡 인쇄 버튼 → 프린터 선택 또는 <b>PDF로 저장</b>. 배율 <b>맞춤/100%</b>로 설정하세요.</div><div style={{background:"white",borderRadius:16,boxShadow:T.shadowLg,border:`2px solid ${T.border}`,padding:"28px 24px",fontFamily:"'Malgun Gothic',serif"}}><div style={{textAlign:"center",borderBottom:"3px double #222",paddingBottom:14,marginBottom:18}}>{exam.school&&<div style={{fontSize:13,color:"#444",marginBottom:2}}>{exam.school}</div>}<div style={{fontSize:24,fontWeight:900,letterSpacing:1,color:"#111",margin:"5px 0"}}>{exam.title}</div><div style={{display:"flex",justifyContent:"center",gap:24,fontSize:12,color:"#555",flexWrap:"wrap",marginTop:6}}>{exam.grade&&<span>대상: <b>{exam.grade}</b></span>}{exam.timeLimit&&<span>제한 시간: <b>{exam.timeLimit}분</b></span>}{exam.totalScore&&<span>총점: <b>{exam.totalScore}점</b></span>}{exam.date&&<span>날짜: <b>{exam.date}</b></span>}{exam.teacher&&<span>출제: <b>{exam.teacher}</b></span>}</div><div style={{display:"flex",justifyContent:"flex-end",gap:20,marginTop:12,paddingTop:10,borderTop:"1px solid #e0e0e0",fontSize:12}}><span>이름: ___________________</span><span>학번: __________</span><span>점수: __________</span></div></div><div style={{background:"#f5f7ff",borderLeft:"4px solid #3b6ef8",padding:"8px 14px",marginBottom:20,fontSize:12,display:"flex",gap:20,flexWrap:"wrap",borderRadius:"0 6px 6px 0"}}><span>● 총 <b>{qs.length}문항</b></span><span>● 각 <b>{perQ}점</b></span><span>● 각 문제의 ①~⑤ 중 하나를 선택하세요.</span>{exam.note&&<span>● {exam.note}</span>}</div><div style={exam.twoCol?{columns:2,columnGap:32}:{}}>{qs.map((q,i)=><div key={i} style={{breakInside:"avoid",pageBreakInside:"avoid",marginBottom:18,paddingBottom:14,borderBottom:"1px dashed #e0e6f5"}}><div style={{display:"flex",gap:8,marginBottom:9,alignItems:"flex-start"}}><span style={{fontWeight:900,fontSize:15,color:"#1a4fcc",minWidth:28,flexShrink:0,lineHeight:1.5}}>{i+1}.</span><span style={{fontSize:14,lineHeight:1.8,color:"#111",flex:1}}>{q.q}</span><span style={{fontSize:11,color:"#aaa",flexShrink:0,marginTop:3}}>({perQ}점)</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px",paddingLeft:36}}>{q.opts.map((o,j)=><div key={j} style={{fontSize:13,display:"flex",gap:6,lineHeight:1.7,color:"#222",alignItems:"baseline"}}><span style={{fontWeight:700,flexShrink:0}}>{MARKS[j]}</span><span>{o}</span></div>)}</div></div>)}</div>{exam.showAns&&qs.length>0&&<div style={{marginTop:24,borderTop:"2px solid #222",paddingTop:18}}><div style={{fontWeight:900,fontSize:14,marginBottom:12}}><span style={{background:"#222",color:"#fff",padding:"2px 10px",borderRadius:4,fontSize:12}}>■ 정 답 표</span></div>{Array.from({length:Math.ceil(qs.length/10)},(_,row)=><div key={row} style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(10,qs.length-row*10)},1fr)`,gap:5,marginBottom:6}}>{qs.slice(row*10,(row+1)*10).map((q,j)=><div key={j} style={{border:"1px solid #ccc",borderRadius:6,padding:"6px 3px",textAlign:"center",background:(row*10+j)%2===0?"#f9faff":"#fff"}}><div style={{fontSize:10,color:"#777",marginBottom:1}}>{row*10+j+1}</div><div style={{fontSize:16,fontWeight:900,color:"#1a4fcc"}}>{MARKS[q.ans-1]}</div></div>)}</div>)}</div>}{exam.showExp&&qs.some(q=>q.exp)&&<div style={{marginTop:20,borderTop:"1px solid #ccc",paddingTop:16}}><div style={{fontWeight:900,fontSize:13,marginBottom:10}}>■ 문제 해설</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 28px"}}>{qs.map((q,i)=>q.exp&&<div key={i} style={{fontSize:11,display:"flex",gap:6,paddingBottom:5,borderBottom:"1px solid #eee",alignItems:"baseline"}}><span style={{fontWeight:900,color:"#1a4fcc",flexShrink:0,minWidth:22}}>{i+1}.</span><span style={{fontWeight:700,color:"#16a34a",flexShrink:0}}>{MARKS[q.ans-1]}</span><span style={{color:"#333"}}>{q.exp}</span></div>)}</div></div>}<div style={{marginTop:20,borderTop:"1px solid #e0e0e0",paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:10,color:"#bbb"}}><span>Angela's English Academy {exam.grade||""}</span><span>{exam.teacher&&`출제: ${exam.teacher}`}</span><span>생성일: {exam.createdAt}</span></div></div></div>);
}

// ── EXAM LIST ─────────────────────────────────────────────────────────────
function ExamList({exams,setExams,onNav}) {
  function del(id){if(confirm("이 시험지를 삭제할까요?"))setExams(e=>e.filter(x=>x.id!==id));}
  return (<div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}><div style={{fontSize:18,fontWeight:900,color:T.text}}>🖨️ 시험지 목록</div><Btn v="primary" onClick={()=>onNav("exam-builder")}>+ 새 출제</Btn></div>{exams.length===0?<div style={{textAlign:"center",padding:"40px 24px",background:T.card,borderRadius:16,border:`2px dashed ${T.border}`}}><div style={{fontSize:40,marginBottom:8}}>🖨️</div><div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>시험지가 없어요</div><div style={{fontSize:12,color:T.textMid,marginBottom:14}}>출제 화면에서 새 시험지를 만들어보세요.</div><Btn v="primary" onClick={()=>onNav("exam-builder")}>시험지 출제하기</Btn></div>:exams.slice().reverse().map(e=><div key={e.id} style={{background:T.card,border:`2px solid ${T.border}`,borderRadius:16,padding:"15px 16px",marginBottom:10,boxShadow:T.shadow}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div onClick={()=>onNav("exam-view",e.id)} style={{flex:1,cursor:"pointer"}}><div style={{fontWeight:800,fontSize:14,color:T.text,marginBottom:6}}>{e.title}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Tag color="blue">{e.grade}</Tag><Tag color="green">{e.questions.length}문항</Tag>{e.timeLimit&&<Tag color="yellow">{e.timeLimit}분</Tag>}<Tag color="purple">{e.createdAt}</Tag></div></div><div style={{display:"flex",gap:6,flexShrink:0}}><Btn v="primary" size="sm" onClick={()=>onNav("exam-view",e.id)}>🖨️ 출력</Btn><Btn v="danger" size="sm" onClick={()=>del(e.id)}>삭제</Btn></div></div></div>)}</div>);
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [mode,setMode]=useState("landing"); // landing | teacher-login | student-login | teacher | student
  const [studentName,setStudentName]=useState("");
  const [bank,setBank]=useStorage("angela_bank",INIT_BANK);
  const [exams,setExams]=useStorage("angela_exams",[]);
  const [savedPw,setSavedPw]=useStorage("angela_pw","1111");
  const [assignments]=useStorage("angela_assignments",[]);

  if(mode==="landing") return <Landing onTeacher={()=>setMode("teacher-login")} onStudent={()=>setMode("student-login")}/>;
  if(mode==="teacher-login") return <TeacherLogin savedPw={savedPw} onSuccess={()=>setMode("teacher")} onBack={()=>setMode("landing")}/>;
  if(mode==="student-login") return <StudentLogin onSuccess={name=>{setStudentName(name);setMode("student");}} onBack={()=>setMode("landing")}/>;
  if(mode==="teacher") return <TeacherApp onLogout={()=>setMode("landing")} bank={bank} setBank={setBank} exams={exams} setExams={setExams} savedPw={savedPw} setSavedPw={setSavedPw}/>;
  if(mode==="student") return <StudentHome name={studentName} bank={bank} assignments={assignments} onLogout={()=>setMode("landing")}/>;
  return null;
}
