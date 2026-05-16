"use client";
import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";

// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy - features.js
//   Phase 1: 반별 그룹 관리 / 업적 뱃지 / 공지 메시지 / 목표 설정
//   Phase 2: 주간 리그 / 문장 빈칸 게임 / 학부모 뷰어 / 월간 성적표 / 수업 일정
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg:"#f0f7ff", card:"#ffffff", border:"#dce8ff",
  accent:"#4f8ef7", accentDark:"#2563eb", accentLight:"#e8f0ff",
  green:"#22c55e", greenLight:"#dcfce7",
  red:"#ef4444", redLight:"#fee2e2",
  yellow:"#f59e0b", yellowLight:"#fef3c7",
  purple:"#a855f7", purpleLight:"#f3e8ff",
  pink:"#ec4899", pinkLight:"#fce7f3",
  orange:"#f97316", orangeLight:"#fff7ed",
  text:"#1e293b", textMid:"#64748b", textDim:"#94a3b8",
  shadow:"0 4px 16px rgba(79,142,247,0.12)",
  shadowLg:"0 8px 32px rgba(79,142,247,0.18)",
};

const GRADES = ["유치원","초등1","초등2","초등3","초등4","초등5","초등6","중1","중2","중3"];

// ── 공통 UI ────────────────────────────────────────────────────────────────
function Btn({ children, onClick, v="primary", size="md", style={}, disabled }) {
  const vs = {
    primary:{bg:T.accent,color:"white"}, secondary:{bg:T.accentLight,color:T.accent},
    danger:{bg:T.red,color:"white"}, success:{bg:T.green,color:"white"},
    ghost:{bg:"transparent",color:T.textMid},
  }[v];
  const sz = {sm:{padding:"5px 10px",fontSize:11}, md:{padding:"9px 16px",fontSize:13}, lg:{padding:"12px 20px",fontSize:14}}[size];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...sz, ...vs, border:"none", borderRadius:10, fontWeight:700,
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?.6:1,
      transition:"all 0.15s", ...style
    }}>{children}</button>
  );
}

function Card({ children, style={}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:T.card, borderRadius:16, padding:16,
      boxShadow:T.shadow, border:`1px solid ${T.border}`,
      cursor:onClick?"pointer":"default", ...style
    }}>{children}</div>
  );
}

function Tag({ children, color="blue" }) {
  const cl = {
    blue:{c:T.accent,b:T.accentLight}, green:{c:T.green,b:T.greenLight},
    red:{c:T.red,b:T.redLight}, yellow:{c:T.yellow,b:T.yellowLight},
    purple:{c:T.purple,b:T.purpleLight}, pink:{c:T.pink,b:T.pinkLight},
    orange:{c:T.orange,b:T.orangeLight},
  }[color]||{c:T.accent,b:T.accentLight};
  return <span style={{fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:7,color:cl.c,background:cl.b}}>{children}</span>;
}

function Input({ value, onChange, placeholder, type="text", style={} }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
    padding:"10px 12px", borderRadius:10, border:`1.5px solid ${T.border}`,
    fontSize:13, outline:"none", width:"100%", boxSizing:"border-box", ...style
  }} />;
}

const uid = () => Math.random().toString(36).slice(2,9);

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1 ① 반별 그룹 관리
// ══════════════════════════════════════════════════════════════════════════
export function GroupManager({ students, groups, setGroups, assignments, setAssignments, bank }) {
  const [mode, setMode] = useState("list"); // list | add | detail
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [form, setForm] = useState({ name:"", color:"#4f8ef7", icon:"📚" });
  const [addingMembers, setAddingMembers] = useState([]);
  const [assignBanks, setAssignBanks] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [assignDone, setAssignDone] = useState(false);

  const studentList = Object.values(students || {});
  const GROUP_ICONS = ["📚","🌟","🎯","🚀","🌈","🦋","🐬","🦁","🐼","🎸"];
  const GROUP_COLORS = ["#4f8ef7","#22c55e","#ec4899","#f59e0b","#a855f7","#f97316","#ef4444","#14b8a6"];

  const saveGroup = () => {
    if (!form.name.trim()) return;
    const id = uid();
    setGroups(prev => [...(prev||[]), { id, name:form.name.trim(), color:form.color, icon:form.icon, members:addingMembers, createdAt:new Date().toISOString().slice(0,10) }]);
    setForm({name:"",color:"#4f8ef7",icon:"📚"}); setAddingMembers([]); setMode("list");
  };

  const deleteGroup = (id) => {
    if (!confirm("반을 삭제할까요?")) return;
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const toggleMember = (name) => setAddingMembers(prev => prev.includes(name) ? prev.filter(x=>x!==name) : [...prev, name]);

  const assignToGroup = () => {
    if (!assignBanks.length || !selectedGroup) return;
    const newAssigns = selectedGroup.members.flatMap(studentName =>
      assignBanks.map(bankId => ({
        id: uid(), studentName, bankId,
        bankTitle: bank[bankId]?.title || bankId,
        assignedAt: new Date().toISOString(), dueDate: dueDate||null, status:"pending"
      }))
    );
    setAssignments(prev => [...(prev||[]), ...newAssigns]);
    setAssignDone(true); setAssignBanks([]); setDueDate("");
    setTimeout(() => setAssignDone(false), 2500);
  };

  // ── 그룹 상세 ──
  if (mode === "detail" && selectedGroup) {
    const g = selectedGroup;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <Btn v="ghost" size="sm" onClick={()=>setMode("list")}>← 뒤로</Btn>
          <div style={{width:36,height:36,borderRadius:10,background:g.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{g.icon}</div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>{g.name}</div>
          <Tag color="blue">{g.members?.length||0}명</Tag>
        </div>

        {/* 학생 목록 */}
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>👥 반 구성원</div>
          {(g.members||[]).length === 0
            ? <div style={{fontSize:12,color:T.textDim,textAlign:"center",padding:20}}>아직 구성원이 없어요</div>
            : (g.members||[]).map(name => {
                const s = students[name];
                return (
                  <div key={name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontSize:22}}>{s?.avatar||"🧑"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{name}</div>
                      <div style={{fontSize:11,color:T.textMid}}>{s?.grade||""} · ⭐{s?.points||0}p</div>
                    </div>
                  </div>
                );
              })
          }
        </Card>

        {/* 반 전체 과제 배정 */}
        <Card>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📬 반 전체 과제 배정</div>
          {Object.values(bank).map(s => (
            <div key={s.id} onClick={()=>setAssignBanks(prev=>prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",marginBottom:6,borderRadius:10,cursor:"pointer",
                background:assignBanks.includes(s.id)?T.accentLight:T.bg,
                border:`2px solid ${assignBanks.includes(s.id)?T.accent:T.border}`}}>
              <div style={{width:20,height:20,borderRadius:6,background:assignBanks.includes(s.id)?T.accent:T.border,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:12,fontWeight:900}}>
                {assignBanks.includes(s.id)?"✓":""}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text}}>{s.title}</div>
                <div style={{fontSize:10,color:T.textMid}}>{s.grade} · {s.questions.length}문항</div>
              </div>
            </div>
          ))}
          <div style={{marginTop:10,marginBottom:10}}>
            <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={{padding:"8px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:12,width:"100%",boxSizing:"border-box"}} />
          </div>
          {assignDone && <div style={{textAlign:"center",padding:10,background:T.greenLight,borderRadius:10,marginBottom:8,fontSize:12,fontWeight:800,color:T.green}}>✅ {g.members?.length||0}명에게 과제 배정 완료!</div>}
          <Btn v="primary" size="md" onClick={assignToGroup} disabled={!assignBanks.length} style={{width:"100%"}}>
            📬 {g.name} 전체 배정 ({assignBanks.length}개 선택)
          </Btn>
        </Card>
      </div>
    );
  }

  // ── 그룹 추가 ──
  if (mode === "add") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <Btn v="ghost" size="sm" onClick={()=>setMode("list")}>← 뒤로</Btn>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>➕ 새 반 만들기</div>
        </div>
        <Card style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:8}}>아이콘</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
            {GROUP_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))} style={{width:38,height:38,borderRadius:10,fontSize:22,border:"none",cursor:"pointer",background:form.icon===ic?form.color+"30":T.bg,outline:form.icon===ic?`2px solid ${form.color}`:"none"}}>{ic}</button>
            ))}
          </div>
          <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:8}}>색상</div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {GROUP_COLORS.map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"3px solid #fff":"2px solid transparent",cursor:"pointer",boxShadow:form.color===c?"0 0 0 2px "+c:""}} />
            ))}
          </div>
          {/* 미리보기 */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:form.color+"15",borderRadius:12,marginBottom:14}}>
            <div style={{width:40,height:40,borderRadius:12,background:form.color+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{form.icon}</div>
            <div style={{fontSize:15,fontWeight:900,color:T.text}}>{form.name||"반 이름"}</div>
          </div>
          <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:6}}>반 이름 *</div>
          <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="예: 월수반, 고급반, 5학년A반" style={{marginBottom:14}} />
          <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:8}}>구성원 선택</div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {studentList.map(s=>(
              <div key={s.name} onClick={()=>toggleMember(s.name)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",marginBottom:6,borderRadius:10,cursor:"pointer",background:addingMembers.includes(s.name)?T.accentLight:T.bg,border:`1.5px solid ${addingMembers.includes(s.name)?T.accent:T.border}`}}>
                <div style={{fontSize:20}}>{s.avatar||"🧑"}</div>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:T.text}}>{s.name} <span style={{fontSize:11,color:T.textMid}}>({s.grade||""})</span></div>
                {addingMembers.includes(s.name) && <span style={{color:T.accent,fontWeight:900}}>✓</span>}
              </div>
            ))}
          </div>
        </Card>
        <Btn v="primary" size="lg" onClick={saveGroup} disabled={!form.name.trim()} style={{width:"100%"}}>✅ 반 만들기 ({addingMembers.length}명)</Btn>
      </div>
    );
  }

  // ── 그룹 목록 ──
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>👥 반별 그룹 관리</div>
          <div style={{fontSize:11,color:T.textMid,marginTop:2}}>반을 만들어 한 번에 과제를 배정하세요</div>
        </div>
        <Btn v="primary" size="md" onClick={()=>setMode("add")}>+ 새 반</Btn>
      </div>
      {(!groups||groups.length===0)
        ? <Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>👥</div><div style={{fontSize:14,fontWeight:700,color:T.text}}>아직 반이 없어요</div><div style={{fontSize:12,color:T.textMid,marginTop:4,marginBottom:16}}>월수반, 화목반 등 반을 만들어 한 번에 과제를 배정하세요!</div><Btn v="primary" size="md" onClick={()=>setMode("add")}>+ 첫 반 만들기</Btn></Card>
        : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {groups.map(g=>(
              <Card key={g.id} onClick={()=>{setSelectedGroup(g);setMode("detail");}} style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:14,background:g.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{g.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:900,color:T.text,marginBottom:4}}>{g.name}</div>
                  <div style={{fontSize:11,color:T.textMid}}>{g.members?.length||0}명 · {g.createdAt} 생성</div>
                </div>
                <button onClick={e=>{e.stopPropagation();deleteGroup(g.id);}} style={{width:28,height:28,borderRadius:8,border:"none",background:T.redLight,color:T.red,fontSize:12,cursor:"pointer",fontWeight:900}}>✕</button>
              </Card>
            ))}
          </div>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1 ② 업적 & 뱃지 시스템
// ══════════════════════════════════════════════════════════════════════════
export const BADGES = [
  { id:"first_game",   icon:"🎮", name:"첫 게임",        desc:"처음으로 단어 게임을 했어요!",    condition: s => (s.records||[]).some(r=>r.type==="game") },
  { id:"streak3",      icon:"🔥", name:"3일 연속",        desc:"3일 연속으로 공부했어요!",        condition: s => computeStreak(s) >= 3 },
  { id:"streak7",      icon:"🔥🔥",name:"7일 연속",       desc:"7일 연속 학습! 대단해요!",        condition: s => computeStreak(s) >= 7 },
  { id:"streak30",     icon:"💎", name:"30일 연속",       desc:"한 달 개근! 전설이에요!",         condition: s => computeStreak(s) >= 30 },
  { id:"points100",    icon:"⭐", name:"별 100개",        desc:"포인트 100점 돌파!",              condition: s => (s.points||0) >= 100 },
  { id:"points500",    icon:"🌟", name:"별 500개",        desc:"포인트 500점 돌파!",              condition: s => (s.points||0) >= 500 },
  { id:"points1000",   icon:"👑", name:"왕관",            desc:"포인트 1000점! 최고예요!",        condition: s => (s.points||0) >= 1000 },
  { id:"perfect",      icon:"💯", name:"완벽한 점수",     desc:"과제에서 100점을 받았어요!",      condition: s => (s.records||[]).some(r=>r.type==="assignment"&&r.score===r.total&&r.total>0) },
  { id:"games10",      icon:"🎯", name:"게임 달인",       desc:"게임 10회 달성!",                 condition: s => (s.records||[]).filter(r=>r.type==="game").length >= 10 },
  { id:"games50",      icon:"🏆", name:"게임 마스터",     desc:"게임 50회 달성!",                 condition: s => (s.records||[]).filter(r=>r.type==="game").length >= 50 },
  { id:"assign10",     icon:"📚", name:"과제 왕",         desc:"과제 10개 완료!",                 condition: s => (s.records||[]).filter(r=>r.type==="assignment").length >= 10 },
  { id:"accuracy90",   icon:"🎖️", name:"정확도 달인",     desc:"정답률 90% 이상 달성!",           condition: s => calcAccuracy(s) >= 90 },
  { id:"allgames",     icon:"🌈", name:"올라운더",        desc:"4가지 게임을 모두 해봤어요!",      condition: s => { const g=new Set((s.records||[]).filter(r=>r.type==="game").map(r=>r.gameType)); return g.size>=4; } },
  { id:"early",        icon:"🌅", name:"아침형 학생",     desc:"오전 7시 이전에 공부했어요!",     condition: s => (s.records||[]).some(r=>r.date&&new Date(r.date).getHours()<7) },
  { id:"night",        icon:"🌙", name:"야간 특훈",       desc:"밤 10시 이후에 공부했어요!",      condition: s => (s.records||[]).some(r=>r.date&&new Date(r.date).getHours()>=22) },
];

function computeStreak(s) {
  const dates = [...new Set((s.records||[]).map(r=>r.date?.slice(0,10)).filter(Boolean))].sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i=0; i<dates.length; i++) {
    const d = new Date(today); d.setDate(today.getDate()-i);
    if (dates[i]===d.toISOString().slice(0,10)) streak++; else break;
  }
  return streak;
}

function calcAccuracy(s) {
  const records = (s.records||[]).filter(r=>r.total>0);
  if (!records.length) return 0;
  return Math.round(records.reduce((a,r)=>a+(r.score/r.total*100),0)/records.length);
}

export function getEarnedBadges(student) {
  return BADGES.filter(b => { try { return b.condition(student); } catch { return false; } });
}

export function BadgeDisplay({ student, compact=false }) {
  const earned = getEarnedBadges(student);
  const all = BADGES;
  if (compact) {
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {earned.slice(0,6).map(b=>(
          <span key={b.id} title={b.name} style={{fontSize:20}}>{b.icon}</span>
        ))}
        {earned.length>6 && <span style={{fontSize:11,color:T.textMid,alignSelf:"center"}}>+{earned.length-6}</span>}
      </div>
    );
  }
  return (
    <div>
      <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>🎖️ 업적 & 뱃지 ({earned.length}/{all.length})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
        {all.map(b=>{
          const has = earned.find(e=>e.id===b.id);
          return (
            <div key={b.id} style={{padding:"10px 10px",borderRadius:12,background:has?T.yellowLight:T.bg,border:`1.5px solid ${has?T.yellow:T.border}`,opacity:has?1:0.45,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:4}}>{b.icon}</div>
              <div style={{fontSize:11,fontWeight:800,color:T.text,marginBottom:2}}>{b.name}</div>
              <div style={{fontSize:10,color:T.textMid,lineHeight:1.3}}>{b.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 새 뱃지 획득 축하 모달
export function BadgeCelebration({ badges, onClose }) {
  if (!badges||!badges.length) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,borderRadius:22,padding:28,textAlign:"center",maxWidth:320,width:"100%",boxShadow:T.shadowLg}}>
        <div style={{fontSize:56,marginBottom:10}}>{badges[0].icon}</div>
        <div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:6}}>🎉 새 뱃지 획득!</div>
        <div style={{fontSize:16,fontWeight:800,color:T.yellow,marginBottom:6}}>{badges[0].name}</div>
        <div style={{fontSize:13,color:T.textMid,marginBottom:20}}>{badges[0].desc}</div>
        <Btn v="primary" size="lg" onClick={onClose} style={{width:"100%"}}>확인!</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1 ③ 선생님 공지 & 메시지
// ══════════════════════════════════════════════════════════════════════════
export function NoticeManager({ notices, setNotices }) {
  const [mode, setMode] = useState("list"); // list | add
  const [form, setForm] = useState({ title:"", content:"", type:"notice", pinned:false });

  const add = () => {
    if (!form.title.trim()||!form.content.trim()) return;
    setNotices(prev=>[{id:uid(),title:form.title.trim(),content:form.content.trim(),type:form.type,pinned:form.pinned,createdAt:new Date().toISOString()}, ...(prev||[])]);
    setForm({title:"",content:"",type:"notice",pinned:false}); setMode("list");
  };

  const del = (id) => { if (!confirm("삭제할까요?")) return; setNotices(prev=>(prev||[]).filter(n=>n.id!==id)); };

  if (mode === "add") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <Btn v="ghost" size="sm" onClick={()=>setMode("list")}>← 뒤로</Btn>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>📢 공지 / 메시지 작성</div>
        </div>
        <Card>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:6}}>유형</div>
            <div style={{display:"flex",gap:8}}>
              {[{id:"notice",label:"📢 공지사항"},{id:"tip",label:"💡 학습 팁"},{id:"encourage",label:"💪 격려 메시지"}].map(t=>(
                <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{flex:1,padding:"8px 6px",borderRadius:9,border:`1.5px solid ${form.type===t.id?T.accent:T.border}`,background:form.type===t.id?T.accentLight:T.bg,fontSize:11,fontWeight:700,cursor:"pointer",color:T.text}}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:6}}>제목 *</div>
            <Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 이번 주 과제 안내" />
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:6}}>내용 *</div>
            <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={5} placeholder="학생들에게 전달할 내용을 적어주세요" style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${T.border}`,fontSize:13,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}} />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input type="checkbox" id="pinned" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} />
            <label htmlFor="pinned" style={{fontSize:12,fontWeight:700,color:T.text,cursor:"pointer"}}>📌 상단 고정 (중요 공지)</label>
          </div>
          <Btn v="primary" size="lg" onClick={add} disabled={!form.title.trim()||!form.content.trim()} style={{width:"100%"}}>✅ 게시하기</Btn>
        </Card>
      </div>
    );
  }

  const noticeList = notices || [];
  const pinned = noticeList.filter(n=>n.pinned);
  const normal = noticeList.filter(n=>!n.pinned);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>💬 공지 & 메시지</div>
          <div style={{fontSize:11,color:T.textMid,marginTop:2}}>학생 앱 첫 화면에 표시됩니다</div>
        </div>
        <Btn v="primary" size="md" onClick={()=>setMode("add")}>+ 작성</Btn>
      </div>
      {noticeList.length===0
        ? <Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>💬</div><div style={{fontSize:14,fontWeight:700,color:T.text}}>공지가 없어요</div><div style={{fontSize:12,color:T.textMid,marginTop:4,marginBottom:16}}>학생들에게 전달할 내용을 작성해보세요!</div><Btn v="primary" size="md" onClick={()=>setMode("add")}>+ 첫 공지 작성</Btn></Card>
        : [...pinned,...normal].map(n=>{
            const typeInfo = {notice:{icon:"📢",color:T.accent,bg:T.accentLight},tip:{icon:"💡",color:T.yellow,bg:T.yellowLight},encourage:{icon:"💪",color:T.green,bg:T.greenLight}}[n.type]||{icon:"📢",color:T.accent,bg:T.accentLight};
            return (
              <Card key={n.id} style={{marginBottom:10,background:n.pinned?T.yellowLight:T.card,border:n.pinned?`1.5px solid ${T.yellow}`:undefined}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:typeInfo.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{typeInfo.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:800,color:T.text}}>{n.title}</span>
                      {n.pinned && <Tag color="yellow">📌 고정</Tag>}
                    </div>
                    <div style={{fontSize:12,color:T.textMid,lineHeight:1.6,marginBottom:4}}>{n.content}</div>
                    <div style={{fontSize:10,color:T.textDim}}>{n.createdAt?.slice(0,10)}</div>
                  </div>
                  <button onClick={()=>del(n.id)} style={{width:26,height:26,borderRadius:8,border:"none",background:T.redLight,color:T.red,fontSize:12,cursor:"pointer",fontWeight:900,flexShrink:0}}>✕</button>
                </div>
              </Card>
            );
          })
      }
    </div>
  );
}

// 학생용 공지 뷰어 (앱 상단 배너)
export function NoticeBanner({ notices }) {
  const [dismissed, setDismissed] = useState([]);
  const visible = (notices||[]).filter(n=>!dismissed.includes(n.id)).slice(0,3);
  if (!visible.length) return null;
  const n = visible[0];
  const typeInfo = {notice:{icon:"📢",color:T.accent,bg:T.accentLight},tip:{icon:"💡",color:T.yellow,bg:T.yellowLight},encourage:{icon:"💪",color:T.green,bg:T.greenLight}}[n.type]||{icon:"📢",color:T.accent,bg:T.accentLight};
  return (
    <div style={{background:typeInfo.bg,borderBottom:`2px solid ${typeInfo.color}30`,padding:"10px 16px",display:"flex",alignItems:"flex-start",gap:10}}>
      <div style={{fontSize:20,flexShrink:0}}>{typeInfo.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:800,color:T.text}}>{n.title}</div>
        <div style={{fontSize:11,color:T.textMid,marginTop:2,lineHeight:1.5}}>{n.content}</div>
      </div>
      <button onClick={()=>setDismissed(p=>[...p,n.id])} style={{border:"none",background:"none",fontSize:16,color:T.textMid,cursor:"pointer",flexShrink:0,padding:2}}>✕</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1 ④ 목표 설정 & 달성
// ══════════════════════════════════════════════════════════════════════════
export function GoalManager({ students, goals, setGoals }) {
  const [form, setForm] = useState({ studentName:"", type:"accuracy", target:80, deadline:"" });
  const [saved, setSaved] = useState(false);

  const GOAL_TYPES = [
    { id:"accuracy", label:"정답률", unit:"%", icon:"🎯", max:100 },
    { id:"points",   label:"포인트", unit:"p", icon:"⭐", max:2000 },
    { id:"streak",   label:"연속학습", unit:"일", icon:"🔥", max:60 },
    { id:"assign",   label:"과제 완료", unit:"개", icon:"📝", max:50 },
  ];

  const addGoal = () => {
    if (!form.studentName||!form.target) return;
    setGoals(prev=>[...(prev||[]).filter(g=>!(g.studentName===form.studentName&&g.type===form.type)), {id:uid(),...form,createdAt:new Date().toISOString().slice(0,10)}]);
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const checkProgress = (goal) => {
    const s = students[goal.studentName];
    if (!s) return 0;
    if (goal.type==="accuracy") {
      const recs=(s.records||[]).filter(r=>r.total>0);
      return recs.length?Math.round(recs.reduce((a,r)=>a+(r.score/r.total*100),0)/recs.length):0;
    }
    if (goal.type==="points") return s.points||0;
    if (goal.type==="streak") return computeStreak(s);
    if (goal.type==="assign") return (s.records||[]).filter(r=>r.type==="assignment").length;
    return 0;
  };

  const studentList = Object.values(students||{});

  return (
    <div>
      <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:4}}>🎯 목표 설정</div>
      <div style={{fontSize:11,color:T.textMid,marginBottom:14}}>학생별 학습 목표를 설정하고 달성 현황을 확인하세요</div>

      {/* 목표 설정 폼 */}
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>+ 목표 추가</div>
        <div style={{marginBottom:10}}>
          <select value={form.studentName} onChange={e=>setForm(f=>({...f,studentName:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,boxSizing:"border-box"}}>
            <option value="">학생 선택</option>
            {studentList.map(s=><option key={s.name} value={s.name}>{s.name} ({s.grade||""})</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
          {GOAL_TYPES.map(gt=>(
            <button key={gt.id} onClick={()=>setForm(f=>({...f,type:gt.id}))} style={{padding:"9px 8px",borderRadius:9,border:`1.5px solid ${form.type===gt.id?T.accent:T.border}`,background:form.type===gt.id?T.accentLight:T.bg,fontSize:12,fontWeight:700,cursor:"pointer",color:T.text}}>
              {gt.icon} {gt.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMid,marginBottom:4}}>목표값</div>
            <Input type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:Number(e.target.value)}))} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.textMid,marginBottom:4}}>마감일 (선택)</div>
            <input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{width:"100%",padding:"10px 10px",borderRadius:10,border:`1.5px solid ${T.border}`,fontSize:13,boxSizing:"border-box"}} />
          </div>
        </div>
        {saved && <div style={{textAlign:"center",padding:8,background:T.greenLight,borderRadius:9,marginBottom:8,fontSize:12,fontWeight:800,color:T.green}}>✅ 목표 저장!</div>}
        <Btn v="primary" size="md" onClick={addGoal} disabled={!form.studentName} style={{width:"100%"}}>✅ 목표 설정</Btn>
      </Card>

      {/* 목표 현황 */}
      {(goals||[]).length>0 && (
        <div>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📊 목표 달성 현황</div>
          {(goals||[]).map(goal=>{
            const gt = GOAL_TYPES.find(g=>g.id===goal.type)||GOAL_TYPES[0];
            const current = checkProgress(goal);
            const pct = Math.min(100, Math.round(current/goal.target*100));
            const done = current>=goal.target;
            const isOverdue = goal.deadline && new Date(goal.deadline)<new Date() && !done;
            return (
              <Card key={goal.id} style={{marginBottom:10,background:done?T.greenLight:T.card,border:done?`1.5px solid ${T.green}`:undefined}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:800,color:T.text}}>{goal.studentName}</span>
                      <Tag color={done?"green":isOverdue?"red":"blue"}>{done?"✅ 달성!":isOverdue?"⚠️ 기한초과":`${pct}%`}</Tag>
                    </div>
                    <div style={{fontSize:11,color:T.textMid}}>{gt.icon} {gt.label} 목표: {goal.target}{gt.unit} · 현재: {current}{gt.unit}</div>
                    {goal.deadline && <div style={{fontSize:10,color:isOverdue?T.red:T.textDim,marginTop:2}}>마감: {goal.deadline}</div>}
                  </div>
                  <button onClick={()=>setGoals(prev=>(prev||[]).filter(g=>g.id!==goal.id))} style={{width:24,height:24,borderRadius:7,border:"none",background:T.redLight,color:T.red,fontSize:11,cursor:"pointer",fontWeight:900}}>✕</button>
                </div>
                <div style={{height:8,background:T.border,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:done?T.green:pct>60?T.accent:T.yellow,borderRadius:4,transition:"width 0.5s"}} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 학생용 목표 위젯
export function StudentGoalWidget({ studentName, goals }) {
  const myGoals = (goals||[]).filter(g=>g.studentName===studentName);
  if (!myGoals.length) return null;
  return (
    <Card style={{marginBottom:14,background:`linear-gradient(135deg,${T.accent}15,${T.purple}15)`,border:`1.5px solid ${T.accent}30`}}>
      <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:8}}>🎯 이번 달 목표</div>
      {myGoals.map(g=>{
        const TYPES={accuracy:{label:"정답률",unit:"%",icon:"🎯"},points:{label:"포인트",unit:"p",icon:"⭐"},streak:{label:"연속학습",unit:"일",icon:"🔥"},assign:{label:"과제",unit:"개",icon:"📝"}};
        const t=TYPES[g.type]||TYPES.accuracy;
        return (
          <div key={g.id} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{color:T.text,fontWeight:700}}>{t.icon} {t.label} {g.target}{t.unit} 달성</span>
              {g.deadline && <span style={{color:T.textMid}}>마감 {g.deadline}</span>}
            </div>
            <div style={{height:6,background:T.border,borderRadius:3}}>
              <div style={{height:"100%",width:"30%",background:T.accent,borderRadius:3}} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 ① 주간 리그 & 트로피
// ══════════════════════════════════════════════════════════════════════════
export function WeeklyLeague({ students }) {
  const getWeekStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  };

  const weekStart = getWeekStart();

  const ranking = useMemo(()=>{
    return Object.values(students||{}).map(s=>{
      const weekRecords = (s.records||[]).filter(r=> r.date && r.date.slice(0,10) >= weekStart);
      const pts = weekRecords.reduce((a,r)=>a+(r.points||0),0);
      const games = weekRecords.filter(r=>r.type==="game").length;
      const assigns = weekRecords.filter(r=>r.type==="assignment").length;
      return { name:s.name, avatar:s.avatar||"🧑", grade:s.grade||"", pts, games, assigns };
    }).sort((a,b)=>b.pts-a.pts);
  },[students, weekStart]);

  const MEDALS = ["🥇","🥈","🥉"];
  const TROPHIES = ["👑","🌟","🎖️"];

  return (
    <Card>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:14,fontWeight:900,color:T.text}}>🏆 주간 리그</div>
          <div style={{fontSize:11,color:T.textMid,marginTop:2}}>{weekStart} 주차 · 매주 월요일 초기화</div>
        </div>
        <Tag color="yellow">이번 주</Tag>
      </div>
      {ranking.length===0
        ? <div style={{textAlign:"center",padding:28,color:T.textDim,fontSize:12}}>이번 주 기록이 없어요</div>
        : ranking.map((s,i)=>(
          <div key={s.name} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<ranking.length-1?`1px solid ${T.border}`:"none"}}>
            <div style={{width:32,textAlign:"center",fontSize:i<3?22:14,fontWeight:900,color:i<3?undefined:T.textMid}}>
              {i<3?MEDALS[i]:`${i+1}`}
            </div>
            <div style={{fontSize:26}}>{s.avatar}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                <span style={{fontSize:13,fontWeight:800,color:T.text}}>{s.name}</span>
                {i<3&&<span style={{fontSize:16}}>{TROPHIES[i]}</span>}
                <span style={{fontSize:10,color:T.textMid}}>{s.grade}</span>
              </div>
              <div style={{fontSize:10,color:T.textMid}}>🎮 {s.games}게임 · 📝 {s.assigns}과제</div>
            </div>
            <div style={{fontSize:16,fontWeight:900,color:i===0?T.yellow:i===1?T.textMid:i===2?T.orange:T.text}}>
              ⭐{s.pts}
            </div>
          </div>
        ))
      }
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 ② 문장 빈칸 게임 (학생용)
// ══════════════════════════════════════════════════════════════════════════
const SENTENCE_QUESTIONS = [
  { sentence:"I ___ a student.", options:["am","is","are","was"], ans:0, hint:"주어가 I → am" },
  { sentence:"She ___ my best friend.", options:["am","are","is","were"], ans:2, hint:"He/She/It → is" },
  { sentence:"They ___ soccer players.", options:["am","is","are","was"], ans:2, hint:"복수 주어 → are" },
  { sentence:"I ___ pizza yesterday.", options:["eat","eats","ate","eating"], ans:2, hint:"과거 → ate" },
  { sentence:"She ___ to school every day.", options:["go","goes","went","going"], ans:1, hint:"3인칭 단수 현재 → goes" },
  { sentence:"Can you ___ English?", options:["speaks","speaking","spoken","speak"], ans:3, hint:"조동사 + 동사원형" },
  { sentence:"He ___ his homework last night.", options:["do","does","did","done"], ans:2, hint:"과거 did" },
  { sentence:"There ___ a book on the desk.", options:["am","are","is","be"], ans:2, hint:"단수 → is" },
  { sentence:"We ___ in the same class.", options:["am","is","are","was"], ans:2, hint:"We → are" },
  { sentence:"May I ___ your pen?", options:["borrows","borrowed","borrowing","borrow"], ans:3, hint:"조동사 + 동사원형" },
  { sentence:"She ___ not happy today.", options:["am","is","are","were"], ans:1, hint:"She → is" },
  { sentence:"Did you ___ breakfast?", options:["ate","eat","eating","eats"], ans:1, hint:"Did + 동사원형" },
  { sentence:"The dog ___ very cute.", options:["am","is","are","be"], ans:1, hint:"단수 명사 → is" },
  { sentence:"I ___ swim very well.", options:["cans","can to","can","am can"], ans:2, hint:"can + 동사원형" },
  { sentence:"They ___ watching TV now.", options:["am","is","are","was"], ans:2, hint:"복수 → are" },
];

export function SentenceGame({ name, setStudents, onExit }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [showHint, setShowHint] = useState(false);

  const questions = useMemo(()=>[...SENTENCE_QUESTIONS].sort(()=>Math.random()-0.5).slice(0,10),[]);

  if (round >= questions.length) {
    if (typeof setStudents==="function") {
      setStudents(prev=>{
        const s=prev[name]||{};
        return {...prev,[name]:{...s,points:(s.points||0)+score*12,records:[...(s.records||[]),(()=>{const r={type:"game",gameType:"문장 빈칸",score,total:questions.length,points:score*12,date:new Date().toISOString()};return r;})()].slice(-50)}};
      });
    }
    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:"60px 20px",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:14}}>{score>=8?"🎉":score>=5?"👏":"💪"}</div>
        <div style={{fontSize:22,fontWeight:900,color:T.text}}>{score} / {questions.length}</div>
        <Card style={{maxWidth:320,margin:"20px auto 14px",background:T.yellowLight}}>
          <div style={{fontSize:14,fontWeight:800,color:T.text}}>⭐ +{score*12} 포인트</div>
        </Card>
        <Btn v="primary" size="lg" onClick={onExit}>홈으로</Btn>
      </div>
    );
  }

  const q = questions[round];
  const isCorrect = picked === q.ans;
  const answered = picked !== null;

  const pick = (idx) => {
    if (answered) return;
    setPicked(idx);
    if (idx===q.ans) setScore(s=>s+1);
  };

  const next = () => { setPicked(null); setShowHint(false); setRound(r=>r+1); };

  const parts = q.sentence.split("___");

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
        <Btn v="ghost" size="sm" onClick={onExit}>← 종료</Btn>
        <Tag color="purple">{round+1} / {questions.length}</Tag>
        <Tag color="yellow">⭐ {score}</Tag>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,marginBottom:16,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(round/questions.length)*100}%`,background:T.purple,borderRadius:3,transition:"width 0.3s"}} />
      </div>

      {/* 문장 */}
      <Card style={{marginBottom:14,textAlign:"center",padding:"24px 16px",background:T.purpleLight}}>
        <div style={{fontSize:12,color:T.textMid,marginBottom:12,fontWeight:700}}>빈칸에 알맞은 단어를 고르세요</div>
        <div style={{fontSize:20,fontWeight:800,color:T.text,lineHeight:1.8,flexWrap:"wrap",display:"flex",justifyContent:"center",alignItems:"center",gap:4}}>
          <span>{parts[0]}</span>
          <span style={{background:T.purple,color:"white",padding:"2px 14px",borderRadius:8,fontSize:18,fontWeight:900,minWidth:60,display:"inline-block",textAlign:"center"}}>
            {answered ? q.options[q.ans] : "___"}
          </span>
          <span>{parts[1]}</span>
        </div>
        {!answered && (
          <button onClick={()=>setShowHint(!showHint)} style={{marginTop:12,background:"rgba(168,85,247,0.15)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,color:T.purple,cursor:"pointer",fontWeight:700}}>
            {showHint?"힌트 닫기":"💡 힌트 보기"}
          </button>
        )}
        {showHint && <div style={{marginTop:8,fontSize:12,color:T.purple,fontWeight:700}}>💡 {q.hint}</div>}
      </Card>

      {/* 보기 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {q.options.map((opt,idx)=>{
          let bg=T.card, color=T.text, border=T.border;
          if (answered) {
            if (idx===q.ans) { bg=T.green; color="white"; border=T.green; }
            else if (idx===picked&&!isCorrect) { bg=T.red; color="white"; border=T.red; }
          }
          return (
            <button key={idx} onClick={()=>pick(idx)} disabled={answered} style={{padding:"16px 12px",borderRadius:14,border:`2px solid ${border}`,background:bg,color,fontSize:16,fontWeight:800,cursor:answered?"default":"pointer",transition:"all 0.2s"}}>
              {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:900,color:isCorrect?T.green:T.red,marginBottom:8}}>
            {isCorrect?"✓ 정답!":"✗ 오답 — 정답: "+q.options[q.ans]}
          </div>
          <Btn v="primary" size="lg" onClick={next} style={{width:"100%"}}>
            {round<questions.length-1?"다음 문제 →":"결과 보기"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 ③ 학부모 뷰어 모드
// ══════════════════════════════════════════════════════════════════════════
export function ParentViewer({ students }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const studentList = Object.values(students||{}).filter(s=>!search||s.name.includes(search));

  if (selected) {
    const s = selected;
    const records = s.records||[];
    const assignRecords = records.filter(r=>r.type==="assignment");
    const gameRecords = records.filter(r=>r.type==="game");
    const avgAcc = records.filter(r=>r.total>0).length
      ? Math.round(records.filter(r=>r.total>0).reduce((a,r)=>a+(r.score/r.total*100),0)/records.filter(r=>r.total>0).length) : 0;
    const streak = computeStreak(s);
    const earned = getEarnedBadges(s);

    return (
      <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <Btn v="ghost" size="sm" onClick={()=>setSelected(null)}>← 목록</Btn>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>학부모 학습 현황</div>
        </div>

        {/* 학생 카드 */}
        <Card style={{marginBottom:14,background:`linear-gradient(135deg,${T.accent},${T.purple})`,color:"white"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:56,height:56,borderRadius:16,background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{s.avatar||"🧑"}</div>
            <div>
              <div style={{fontSize:20,fontWeight:900}}>{s.name}</div>
              <div style={{fontSize:12,opacity:0.9}}>{s.grade||""} · 가입일 {s.joinDate||"-"}</div>
            </div>
          </div>
        </Card>

        {/* 핵심 지표 */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
          {[
            {icon:"🎯",label:"평균 정답률",val:`${avgAcc}%`,color:T.accent,bg:T.accentLight},
            {icon:"⭐",label:"포인트",val:s.points||0,color:T.yellow,bg:T.yellowLight},
            {icon:"🔥",label:"연속학습",val:`${streak}일`,color:T.red,bg:T.redLight},
          ].map((m,i)=>(
            <Card key={i} style={{padding:"12px 8px",textAlign:"center",background:m.bg}}>
              <div style={{fontSize:20,marginBottom:4}}>{m.icon}</div>
              <div style={{fontSize:18,fontWeight:900,color:m.color}}>{m.val}</div>
              <div style={{fontSize:10,color:T.textMid,fontWeight:700}}>{m.label}</div>
            </Card>
          ))}
        </div>

        {/* 학습 요약 */}
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📊 학습 요약</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:T.textMid}}>📝 완료한 과제</span>
              <strong style={{color:T.text}}>{assignRecords.length}개</strong>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:T.textMid}}>🎮 플레이한 게임</span>
              <strong style={{color:T.text}}>{gameRecords.length}회</strong>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:T.textMid}}>🏅 획득한 뱃지</span>
              <strong style={{color:T.text}}>{earned.length}개</strong>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:T.textMid}}>📅 마지막 학습</span>
              <strong style={{color:T.text}}>{records.slice(-1)[0]?.date?.slice(0,10)||"기록없음"}</strong>
            </div>
          </div>
        </Card>

        {/* 최근 활동 */}
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📋 최근 학습 기록 (최근 10회)</div>
          {records.length===0
            ? <div style={{fontSize:12,color:T.textDim,textAlign:"center",padding:16}}>기록이 없어요</div>
            : records.slice(-10).reverse().map((r,i)=>{
                const acc = r.total>0?Math.round(r.score/r.total*100):0;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<9?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:16}}>{r.type==="game"?"🎮":"📝"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.text}}>{r.gameType||r.setTitle||r.type}</div>
                      <div style={{fontSize:10,color:T.textMid}}>{r.date?.slice(0,10)}</div>
                    </div>
                    {r.total>0 && <div style={{fontSize:12,fontWeight:900,color:acc>=80?T.green:acc>=60?T.yellow:T.red}}>{acc}%</div>}
                  </div>
                );
              })
          }
        </Card>

        {/* 뱃지 */}
        {earned.length>0 && (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>🏅 획득한 뱃지</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {earned.map(b=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:T.yellowLight,borderRadius:10}}>
                  <span style={{fontSize:18}}>{b.icon}</span>
                  <span style={{fontSize:11,fontWeight:700,color:T.text}}>{b.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:18,fontWeight:900,color:T.text,marginBottom:4}}>👨‍👩‍👧 학부모 학습 현황</div>
        <div style={{fontSize:12,color:T.textMid}}>자녀를 선택하면 학습 현황을 볼 수 있어요</div>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 이름 검색" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:11,border:`1.5px solid ${T.border}`,fontSize:13,marginBottom:12,outline:"none"}} />
      {studentList.map(s=>(
        <Card key={s.name} onClick={()=>setSelected(s)} style={{marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:28}}>{s.avatar||"🧑"}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:T.text}}>{s.name}</div>
            <div style={{fontSize:11,color:T.textMid}}>{s.grade||""} · ⭐{s.points||0}p</div>
          </div>
          <div style={{fontSize:18,color:T.textDim}}>›</div>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 ④ 월간 성적표 출력
// ══════════════════════════════════════════════════════════════════════════
export function ReportPrint({ students }) {
  const [selected, setSelected] = useState("all");
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));

  const studentList = Object.values(students||{});
  const targets = selected==="all" ? studentList : studentList.filter(s=>s.name===selected);

  const getMonthStats = (s) => {
    const recs = (s.records||[]).filter(r=>r.date&&r.date.slice(0,7)===month);
    const assigns = recs.filter(r=>r.type==="assignment");
    const games = recs.filter(r=>r.type==="game");
    const acc = recs.filter(r=>r.total>0).length ? Math.round(recs.filter(r=>r.total>0).reduce((a,r)=>a+(r.score/r.total*100),0)/recs.filter(r=>r.total>0).length) : 0;
    const streak = computeStreak(s);
    const earned = getEarnedBadges(s);
    return { assigns:assigns.length, games:games.length, acc, streak, pts:recs.reduce((a,r)=>a+(r.points||0),0), earned };
  };

  const comment = (stats) => {
    if (stats.acc>=90) return "이번 달 정말 훌륭한 성과를 보여주었습니다! 높은 정답률을 유지하며 꾸준히 노력한 결과입니다.";
    if (stats.acc>=75) return "이번 달 좋은 학습 태도를 보여주었습니다. 조금 더 연습하면 더욱 향상될 것입니다.";
    if (stats.acc>=60) return "이번 달 기본기를 다지는 시간이었습니다. 취약한 부분을 집중 복습해 봅시다.";
    return "이번 달 더 많은 연습이 필요합니다. 차근차근 기초부터 다시 시작해 봅시다.";
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:10}}>📋 월간 성적표 출력</div>
        <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{padding:"9px 12px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13}} />
          <select value={selected} onChange={e=>setSelected(e.target.value)} style={{padding:"9px 12px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,flex:1}}>
            <option value="all">전체 학생</option>
            {studentList.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <Btn v="primary" size="md" onClick={()=>window.print()} style={{width:"100%"}}>🖨️ 인쇄 / PDF 저장</Btn>
      </div>

      {targets.map(s=>{
        const st = getMonthStats(s);
        return (
          <div key={s.name} style={{background:"white",padding:24,borderRadius:12,marginBottom:20,border:`1px solid ${T.border}`,pageBreakAfter:"always",fontFamily:"serif"}}>
            <div style={{textAlign:"center",borderBottom:"2px solid #333",paddingBottom:14,marginBottom:18}}>
              <div style={{fontSize:22,fontWeight:900}}>Angela's English Academy</div>
              <div style={{fontSize:14,color:"#555",marginTop:4}}>{month} 월간 학습 성적표</div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,fontSize:13}}>
              <span>이름: <strong>{s.name}</strong></span>
              <span>학년: <strong>{s.grade||"-"}</strong></span>
              <span>발행일: <strong>{new Date().toISOString().slice(0,10)}</strong></span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16,fontSize:13}}>
              <thead>
                <tr style={{background:"#f0f7ff"}}>
                  {["항목","이번 달 수치","평가"].map(h=><th key={h} style={{padding:"8px 10px",border:"1px solid #dce8ff",textAlign:"center"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ["과제 완료 수",`${st.assigns}개`,st.assigns>=5?"우수 ★★★":st.assigns>=3?"양호 ★★":"기초 ★"],
                  ["게임 참여 횟수",`${st.games}회`,st.games>=10?"우수 ★★★":st.games>=5?"양호 ★★":"기초 ★"],
                  ["평균 정답률",`${st.acc}%`,st.acc>=85?"우수 ★★★":st.acc>=70?"양호 ★★":"기초 ★"],
                  ["연속 학습일",`${st.streak}일`,st.streak>=7?"우수 ★★★":st.streak>=3?"양호 ★★":"기초 ★"],
                  ["획득 포인트",`${st.pts}점`,""],
                  ["획득 뱃지",`${st.earned.length}개`,st.earned.length>=5?"우수 ★★★":st.earned.length>=2?"양호 ★★":"기초 ★"],
                ].map(([label,val,grade],i)=>(
                  <tr key={i}><td style={{padding:"7px 10px",border:"1px solid #dce8ff"}}>{label}</td><td style={{padding:"7px 10px",border:"1px solid #dce8ff",textAlign:"center",fontWeight:700}}>{val}</td><td style={{padding:"7px 10px",border:"1px solid #dce8ff",textAlign:"center",color:"#4f8ef7"}}>{grade}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{background:"#f0f7ff",padding:"12px 14px",borderRadius:8,marginBottom:14}}>
              <div style={{fontWeight:700,marginBottom:4,fontSize:13}}>📝 종합 평가</div>
              <div style={{fontSize:12,lineHeight:1.8,color:"#555"}}>{comment(st)}</div>
            </div>
            {st.earned.length>0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>🏅 획득 뱃지</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {st.earned.map(b=><span key={b.id} style={{padding:"3px 8px",background:"#fff7ed",borderRadius:6,fontSize:12}}>{b.icon} {b.name}</span>)}
                </div>
              </div>
            )}
            <div style={{borderTop:"1px solid #dce8ff",paddingTop:10,display:"flex",justifyContent:"space-between",fontSize:12,color:"#888"}}>
              <span>Angela's English Academy</span>
              <span>담임교사: Angela 선생님</span>
              <span>학부모 확인: ___________</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 ⑤ 수업 일정 & 알림
// ══════════════════════════════════════════════════════════════════════════
export function ScheduleManager({ schedules, setSchedules }) {
  const [form, setForm] = useState({ title:"", date:"", time:"", desc:"", repeat:"none" });
  const DAYS = ["일","월","화","수","목","금","토"];

  const add = () => {
    if (!form.title.trim()||!form.date) return;
    setSchedules(prev=>[...(prev||[]).filter(s=>!(s.date===form.date&&s.title===form.title)), {id:uid(),...form,createdAt:new Date().toISOString()}].sort((a,b)=>a.date.localeCompare(b.date)));
    setForm({title:"",date:"",time:"",desc:"",repeat:"none"});
  };

  const del = (id) => setSchedules(prev=>(prev||[]).filter(s=>s.id!==id));

  const today = new Date().toISOString().slice(0,10);
  const upcoming = (schedules||[]).filter(s=>s.date>=today);
  const past = (schedules||[]).filter(s=>s.date<today);

  return (
    <div>
      <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:4}}>📅 수업 일정 관리</div>
      <div style={{fontSize:11,color:T.textMid,marginBottom:14}}>일정을 등록하면 학생 앱에 D-day로 표시됩니다</div>

      <Card style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>+ 일정 추가</div>
        <Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 월요일 수업, 중간고사 대비" style={{marginBottom:8}} />
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{flex:1,padding:"9px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13}} />
          <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{flex:1,padding:"9px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13}} />
        </div>
        <textarea value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="준비물, 내용 등 (선택)" rows={2} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,resize:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:8}} />
        <Btn v="primary" size="md" onClick={add} disabled={!form.title.trim()||!form.date} style={{width:"100%"}}>+ 일정 추가</Btn>
      </Card>

      {upcoming.length>0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:8}}>📅 예정 일정</div>
          {upcoming.map(s=>{
            const sDate = new Date(s.date);
            const diff = Math.ceil((sDate-new Date())/(1000*60*60*24));
            const isToday = s.date===today;
            return (
              <Card key={s.id} style={{marginBottom:8,background:isToday?T.yellowLight:T.card,border:isToday?`1.5px solid ${T.yellow}`:undefined}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{textAlign:"center",background:T.accentLight,borderRadius:10,padding:"6px 8px",flexShrink:0,minWidth:44}}>
                    <div style={{fontSize:11,color:T.textMid,fontWeight:700}}>{DAYS[sDate.getDay()]}요일</div>
                    <div style={{fontSize:18,fontWeight:900,color:T.accent}}>{sDate.getDate()}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:800,color:T.text}}>{s.title}</span>
                      {isToday && <Tag color="yellow">오늘!</Tag>}
                      {!isToday && diff<=3 && <Tag color="red">D-{diff}</Tag>}
                      {!isToday && diff>3 && <Tag color="blue">D-{diff}</Tag>}
                    </div>
                    {s.time && <div style={{fontSize:11,color:T.textMid}}>⏰ {s.time}</div>}
                    {s.desc && <div style={{fontSize:11,color:T.textMid,marginTop:2}}>{s.desc}</div>}
                  </div>
                  <button onClick={()=>del(s.id)} style={{width:24,height:24,borderRadius:7,border:"none",background:T.redLight,color:T.red,fontSize:11,cursor:"pointer",fontWeight:900}}>✕</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {past.length>0 && (
        <div>
          <div style={{fontSize:13,fontWeight:800,color:T.textMid,marginBottom:8}}>지난 일정 ({past.length}개)</div>
          {past.slice(-3).reverse().map(s=>(
            <Card key={s.id} style={{marginBottom:6,opacity:0.6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text}}>{s.title}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:11,color:T.textDim}}>{s.date}</span>
                  <button onClick={()=>del(s.id)} style={{width:20,height:20,borderRadius:6,border:"none",background:T.redLight,color:T.red,fontSize:10,cursor:"pointer",fontWeight:900}}>✕</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// 학생용 일정 배너
export function ScheduleBanner({ schedules }) {
  const today = new Date().toISOString().slice(0,10);
  const upcoming = (schedules||[]).filter(s=>s.date>=today).slice(0,2);
  if (!upcoming.length) return null;

  return (
    <div style={{padding:"10px 14px",background:T.yellowLight,borderBottom:`2px solid ${T.yellow}30`}}>
      {upcoming.map((s,i)=>{
        const diff = Math.ceil((new Date(s.date)-new Date())/(1000*60*60*24));
        const isToday = s.date===today;
        return (
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<upcoming.length-1?4:0}}>
            <span style={{fontSize:14}}>📅</span>
            <span style={{fontSize:12,fontWeight:700,color:T.text}}>{s.title}</span>
            <span style={{fontSize:11,padding:"1px 7px",borderRadius:7,background:isToday?T.yellow:T.accent,color:"white",fontWeight:800}}>
              {isToday?"오늘!":"D-"+diff}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  학생별 상세 리포트 (선생님용)
// ══════════════════════════════════════════════════════════════════════════
export function StudentDetailReport({ student, onBack }) {
  if (!student) return null;
  const records = student.records || [];
  const assignRecs = records.filter(r=>r.type==="assignment");
  const gameRecs   = records.filter(r=>r.type==="game");

  // 과제별 정답률
  const bySet = {};
  assignRecs.forEach(r=>{
    const k = r.setTitle||r.bankId||"기타";
    if(!bySet[k]) bySet[k]={correct:0,total:0,count:0};
    bySet[k].correct+=r.score||0;
    bySet[k].total+=r.total||0;
    bySet[k].count++;
  });

  // 게임별 통계
  const byGame = {};
  gameRecs.forEach(r=>{
    const k=r.gameType||"기타";
    if(!byGame[k]) byGame[k]={correct:0,total:0,count:0};
    byGame[k].correct+=r.score||0;
    byGame[k].total+=r.total||0;
    byGame[k].count++;
  });

  // 최근 30일 일별 활동
  const daily = {};
  records.forEach(r=>{
    const d=r.date?.slice(0,10);
    if(d) daily[d]=(daily[d]||0)+1;
  });
  const last14 = Array.from({length:14},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-13+i);
    const key=d.toISOString().slice(0,10);
    return {date:key,day:["일","월","화","수","목","금","토"][d.getDay()],count:daily[key]||0};
  });

  const totalAcc = records.filter(r=>r.total>0).length
    ? Math.round(records.filter(r=>r.total>0).reduce((a,r)=>a+(r.score/r.total*100),0)/records.filter(r=>r.total>0).length) : 0;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:13,fontWeight:700,cursor:"pointer",padding:"4px 8px",borderRadius:8}}>← 뒤로</button>
        <div style={{fontSize:26}}>{student.avatar||"🧑"}</div>
        <div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>{student.name} 상세 리포트</div>
          <div style={{fontSize:11,color:T.textMid}}>{student.grade||""} · 가입일 {student.joinDate||"-"}</div>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[
          {label:"평균 정답률",val:`${totalAcc}%`,bg:T.accentLight,c:T.accent},
          {label:"총 포인트",val:`${student.points||0}p`,bg:T.yellowLight,c:T.yellow},
          {label:"전체 활동",val:`${records.length}회`,bg:T.greenLight,c:T.green},
        ].map((m,i)=>(
          <div key={i} style={{background:m.bg,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:900,color:m.c}}>{m.val}</div>
            <div style={{fontSize:10,color:T.textMid,fontWeight:700,marginTop:2}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* 최근 2주 활동 히트맵 */}
      <div style={{background:T.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📅 최근 2주 활동</div>
        <div style={{display:"flex",gap:4}}>
          {last14.map((d,i)=>(
            <div key={i} style={{flex:1,textAlign:"center"}}>
              <div style={{height:32,borderRadius:6,background:d.count===0?T.bg:d.count===1?T.accentLight:d.count<=3?T.accent:"#1d4ed8",marginBottom:3}} title={`${d.date}: ${d.count}회`}/>
              <div style={{fontSize:9,color:T.textDim}}>{d.day}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginTop:8,fontSize:10,color:T.textMid,alignItems:"center"}}>
          <span>없음</span>
          {[T.bg,T.accentLight,T.accent,"#1d4ed8"].map((c,i)=>(
            <div key={i} style={{width:12,height:12,borderRadius:3,background:c}}/>
          ))}
          <span>많음</span>
        </div>
      </div>

      {/* 과제별 성적 */}
      {Object.entries(bySet).length>0&&(
        <div style={{background:T.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📝 과제별 정답률</div>
          {Object.entries(bySet).sort((a,b)=>a[1].correct/a[1].total-b[1].correct/b[1].total).map(([k,v])=>{
            const pct=v.total>0?Math.round(v.correct/v.total*100):0;
            return (
              <div key={k} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.text,maxWidth:"70%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:900,color:pct>=80?T.green:pct>=60?T.yellow:T.red}}>{pct}% ({v.count}회)</span>
                </div>
                <div style={{height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:pct>=80?T.green:pct>=60?T.yellow:T.red,borderRadius:3}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 게임별 통계 */}
      {Object.entries(byGame).length>0&&(
        <div style={{background:T.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>🎮 게임별 참여</div>
          {Object.entries(byGame).sort((a,b)=>b[1].count-a[1].count).map(([k,v])=>{
            const pct=v.total>0?Math.round(v.correct/v.total*100):0;
            return (
              <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:12,fontWeight:700,color:T.text}}>{k}</span>
                <div style={{display:"flex",gap:8,fontSize:11}}>
                  <span style={{color:T.textMid}}>{v.count}회</span>
                  {v.total>0&&<span style={{color:pct>=80?T.green:pct>=60?T.yellow:T.red,fontWeight:800}}>{pct}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 최근 10개 기록 */}
      <div style={{background:T.card,borderRadius:14,padding:14,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:10}}>📋 최근 학습 기록</div>
        {records.length===0
          ? <div style={{textAlign:"center",fontSize:12,color:T.textDim,padding:16}}>기록이 없어요</div>
          : records.slice(-10).reverse().map((r,i)=>{
              const pct=r.total>0?Math.round(r.score/r.total*100):null;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<9?`1px solid ${T.border}`:"none"}}>
                  <span style={{fontSize:16}}>{r.type==="game"?"🎮":"📝"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.gameType||r.setTitle||r.type}</div>
                    <div style={{fontSize:10,color:T.textMid}}>{r.date?.slice(0,10)}</div>
                  </div>
                  {pct!==null&&<span style={{fontSize:12,fontWeight:900,color:pct>=80?T.green:pct>=60?T.yellow:T.red,flexShrink:0}}>{pct}%</span>}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  출석 & 수업 참여 기록 (선생님용)
// ══════════════════════════════════════════════════════════════════════════
export function AttendanceManager({ students, attendance, setAttendance }) {
  const [selDate, setSelDate] = useState(new Date().toISOString().slice(0,10));
  const [view, setView] = useState("today"); // today | history | stats

  const studentList = Object.values(students||{});
  const today = new Date().toISOString().slice(0,10);

  // 오늘 출석 데이터
  const todayData = attendance[selDate] || {};

  const mark = (name, status) => {
    setAttendance(prev=>({
      ...prev,
      [selDate]: { ...(prev[selDate]||{}), [name]: status }
    }));
  };

  const markAll = (status) => {
    const all = {};
    studentList.forEach(s=>{ all[s.name]=status; });
    setAttendance(prev=>({...prev,[selDate]:all}));
  };

  // 학생별 출석 통계 계산
  const getStats = (name) => {
    const dates = Object.keys(attendance);
    const present = dates.filter(d=>attendance[d]?.[name]==="present").length;
    const absent  = dates.filter(d=>attendance[d]?.[name]==="absent").length;
    const late    = dates.filter(d=>attendance[d]?.[name]==="late").length;
    const total   = present+absent+late;
    return {present,absent,late,total,rate:total>0?Math.round(present/total*100):0};
  };

  const STATUS = {
    present: {label:"출석",color:T.green,bg:T.greenLight,emoji:"✅"},
    late:    {label:"지각",color:T.yellow,bg:T.yellowLight,emoji:"⏰"},
    absent:  {label:"결석",color:T.red,bg:T.redLight,emoji:"❌"},
  };

  return (
    <div>
      <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:4}}>🔔 출석 & 수업 기록</div>
      <div style={{fontSize:11,color:T.textMid,marginBottom:14}}>날짜별 출석을 기록하고 통계를 확인하세요</div>

      {/* 탭 */}
      <div style={{display:"flex",gap:6,marginBottom:14,background:T.card,padding:5,borderRadius:12,boxShadow:T.shadow}}>
        {[{id:"today",label:"📋 출석 체크"},{id:"history",label:"📅 기록 보기"},{id:"stats",label:"📊 통계"}].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:"9px 6px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:800,background:view===t.id?T.accent:"transparent",color:view===t.id?"white":T.textMid}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 출석 체크 탭 */}
      {view==="today"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
            <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
              style={{padding:"8px 10px",borderRadius:9,border:`1.5px solid ${T.border}`,fontSize:13,flex:1}}/>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>markAll("present")} style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${T.green}`,background:T.greenLight,color:T.green,fontSize:11,fontWeight:700,cursor:"pointer"}}>전체 출석</button>
              <button onClick={()=>markAll("absent")} style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${T.red}`,background:T.redLight,color:T.red,fontSize:11,fontWeight:700,cursor:"pointer"}}>전체 결석</button>
            </div>
          </div>

          {studentList.length===0
            ? <div style={{padding:32,textAlign:"center",color:T.textDim,fontSize:12}}>등록된 학생이 없어요</div>
            : studentList.map(s=>{
                const cur = todayData[s.name];
                return (
                  <div key={s.name} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontSize:22,flexShrink:0}}>{s.avatar||"🧑"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:T.text}}>{s.name}</div>
                      <div style={{fontSize:10,color:T.textMid}}>{s.grade||""}</div>
                    </div>
                    <div style={{display:"flex",gap:5}}>
                      {Object.entries(STATUS).map(([k,v])=>(
                        <button key={k} onClick={()=>mark(s.name,k)} style={{
                          padding:"5px 8px",borderRadius:8,border:`1.5px solid ${cur===k?v.color:T.border}`,
                          background:cur===k?v.bg:T.card,color:cur===k?v.color:T.textMid,
                          fontSize:11,fontWeight:800,cursor:"pointer",transition:"all 0.15s"
                        }}>{v.emoji}</button>
                      ))}
                    </div>
                  </div>
                );
              })
          }

          {/* 요약 */}
          {studentList.length>0&&(
            <div style={{display:"flex",gap:10,marginTop:12,padding:"10px 14px",background:T.bg,borderRadius:12}}>
              {Object.entries(STATUS).map(([k,v])=>{
                const cnt=Object.values(todayData).filter(s=>s===k).length;
                return <div key={k} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:16,fontWeight:900,color:v.color}}>{cnt}</div>
                  <div style={{fontSize:10,color:T.textMid,fontWeight:700}}>{v.label}</div>
                </div>;
              })}
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:900,color:T.textMid}}>{studentList.length-Object.values(todayData).length}</div>
                <div style={{fontSize:10,color:T.textMid,fontWeight:700}}>미처리</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 기록 탭 */}
      {view==="history"&&(
        <div>
          {Object.keys(attendance).length===0
            ? <div style={{padding:32,textAlign:"center",color:T.textDim,fontSize:12}}>출석 기록이 없어요</div>
            : Object.keys(attendance).sort().reverse().slice(0,20).map(date=>{
                const dayData=attendance[date];
                const p=Object.values(dayData).filter(s=>s==="present").length;
                const a=Object.values(dayData).filter(s=>s==="absent").length;
                const l=Object.values(dayData).filter(s=>s==="late").length;
                return (
                  <div key={date} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:T.text}}>{date}</div>
                      <div style={{fontSize:11,color:T.textMid,marginTop:2}}>
                        ✅{p}명 ❌{a}명 ⏰{l}명
                      </div>
                    </div>
                    <div style={{fontSize:14,fontWeight:900,color:T.green}}>
                      {p+a+l>0?Math.round(p/(p+a+l)*100):0}%
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* 통계 탭 */}
      {view==="stats"&&(
        <div>
          {studentList.length===0
            ? <div style={{padding:32,textAlign:"center",color:T.textDim,fontSize:12}}>학생이 없어요</div>
            : studentList.map(s=>{
                const st=getStats(s.name);
                return (
                  <div key={s.name} style={{background:T.card,borderRadius:12,padding:12,marginBottom:10,border:`1px solid ${T.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{fontSize:22}}>{s.avatar||"🧑"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:800,color:T.text}}>{s.name}</div>
                        <div style={{fontSize:10,color:T.textMid}}>{st.total}회 수업 중</div>
                      </div>
                      <div style={{fontSize:18,fontWeight:900,color:st.rate>=90?T.green:st.rate>=70?T.yellow:T.red}}>{st.rate}%</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {[
                        {label:"출석",val:st.present,c:T.green,bg:T.greenLight},
                        {label:"지각",val:st.late,c:T.yellow,bg:T.yellowLight},
                        {label:"결석",val:st.absent,c:T.red,bg:T.redLight},
                      ].map((m,i)=>(
                        <div key={i} style={{flex:1,textAlign:"center",background:m.bg,borderRadius:8,padding:"6px 4px"}}>
                          <div style={{fontSize:15,fontWeight:900,color:m.c}}>{m.val}</div>
                          <div style={{fontSize:10,color:T.textMid,fontWeight:700}}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}


export function StudentDetailModal({ student, stats, onClose }) {
  if (!student) return null;
  const lvl = LEVEL_INFO[stats.level];

  const skillData = [
    { skill: "어휘력", score: stats.accuracy },
    { skill: "게임실력", score: stats.avgGameScore },
    { skill: "꾸준함", score: Math.min(100, stats.streak * 10) },
    { skill: "과제수행", score: Math.min(100, stats.totalAssign * 15) },
    { skill: "참여도", score: Math.min(100, (stats.totalGames + stats.totalAssign) * 8) },
  ];

  // 최근 10회 점수 추이
  const recent = (student.records || []).slice(-10).map((r, i) => ({
    n: `${i + 1}회`,
    점수: r.total > 0 ? Math.round((r.score || 0) / r.total * 100) : 0
  }));

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 200
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: 22, maxWidth: 600, width: "100%",
        maxHeight: "90vh", overflowY: "auto", boxShadow: T.shadowLg
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
          padding: "20px 22px", color: "white", borderRadius: "22px 22px 0 0", position: "relative"
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 10,
            background: "rgba(255,255,255,0.25)", color: "white", border: "none",
            fontSize: 16, cursor: "pointer", fontWeight: 700
          }}>✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34
            }}>{student.avatar || "🧑"}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{student.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>{student.grade || "학년 미정"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>{lvl.icon} {lvl.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>⭐ {student.points || 0}p</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
            <div style={{ background: T.accentLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accent }}>{stats.accuracy}%</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>정답률</div>
            </div>
            <div style={{ background: T.greenLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.green }}>{stats.totalAssign}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>완료 과제</div>
            </div>
            <div style={{ background: T.yellowLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.yellow }}>{stats.totalGames}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>게임 횟수</div>
            </div>
            <div style={{ background: T.pinkLight, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.pink }}>🔥{stats.streak}</div>
              <div style={{ fontSize: 10, color: T.textMid, fontWeight: 600 }}>연속학습</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>📊 영역별 능력</div>
            <div style={{ background: T.bg, borderRadius: 12, padding: 8, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={skillData}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: T.textMid, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: T.textDim }} />
                  <Radar dataKey="score" stroke={T.accent} fill={T.accent} fillOpacity={0.4} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {recent.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>📈 최근 점수 추이</div>
              <div style={{ background: T.bg, borderRadius: 12, padding: 8, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recent}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="n" tick={{ fontSize: 10, fill: T.textMid }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T.textMid }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Area type="monotone" dataKey="점수" stroke={T.accent} strokeWidth={2.5} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>🎮 게임별 참여 횟수</div>
            {Object.keys(stats.gameCount).length === 0
              ? <div style={{ fontSize: 12, color: T.textDim, padding: 14, textAlign: "center", background: T.bg, borderRadius: 12 }}>아직 게임 기록이 없어요</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(stats.gameCount).map(([g, c]) => (
                    <div key={g} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bg, borderRadius: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{g}</span>
                      <Tag color="blue">{c}회</Tag>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 통계 대시보드 메인 ────────────────────────────────────────────────────
export function StatsDashboard({ students, onSelectStudent }) {
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("points");
  const [selected, setSelected] = useState(null);

  const studentList = Object.values(students || {});

  // 각 학생별 통계 계산
  const studentsWithStats = useMemo(() =>
    studentList.map(s => ({ ...s, stats: computeStudentStats(s) })),
    [students]
  );

  // 전체 통계
  const overall = useMemo(() => {
    const total = studentsWithStats.length;
    const activeToday = studentsWithStats.filter(s => s.stats.lastActive === "오늘").length;
    const avgAcc = total > 0 ? Math.round(studentsWithStats.reduce((a, s) => a + s.stats.accuracy, 0) / total) : 0;
    const totalPoints = studentsWithStats.reduce((a, s) => a + (s.points || 0), 0);
    const totalGames = studentsWithStats.reduce((a, s) => a + s.stats.totalGames, 0);
    const totalAssign = studentsWithStats.reduce((a, s) => a + s.stats.totalAssign, 0);
    return { total, activeToday, avgAcc, totalPoints, totalGames, totalAssign };
  }, [studentsWithStats]);

  // 레벨 분포
  const levelDist = useMemo(() => [
    { name: "상위 (A)", value: studentsWithStats.filter(s => s.stats.level === "A").length, color: T.green },
    { name: "중위 (B)", value: studentsWithStats.filter(s => s.stats.level === "B").length, color: T.accent },
    { name: "기초 (C)", value: studentsWithStats.filter(s => s.stats.level === "C").length, color: T.orange },
  ], [studentsWithStats]);

  // 주간 활동
  const weekly = useMemo(() => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = d.toISOString().slice(0, 10);
      let assign = 0, game = 0;
      studentsWithStats.forEach(s => {
        (s.records || []).forEach(r => {
          if (r.date?.slice(0, 10) === dStr) {
            if (r.type === "game") game++;
            else if (r.type === "assignment") assign++;
          }
        });
      });
      return { day: days[d.getDay()], 과제: assign, 게임: game };
    });
    return result;
  }, [studentsWithStats]);

  // 카테고리별 정답률
  const catData = useMemo(() => {
    const cats = {};
    studentsWithStats.forEach(s => {
      (s.records || []).forEach(r => {
        if (r.category && r.total > 0) {
          cats[r.category] = cats[r.category] || { correct: 0, total: 0 };
          cats[r.category].correct += r.score || 0;
          cats[r.category].total += r.total || 0;
        }
      });
    });
    return Object.entries(cats).map(([k, v]) => ({
      category: k,
      정답률: v.total > 0 ? Math.round(v.correct / v.total * 100) : 0
    }));
  }, [studentsWithStats]);

  // 게임 인기도
  const gameData = useMemo(() => {
    const games = {};
    studentsWithStats.forEach(s => {
      (s.records || []).forEach(r => {
        if (r.type === "game" && r.gameType) {
          games[r.gameType] = (games[r.gameType] || 0) + 1;
        }
      });
    });
    const colors = [T.accent, T.green, T.yellow, T.pink, T.purple];
    return Object.entries(games).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [studentsWithStats]);

  // 관심 학생 찾기
  const attention = useMemo(() => {
    const inactive = studentsWithStats.filter(s => {
      const la = s.stats.lastActive;
      return la !== "오늘" && la !== "어제" && la !== "신규" && s.records?.length > 0;
    });
    const lowAcc = studentsWithStats.filter(s => s.stats.accuracy > 0 && s.stats.accuracy < 60);
    return { inactive, lowAcc };
  }, [studentsWithStats]);

  // 학생 목록 필터링
  const filtered = useMemo(() => {
    let list = studentsWithStats;
    if (filter !== "all") list = list.filter(s => s.stats.level === filter);
    if (search) list = list.filter(s => s.name.includes(search));
    return [...list].sort((a, b) => {
      if (sortBy === "points") return (b.points || 0) - (a.points || 0);
      if (sortBy === "accuracy") return b.stats.accuracy - a.stats.accuracy;
      if (sortBy === "streak") return b.stats.streak - a.stats.streak;
      return 0;
    });
  }, [studentsWithStats, filter, search, sortBy]);

  // 빈 데이터일 때
  if (studentList.length === 0) {
    return (
      <Card style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>아직 학생 데이터가 없어요</div>
        <div style={{ fontSize: 12, color: T.textMid }}>학생들이 로그인해서 게임이나 과제를 풀면<br/>여기에 자동으로 통계가 쌓입니다!</div>
      </Card>
    );
  }

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: T.card, padding: 6, borderRadius: 12, boxShadow: T.shadow }}>
        {[
          { id: "overview", label: "📈 전체 현황" },
          { id: "students", label: "👥 학생 목록" },
          { id: "ranking", label: "🏆 랭킹" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 9, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 800,
            background: tab === t.id ? T.accent : "transparent",
            color: tab === t.id ? "white" : T.textMid,
            transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      {/* 전체 현황 탭 */}
      {tab === "overview" && (
        <div>
          {/* 핵심 지표 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { icon: "👥", label: "전체 학생", val: overall.total, sub: `오늘 ${overall.activeToday}명 활동`, c: T.accent, bg: T.accentLight },
              { icon: "🎯", label: "평균 정답률", val: `${overall.avgAcc}%`, sub: "전체 합산", c: T.green, bg: T.greenLight },
              { icon: "🎮", label: "총 게임", val: overall.totalGames, sub: "누적 플레이", c: T.yellow, bg: T.yellowLight },
              { icon: "⭐", label: "누적 포인트", val: overall.totalPoints, sub: "학원 전체", c: T.pink, bg: T.pinkLight },
            ].map((s, i) => (
              <Card key={i} style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: T.textMid, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.text, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: s.c, fontWeight: 700, marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 주간 활동 + 레벨 분포 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📅 주간 활동 추이</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekly}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.pink} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={T.pink} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: T.textMid }} />
                    <YAxis tick={{ fontSize: 11, fill: T.textMid }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                    <Area type="monotone" dataKey="과제" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" />
                    <Area type="monotone" dataKey="게임" stroke={T.pink} strokeWidth={2.5} fill="url(#gB)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>🏆 레벨 분포</div>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={levelDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3}>
                      {levelDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {levelDist.map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />
                      <span style={{ color: T.textMid, fontWeight: 600 }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: T.text }}>{d.value}명</span>
                  </div>
                ))}
              </div>
            </Card>

            {gameData.length > 0 ? (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>🎮 게임별 플레이</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gameData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.textMid }} />
                      <YAxis tick={{ fontSize: 10, fill: T.textMid }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {gameData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎮</div>
                <div style={{ fontSize: 12, color: T.textMid }}>아직 게임 데이터가 없어요</div>
              </Card>
            )}
          </div>

          {catData.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📚 카테고리별 정답률</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: T.textMid }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: T.text, fontWeight: 600 }} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12 }} />
                    <Bar dataKey="정답률" radius={[0, 6, 6, 0]}>
                      {catData.map((d, i) => (
                        <Cell key={i} fill={d.정답률 >= 85 ? T.green : d.정답률 >= 70 ? T.accent : T.orange} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* 관심 학생 알림 */}
          {(attention.inactive.length > 0 || attention.lowAcc.length > 0) && (
            <Card style={{ background: T.yellowLight, border: `1.5px dashed ${T.yellow}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 22 }}>💡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>관심이 필요한 학생</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7 }}>
                    {attention.inactive.length > 0 && (
                      <div>
                        🕐 며칠째 활동 없음: {attention.inactive.map(s => (
                          <strong key={s.name} style={{ color: T.red }}>{s.name}({s.stats.lastActive}) </strong>
                        ))}
                      </div>
                    )}
                    {attention.lowAcc.length > 0 && (
                      <div>
                        📉 정답률 낮음 (60% 미만): {attention.lowAcc.map(s => (
                          <strong key={s.name} style={{ color: T.orange }}>{s.name}({s.stats.accuracy}%) </strong>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 학생 목록 탭 */}
      {tab === "students" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>👨‍🎓 학생 진도 현황 ({filtered.length})</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 이름 검색" style={{
                padding: "7px 11px", borderRadius: 9, border: `1.5px solid ${T.border}`,
                fontSize: 12, outline: "none", minWidth: 140
              }} />
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: T.textMid, fontWeight: 700 }}>레벨</span>
              {[
                { id: "all", label: "전체" }, { id: "A", label: "🥇 상위" },
                { id: "B", label: "🥈 중위" }, { id: "C", label: "🥉 기초" }
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: filter === f.id ? T.accent : T.accentLight,
                  color: filter === f.id ? "white" : T.accent, border: "none", cursor: "pointer"
                }}>{f.label}</button>
              ))}
              <span style={{ fontSize: 10, color: T.textMid, fontWeight: 700, marginLeft: 6 }}>정렬</span>
              {[
                { id: "points", label: "포인트" },
                { id: "accuracy", label: "정답률" },
                { id: "streak", label: "연속학습" }
              ].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                  padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: sortBy === s.id ? T.purple : T.purpleLight,
                  color: sortBy === s.id ? "white" : T.purple, border: "none", cursor: "pointer"
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div>
            {filtered.map((s, i) => {
              const lvl = LEVEL_INFO[s.stats.level];
              return (
                <div key={s.name} onClick={() => setSelected(s)} style={{
                  padding: "12px 14px",
                  borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                  display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, background: lvl.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
                  }}>{s.avatar || "🧑"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.name}</span>
                      <Tag color={s.stats.level === "A" ? "green" : s.stats.level === "B" ? "blue" : "orange"}>{lvl.icon} {lvl.label}</Tag>
                      {s.stats.lastActive === "오늘" && <Tag color="green">● 활동중</Tag>}
                      {s.stats.streak >= 5 && <Tag color="pink">🔥{s.stats.streak}일</Tag>}
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 10, color: T.textMid, flexWrap: "wrap" }}>
                      <span>📝 과제 {s.stats.totalAssign}</span>
                      <span>🎮 게임 {s.stats.totalGames}</span>
                      <span>🎯 {s.stats.accuracy}%</span>
                      <span>⭐ {s.points || 0}p</span>
                      <span style={{ color: s.stats.lastActive === "오늘" ? T.green : T.textDim }}>· {s.stats.lastActive}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: T.textDim }}>›</div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 12 }}>검색 결과가 없어요</div>
            )}
          </div>
        </Card>
      )}

      {/* 랭킹 탭 */}
      {tab === "ranking" && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 900, color: T.text, marginBottom: 12 }}>🏆 포인트 랭킹</div>
          {studentsWithStats.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: T.textDim, fontSize: 12 }}>데이터가 없어요</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...studentsWithStats]
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 10)
                .map((s, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const bgs = [T.yellowLight, T.accentLight, T.orangeLight];
                  return (
                    <div key={s.name} onClick={() => setSelected(s)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      background: i < 3 ? bgs[i] : T.bg, borderRadius: 12, cursor: "pointer"
                    }}>
                      <div style={{ fontSize: 22, width: 32, textAlign: "center" }}>{medals[i] || `${i + 1}`}</div>
                      <div style={{ fontSize: 24 }}>{s.avatar || "🧑"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: T.textMid }}>정답률 {s.stats.accuracy}% · 게임 {s.stats.totalGames}회</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>⭐ {(s.points || 0).toLocaleString()}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      <StudentDetailModal
        student={selected}
        stats={selected ? computeStudentStats(selected) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//   문제은행 / 출제 / 시험지
// ══════════════════════════════════════════════════════════════════════════
