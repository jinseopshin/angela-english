"use client";
import { useState } from "react";

// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — aiQuestions.js
//   AI 문제 자동 생성: Claude API → 문제은행에 바로 추가
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg:"#f0f7ff", card:"#ffffff", border:"#dce8ff",
  accent:"#4f8ef7", accentLight:"#e8f0ff",
  green:"#22c55e", greenLight:"#dcfce7",
  red:"#ef4444", redLight:"#fee2e2",
  yellow:"#f59e0b", yellowLight:"#fef3c7",
  purple:"#a855f7", purpleLight:"#f3e8ff",
  orange:"#f97316", orangeLight:"#fff7ed",
  text:"#1e293b", textMid:"#64748b", textDim:"#94a3b8",
  shadow:"0 4px 16px rgba(79,142,247,0.12)",
  shadowLg:"0 8px 32px rgba(79,142,247,0.18)",
};

function Btn({ children, onClick, v="primary", size="md", style={}, disabled }) {
  const vs = {
    primary:{bg:T.accent,color:"white"},
    secondary:{bg:T.accentLight,color:T.accent},
    success:{bg:T.green,color:"white"},
    danger:{bg:T.red,color:"white"},
    ghost:{bg:"transparent",color:T.textMid},
  }[v];
  const sz = {sm:{padding:"5px 10px",fontSize:11},md:{padding:"9px 16px",fontSize:13},lg:{padding:"12px 20px",fontSize:14}}[size];
  return <button onClick={onClick} disabled={disabled} style={{...sz,...vs,border:"none",borderRadius:10,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,transition:"all 0.15s",...style}}>{children}</button>;
}

function Card({ children, style={} }) {
  return <div style={{background:T.card,borderRadius:16,padding:16,boxShadow:T.shadow,border:`1px solid ${T.border}`,...style}}>{children}</div>;
}

const GRADES = ["유치원","초등1","초등2","초등3","초등4","초등5","초등6","중1","중2","중3"];
const TAGS = ["be동사","일반동사","조동사","시제","의문문","부정문","어휘","비교급","수동태","기타"];

// Claude API 호출 — 내 서버(Next.js API Route)를 통해 안전하게 호출
// API 키는 서버 환경변수에만 존재, 클라이언트에 절대 노출 안됨
async function callClaude(topic, grade, tag, count) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, grade, tag, count }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `서버 오류 (${res.status})`);
  }

  return data.questions || [];
}


// ── AI 문제 생성 화면 ──────────────────────────────────────────────────────
export function AIQuestionGenerator({ bank, setBank, onBack }) {
  const [step, setStep] = useState("config"); // config | generating | preview | done

  // 설정
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("초등5");
  const [tag, setTag] = useState("be동사");
  const [count, setCount] = useState(5);
  const [targetSet, setTargetSet] = useState("new"); // "new" | bankId

  // 결과
  const [generated, setGenerated] = useState([]);
  const [editedQs, setEditedQs] = useState([]);
  const [setTitle, setSetTitle] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const MARKS = ["①","②","③","④","⑤"];

  const generate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요"); return; }
    setError("");
    setStep("generating");
    setProgress("서버에 요청 중...");

    try {
      setProgress("AI가 문제를 만드는 중... ✍️");
      // 서버 API Route 호출 (API 키는 서버에서만 사용)
      const qs = await callClaude(topic.trim(), grade, tag, count);
      setProgress("완료!");

      if (!qs || qs.length === 0) {
        setError("문제 생성에 실패했어요. 주제를 바꿔서 다시 시도해주세요.");
        setStep("config");
        return;
      }

      setGenerated(qs);
      setEditedQs(qs.map(q => ({ ...q })));
      setSetTitle(`${topic.trim()} (${grade})`);
      setStep("preview");
    } catch (e) {
      setError("오류: " + e.message);
      setStep("config");
    }
  };

  const addToBank = () => {
    const uid = () => Math.random().toString(36).slice(2,7);
    const validQs = editedQs.filter(q => q.q.trim() && q.opts.filter(o=>o.trim()).length >= 2);

    if (validQs.length === 0) { setError("저장할 문제가 없어요"); return; }

    if (targetSet === "new") {
      // 새 문제집 생성
      const id = uid();
      setBank(prev => ({
        ...prev,
        [id]: { id, title: setTitle, grade, tag, questions: validQs }
      }));
    } else {
      // 기존 문제집에 추가
      setBank(prev => ({
        ...prev,
        [targetSet]: {
          ...prev[targetSet],
          questions: [...(prev[targetSet]?.questions || []), ...validQs]
        }
      }));
    }
    setStep("done");
  };

  const updateQ = (idx, field, val) => {
    setEditedQs(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };
  const updateOpt = (qi, oi, val) => {
    setEditedQs(prev => prev.map((q, i) => {
      if (i !== qi) return q;
      const opts = [...q.opts];
      opts[oi] = val;
      return { ...q, opts };
    }));
  };
  const removeQ = (idx) => setEditedQs(prev => prev.filter((_, i) => i !== idx));

  // ── 완료 화면 ──
  if (step === "done") {
    const count = editedQs.filter(q => q.q.trim()).length;
    return (
      <div style={{textAlign:"center",padding:"48px 20px"}}>
        <div style={{fontSize:64,marginBottom:14}}>🎉</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text,marginBottom:8}}>
          {count}문제 추가 완료!
        </div>
        <div style={{fontSize:13,color:T.textMid,marginBottom:24}}>
          {targetSet === "new" ? `"${setTitle}" 문제집이 생성됐어요` : "기존 문제집에 추가됐어요"}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn v="secondary" size="lg" onClick={() => { setStep("config"); setGenerated([]); setEditedQs([]); setTopic(""); }}>
            🔄 다시 생성
          </Btn>
          <Btn v="primary" size="lg" onClick={onBack}>문제은행 보기</Btn>
        </div>
      </div>
    );
  }

  // ── 생성 중 화면 ──
  if (step === "generating") {
    return (
      <div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:56,marginBottom:16}}>🤖</div>
        <div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:8}}>AI가 문제를 만들고 있어요</div>
        <div style={{fontSize:13,color:T.textMid,marginBottom:24}}>{progress}</div>
        {/* 로딩 점 애니메이션 */}
        <div style={{display:"flex",justifyContent:"center",gap:8}}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width:10, height:10, borderRadius:"50%", background:T.accent,
              animation:`bounce 1s ease-in-out ${i*0.2}s infinite alternate`,
            }} />
          ))}
        </div>
        <style>{`@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-12px)}}`}</style>
      </div>
    );
  }

  // ── 미리보기 & 편집 화면 ──
  if (step === "preview") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <Btn v="ghost" size="sm" onClick={() => setStep("config")}>← 재설정</Btn>
          <div style={{fontSize:15,fontWeight:900,color:T.text}}>✍️ AI 생성 결과 확인</div>
        </div>

        {/* 저장 설정 */}
        <Card style={{marginBottom:14,background:T.greenLight,border:`1.5px solid ${T.green}30`}}>
          <div style={{fontSize:12,fontWeight:800,color:T.green,marginBottom:10}}>📦 저장 위치 선택</div>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <button onClick={()=>setTargetSet("new")} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${targetSet==="new"?T.green:T.border}`,background:targetSet==="new"?T.greenLight:T.card,fontSize:12,fontWeight:700,cursor:"pointer",color:T.text}}>
              ✨ 새 문제집으로
            </button>
            {Object.values(bank).map(s => (
              <button key={s.id} onClick={()=>setTargetSet(s.id)} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${targetSet===s.id?T.green:T.border}`,background:targetSet===s.id?T.greenLight:T.card,fontSize:12,fontWeight:700,cursor:"pointer",color:T.text}}>
                📚 {s.title}에 추가
              </button>
            ))}
          </div>
          {targetSet === "new" && (
            <input value={setTitle} onChange={e=>setSetTitle(e.target.value)} placeholder="새 문제집 이름" style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,outline:"none"}} />
          )}
        </Card>

        {/* 문제 미리보기 & 편집 */}
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:8}}>
          📝 생성된 문제 {editedQs.length}개 (클릭해서 편집 가능)
        </div>

        {editedQs.map((q, qi) => (
          <Card key={q.id} style={{marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:7,background:T.accentLight,color:T.accent,flexShrink:0}}>Q{qi+1}</div>
              <textarea
                value={q.q}
                onChange={e=>updateQ(qi,"q",e.target.value)}
                rows={2}
                style={{flex:1,padding:"7px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}}
              />
              <button onClick={()=>removeQ(qi)} style={{width:24,height:24,borderRadius:7,border:"none",background:T.redLight,color:T.red,fontSize:12,cursor:"pointer",fontWeight:900,flexShrink:0}}>✕</button>
            </div>

            {q.opts.map((opt, oi) => (
              <div key={oi} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                <button
                  onClick={() => updateQ(qi, "ans", oi)}
                  style={{
                    width:26, height:26, borderRadius:8, border:"none", cursor:"pointer",
                    fontWeight:900, fontSize:12, flexShrink:0,
                    background: q.ans === oi ? T.green : T.accentLight,
                    color: q.ans === oi ? "white" : T.accent,
                  }}
                  title="클릭하면 정답으로 설정"
                >{MARKS[oi]}</button>
                <input
                  value={opt}
                  onChange={e=>updateOpt(qi,oi,e.target.value)}
                  placeholder={`보기 ${oi+1}`}
                  style={{flex:1,padding:"6px 10px",borderRadius:8,border:`1.5px solid ${q.ans===oi?T.green:T.border}`,fontSize:12,outline:"none",fontWeight:q.ans===oi?700:400}}
                />
              </div>
            ))}

            <input
              value={q.exp}
              onChange={e=>updateQ(qi,"exp",e.target.value)}
              placeholder="해설 (선택)"
              style={{width:"100%",boxSizing:"border-box",marginTop:6,padding:"6px 10px",borderRadius:8,border:`1.5px solid ${T.border}`,fontSize:11,color:T.textMid,outline:"none"}}
            />
          </Card>
        ))}

        {error && <div style={{color:T.red,fontSize:12,fontWeight:700,marginBottom:10}}>⚠️ {error}</div>}

        <div style={{display:"flex",gap:10,marginTop:4}}>
          <Btn v="secondary" size="md" onClick={generate} style={{flex:1}}>🔄 재생성</Btn>
          <Btn v="success" size="md" onClick={addToBank} style={{flex:2}}
            disabled={editedQs.filter(q=>q.q.trim()).length===0}>
            ✅ 문제은행에 추가 ({editedQs.filter(q=>q.q.trim()).length}문제)
          </Btn>
        </div>
      </div>
    );
  }

  // ── 설정 화면 ──
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <Btn v="ghost" size="sm" onClick={onBack}>← 뒤로</Btn>
        <div style={{fontSize:16,fontWeight:900,color:T.text}}>🤖 AI 문제 자동 생성</div>
      </div>

      {/* 설명 배너 */}
      <div style={{background:`linear-gradient(135deg,${T.purple},${T.accent})`,borderRadius:14,padding:"14px 16px",color:"white",marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:900,marginBottom:4}}>✨ Claude AI가 문제를 만들어드려요</div>
        <div style={{fontSize:12,opacity:.9,lineHeight:1.6}}>
          주제와 학년을 입력하면 → AI가 즉석에서 문제 생성 → 검토 후 문제은행에 바로 추가!
        </div>
      </div>

      <Card style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:12}}>📝 문제 설정</div>

        {/* 주제 */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textMid,marginBottom:6}}>주제 / 문법 포인트 *</div>
          <input
            value={topic}
            onChange={e=>{setTopic(e.target.value);setError("");}}
            placeholder="예: be동사 현재시제, 과거형 불규칙 동사, can/may 조동사..."
            style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${error&&!topic.trim()?T.red:T.border}`,fontSize:13,outline:"none"}}
          />
          {/* 빠른 주제 선택 */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
            {["be동사 현재시제","일반동사 과거형","조동사 can/may","현재진행형","의문문 만들기","부정문","비교급/최상급","전치사"].map(t=>(
              <button key={t} onClick={()=>setTopic(t)} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:topic===t?T.accentLight:T.bg,color:topic===t?T.accent:T.textMid,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 학년 & 태그 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMid,marginBottom:6}}>학년</div>
            <select value={grade} onChange={e=>setGrade(e.target.value)} style={{width:"100%",padding:"10px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,boxSizing:"border-box"}}>
              {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMid,marginBottom:6}}>문법 태그</div>
            <select value={tag} onChange={e=>setTag(e.target.value)} style={{width:"100%",padding:"10px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,boxSizing:"border-box"}}>
              {TAGS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* 문항 수 */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textMid,marginBottom:6}}>생성할 문항 수</div>
          <div style={{display:"flex",gap:8}}>
            {[3,5,8,10].map(n=>(
              <button key={n} onClick={()=>setCount(n)} style={{flex:1,padding:"9px 6px",borderRadius:9,border:`1.5px solid ${count===n?T.accent:T.border}`,background:count===n?T.accentLight:T.bg,fontSize:13,fontWeight:800,cursor:"pointer",color:count===n?T.accent:T.text}}>
                {n}문제
              </button>
            ))}
          </div>
        </div>

        {/* 기존 문제집에 추가 옵션 */}
        <div>
          <div style={{fontSize:12,fontWeight:700,color:T.textMid,marginBottom:6}}>저장 위치</div>
          <select value={targetSet} onChange={e=>setTargetSet(e.target.value)} style={{width:"100%",padding:"10px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,boxSizing:"border-box"}}>
            <option value="new">✨ 새 문제집으로 생성</option>
            {Object.values(bank).map(s=><option key={s.id} value={s.id}>📚 {s.title}에 추가</option>)}
          </select>
        </div>
      </Card>

      {error && (
        <div style={{padding:"10px 14px",background:T.redLight,borderRadius:10,marginBottom:12,fontSize:12,color:T.red,fontWeight:700}}>
          ⚠️ {error}
        </div>
      )}

      {/* 예상 결과 안내 */}
      <Card style={{marginBottom:14,background:T.yellowLight,border:`1px dashed ${T.yellow}`}}>
        <div style={{fontSize:12,color:T.text,lineHeight:1.7}}>
          <strong>예시:</strong> 주제 "be동사 현재시제" + 학년 "초등5" + 5문제 입력 시<br/>
          → "I ______ a student." 형태의 5지 선다 문제 5개 + 해설 자동 생성
        </div>
      </Card>

      <Btn v="primary" size="lg" onClick={generate}
        disabled={!topic.trim()}
        style={{width:"100%",fontSize:15}}>
        🤖 AI 문제 생성하기 ({count}문제)
      </Btn>

      <div style={{fontSize:11,color:T.textDim,textAlign:"center",marginTop:10}}>
        생성 후 내용을 직접 수정하고 저장할 수 있어요
      </div>
    </div>
  );
}
