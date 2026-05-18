"use client";
import { useState } from "react";
import { supabase, isSupabaseReady, testConnection } from "./supabaseClient";

// ══════════════════════════════════════════════════════════════════════════
//   Supabase 마이그레이션 도구
//   백업 JSON 파일을 그대로 Supabase로 업로드합니다.
//   기존 localStorage는 건드리지 않으므로 안전망 역할을 합니다.
// ══════════════════════════════════════════════════════════════════════════

const T = {
  bg: "#f0f7ff", card: "#ffffff", border: "#dce8ff",
  accent: "#4f8ef7", accentLight: "#e8f0ff",
  green: "#22c55e", greenLight: "#dcfce7",
  red: "#ef4444", redLight: "#fee2e2",
  yellow: "#f59e0b", yellowLight: "#fef3c7",
  purple: "#a855f7", purpleLight: "#f3e8ff",
  text: "#1e293b", textMid: "#64748b", textDim: "#94a3b8",
  shadow: "0 4px 16px rgba(79,142,247,0.12)",
};

export function SupabaseMigration() {
  const [status, setStatus] = useState("idle"); // idle | testing | uploading | done | error
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState(null);
  const [connectionMsg, setConnectionMsg] = useState("");

  const addLog = (msg) => setLog(prev => [...prev, { msg, time: new Date().toLocaleTimeString() }]);

  // ── 연결 테스트 ────────────────────────────────────────────────────────
  const handleTest = async () => {
    setStatus("testing");
    setConnectionMsg("연결 확인 중...");
    const result = await testConnection();
    setConnectionMsg(result.message);
    setStatus(result.ok ? "idle" : "error");
  };

  // ── 현재 Supabase 데이터 수 확인 ──────────────────────────────────────
  const handleCheckCounts = async () => {
    if (!isSupabaseReady()) {
      setConnectionMsg("❌ Supabase가 연결되지 않았어요");
      return;
    }
    setStatus("testing");
    try {
      const tables = ["students", "question_banks", "exams", "assignments",
                      "groups", "notices", "goals", "schedules", "attendance", "settings"];
      const results = {};
      for (const t of tables) {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        results[t] = count || 0;
      }
      setCounts(results);
      setStatus("idle");
    } catch (e) {
      setConnectionMsg(`❌ 확인 실패: ${e.message}`);
      setStatus("error");
    }
  };

  // ── 백업 JSON 파일 업로드 ──────────────────────────────────────────────
  const handleMigrate = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupabaseReady()) {
      alert("❌ Supabase가 연결되지 않았어요. 먼저 [연결 테스트] 버튼으로 확인해주세요.");
      e.target.value = "";
      return;
    }

    if (!confirm(
      "⚠️ 마이그레이션을 시작하시겠어요?\n\n" +
      "• 백업 파일의 모든 데이터가 Supabase에 업로드됩니다\n" +
      "• 기존 localStorage 데이터는 그대로 유지됩니다 (안전망)\n" +
      "• Supabase에 같은 ID의 데이터가 있으면 덮어씁니다\n\n" +
      "계속할까요?"
    )) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup.data || backup.app !== "Angela's English Academy") {
          throw new Error("올바른 백업 파일이 아니에요");
        }
        await uploadBackup(backup.data);
      } catch (err) {
        addLog(`❌ 실패: ${err.message}`);
        setStatus("error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── 실제 업로드 로직 ──────────────────────────────────────────────────
  const uploadBackup = async (data) => {
    setStatus("uploading");
    setLog([]);
    setProgress(0);
    addLog("🚀 마이그레이션 시작!");

    const steps = [
      { key: "angela_students", label: "학생", fn: uploadStudents },
      { key: "angela_bank", label: "문제집", fn: uploadBanks },
      { key: "angela_exams", label: "시험지", fn: uploadExams },
      { key: "angela_assignments", label: "과제 배정", fn: uploadAssignments },
      { key: "angela_groups", label: "그룹", fn: (d) => uploadJsonList(d, "groups", "그룹") },
      { key: "angela_notices", label: "공지", fn: (d) => uploadJsonList(d, "notices", "공지") },
      { key: "angela_goals", label: "목표", fn: (d) => uploadJsonList(d, "goals", "목표") },
      { key: "angela_schedules", label: "일정", fn: (d) => uploadJsonList(d, "schedules", "일정") },
      { key: "angela_attendance", label: "출석", fn: uploadAttendance },
    ];

    let okCount = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const payload = data[step.key];
      setProgress(Math.round(((i + 1) / steps.length) * 100));
      if (!payload || (Array.isArray(payload) && payload.length === 0) ||
          (typeof payload === "object" && Object.keys(payload).length === 0)) {
        addLog(`⏭️ ${step.label}: 비어있어서 건너뜀`);
        continue;
      }
      try {
        const n = await step.fn(payload);
        addLog(`✅ ${step.label}: ${n}건 업로드 완료`);
        okCount++;
      } catch (err) {
        addLog(`⚠️ ${step.label} 실패: ${err.message}`);
      }
    }

    addLog(`\n🎉 마이그레이션 완료! (${okCount}/${steps.length} 단계 성공)`);
    addLog("이제 Supabase에 데이터가 저장되었어요!");
    addLog("💡 다음 단계: 코드에서 useStorage를 Supabase로 점진적으로 교체");
    setStatus("done");
    setProgress(100);
    setCounts(null); // 다시 조회 가능하도록
  };

  // ── 학생 업로드 ────────────────────────────────────────────────────────
  const uploadStudents = async (studentsObj) => {
    const rows = Object.values(studentsObj).map(s => ({
      name: s.name,
      grade: s.grade || "초등5",
      avatar: s.avatar || "🦊",
      memo: s.memo || "",
      join_date: s.joinDate || new Date().toISOString().slice(0, 10),
      points: s.points || 0,
      records: s.records || [],
      word_homework: s.wordHomework || null,
      custom_exam: s.customExam || null,
    }));
    if (rows.length === 0) return 0;
    const { error } = await supabase.from("students").upsert(rows, { onConflict: "name" });
    if (error) throw error;
    return rows.length;
  };

  // ── 문제집 업로드 ──────────────────────────────────────────────────────
  const uploadBanks = async (banksObj) => {
    const rows = Object.values(banksObj).map(b => ({
      id: b.id,
      title: b.title || "제목 없음",
      grade: b.grade || "초등5",
      tag: b.tag || "어휘",
      questions: b.questions || [],
    }));
    if (rows.length === 0) return 0;
    const { error } = await supabase.from("question_banks").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return rows.length;
  };

  // ── 시험지 업로드 ──────────────────────────────────────────────────────
  const uploadExams = async (examsList) => {
    const rows = (examsList || []).map(e => ({
      id: e.id,
      title: e.title || "제목 없음",
      grade: e.grade || null,
      time_limit: e.timeLimit || null,
      questions: e.questions || [],
      set_ids: e.setIds || [],
    }));
    if (rows.length === 0) return 0;
    const { error } = await supabase.from("exams").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return rows.length;
  };

  // ── 과제 배정 업로드 ───────────────────────────────────────────────────
  const uploadAssignments = async (assignsList) => {
    const rows = (assignsList || []).map(a => ({
      id: a.id,
      student_name: a.studentName,
      bank_id: a.bankId,
      bank_title: a.bankTitle,
      assigned_at: a.assignedAt || new Date().toISOString(),
      due_date: a.dueDate || null,
      status: a.status || "pending",
    }));
    if (rows.length === 0) return 0;
    const { error } = await supabase.from("assignments").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return rows.length;
  };

  // ── 일반 JSON 리스트 업로드 (그룹/공지/목표/일정) ──────────────────────
  const uploadJsonList = async (list, table, label) => {
    if (!Array.isArray(list) || list.length === 0) return 0;
    const rows = list.map(item => ({
      id: item.id || Math.random().toString(36).slice(2, 9),
      data: item,
    }));
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return rows.length;
  };

  // ── 출석 업로드 (객체 형태) ────────────────────────────────────────────
  const uploadAttendance = async (attObj) => {
    const rows = Object.entries(attObj || {}).map(([key, val]) => ({
      key,
      data: val,
    }));
    if (rows.length === 0) return 0;
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return rows.length;
  };

  return (
    <div style={{
      marginBottom: 12, padding: 16, borderRadius: 16,
      background: "linear-gradient(135deg, #f3e8ff, #e8f0ff)",
      border: `2px solid ${T.purple}`,
      boxShadow: T.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 28 }}>🚀</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>Supabase 마이그레이션</div>
          <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>학원 데이터를 클라우드로 이동</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.text, marginBottom: 12, lineHeight: 1.6, background: "white", padding: 10, borderRadius: 8 }}>
        <strong>📋 진행 순서:</strong><br/>
        ① <strong>[연결 테스트]</strong> 로 Supabase 연결 확인<br/>
        ② <strong>[현재 데이터 확인]</strong> 으로 Supabase에 뭐가 있는지 확인 (보통 비어있음)<br/>
        ③ 아래 [💾 데이터 백업 & 복원] 에서 받은 JSON 파일을 <strong>[백업 파일 업로드]</strong><br/>
        ④ 완료 후 다시 [현재 데이터 확인] 으로 검증
      </div>

      {/* 액션 버튼들 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <button onClick={handleTest} disabled={status === "uploading"}
          style={{ padding: "10px", background: T.accent, color: "white", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: status === "uploading" ? "not-allowed" : "pointer" }}>
          🔌 연결 테스트
        </button>
        <button onClick={handleCheckCounts} disabled={status === "uploading"}
          style={{ padding: "10px", background: T.green, color: "white", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: status === "uploading" ? "not-allowed" : "pointer" }}>
          📊 현재 데이터 확인
        </button>
      </div>

      {/* 백업 업로드 */}
      <label style={{
        display: "block", width: "100%", textAlign: "center", marginBottom: 10,
        background: status === "uploading" ? T.border : T.purple, color: "white",
        border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 900,
        cursor: status === "uploading" ? "not-allowed" : "pointer"
      }}>
        📤 백업 파일 업로드 (마이그레이션 실행)
        <input type="file" accept=".json,application/json" onChange={handleMigrate}
          disabled={status === "uploading"}
          style={{ display: "none" }} />
      </label>

      {/* 연결 메시지 */}
      {connectionMsg && (
        <div style={{
          padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 8,
          background: connectionMsg.startsWith("✅") ? T.greenLight : connectionMsg.startsWith("❌") ? T.redLight : T.yellowLight,
          color: connectionMsg.startsWith("✅") ? T.green : connectionMsg.startsWith("❌") ? T.red : T.yellow,
        }}>{connectionMsg}</div>
      )}

      {/* Supabase 현재 데이터 수 */}
      {counts && (
        <div style={{ background: "white", padding: 10, borderRadius: 8, fontSize: 11, marginBottom: 8 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: T.text }}>📊 Supabase 현재 데이터:</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
            {Object.entries(counts).map(([t, n]) => (
              <div key={t} style={{ color: n > 0 ? T.green : T.textDim }}>
                {n > 0 ? "✅" : "○"} {t}: <strong>{n}건</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 진행도 */}
      {status === "uploading" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>업로드 진행 중... {progress}%</div>
          <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: T.purple, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* 로그 */}
      {log.length > 0 && (
        <div style={{ background: "#1e293b", color: "#e2e8f0", padding: 10, borderRadius: 8, fontSize: 11, fontFamily: "monospace", maxHeight: 240, overflowY: "auto" }}>
          {log.map((l, i) => (
            <div key={i} style={{ marginBottom: 3 }}>
              <span style={{ color: "#94a3b8" }}>[{l.time}]</span> {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
