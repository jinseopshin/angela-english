"use client";
import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  getAllStudentsStats,
  getStudentRanking,
  getStudentsWithPendingReview,
  getLearningTrend7Days,
} from "./studentWords";

// ══════════════════════════════════════════════════════════════════════════
//   📖 선생님 단어 학습 현황 대시보드 v2
//
//   v2 개선 사항 (2026-05-19):
//   1. 학습 0개 학생은 랭킹에서 분리 → 맨 아래 "아직 학습 안 한 학생" 섹션
//   2. 복습 대기 0명일 때 긍정 메시지 표시
//   3. 정확도 0%인 학생은 "-" 로 표시 (학습 안 한 학생)
//   4. 새로고침 버튼 추가
//   5. 마지막 갱신 시간 표시
//   6. 전체 데이터 0일 때 빈 상태 안내
//
//   ⚠️ 부모 컴포넌트에서 T (테마) 객체와 Card, Btn 컴포넌트가 전역으로
//      사용 가능해야 함. App.js에 정의된 것을 그대로 사용함.
// ══════════════════════════════════════════════════════════════════════════

export default function WordLearningDashboard({ students, T, Card, Btn, Tag, onStudentClick }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [pendingReview, setPendingReview] = useState([]);
  const [trend, setTrend] = useState([]);
  const [lastFetched, setLastFetched] = useState(null);

  // 활성 학생 목록
  const activeStudents = Object.values(students || {}).filter(s => s.active !== false);
  const studentNames = activeStudents.map(s => s.name);

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsData, rankingData, pendingData, trendData] = await Promise.all([
        getAllStudentsStats(studentNames),
        getStudentRanking(studentNames),
        getStudentsWithPendingReview(studentNames),
        getLearningTrend7Days(studentNames),
      ]);

      setStats(statsData);
      setRanking(rankingData);
      setPendingReview(pendingData);
      setTrend(trendData);
      setLastFetched(new Date());
    } catch (e) {
      console.warn("Dashboard load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentNames.join(",")]);

  useEffect(() => {
    fetchAll(false);
  }, [studentNames.join(",")]);

  // ─────── 갱신 시간 포맷 ───────
  const formatLastFetched = () => {
    if (!lastFetched) return "";
    const diff = Math.floor((new Date() - lastFetched) / 1000);
    if (diff < 5) return "방금 전";
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    const h = lastFetched.getHours().toString().padStart(2, "0");
    const m = lastFetched.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  // ─────── 로딩 화면 ───────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13, color: T.textMid }}>통계를 불러오는 중...</div>
      </div>
    );
  }

  // ─────── 학생 없음 ───────
  if (activeStudents.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>활성 학생이 없어요</div>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>학생을 먼저 등록해주세요</div>
      </Card>
    );
  }

  // 학생 정보 매핑 (이름 → 학생 객체)
  const studentByName = {};
  activeStudents.forEach(s => { studentByName[s.name] = s; });

  // ✅ 학습한 학생 / 안 한 학생 분리
  const studiedRanking = ranking.filter(r => r.studied > 0);
  const notStudiedFromRanking = ranking.filter(r => r.studied === 0);
  // 랭킹에 아예 없는 학생도 "학습 안 함"으로 처리
  const rankingNames = new Set(ranking.map(r => r.name));
  const notInRanking = activeStudents.filter(s => !rankingNames.has(s.name));
  const notStudiedStudents = [
    ...notStudiedFromRanking.map(r => studentByName[r.name]).filter(Boolean),
    ...notInRanking,
  ];

  // 전체 데이터가 비어있는지 (테스트/초기 상태 감지)
  const isEmpty = (stats?.totalStudied || 0) === 0;

  return (
    <div>
      {/* ━━━━━━━━━━━ 헤더 + 새로고침 ━━━━━━━━━━━ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: T.text, marginBottom: 4 }}>📖 단어 학습 현황</div>
          <div style={{ fontSize: 11, color: T.textMid }}>
            활성 학생 {activeStudents.length}명의 단어 학습 데이터입니다
            {lastFetched && (
              <span style={{ marginLeft: 8, color: T.textDim }}>
                · 🕐 {formatLastFetched()} 갱신
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          title="새로고침"
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 800,
            color: refreshing ? T.textDim : T.accent,
            cursor: refreshing ? "wait" : "pointer",
            flexShrink: 0,
            transition: "all 0.15s",
          }}>
          <span style={{
            display: "inline-block",
            transition: "transform 0.5s",
            transform: refreshing ? "rotate(360deg)" : "rotate(0deg)",
          }}>🔄</span> 새로고침
        </button>
      </div>

      {/* ━━━━━━━━━━━ 데이터가 아예 없는 경우 안내 ━━━━━━━━━━━ */}
      {isEmpty && (
        <Card style={{ padding: 20, marginBottom: 16, background: T.accentLight, border: `1.5px dashed ${T.accent}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 32 }}>💡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 3 }}>
                아직 단어 학습 데이터가 없어요
              </div>
              <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.5 }}>
                학생들이 단어 게임이나 단어장을 사용하면 통계가 채워져요.
                망각 곡선 기반 복습 일정도 자동으로 계산됩니다.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ━━━━━━━━━━━ 1. 전체 합계 ━━━━━━━━━━━ */}
      <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>
        📊 전체 학습 현황
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginBottom: 20
      }}>
        <Card style={{ padding: 14, background: `linear-gradient(135deg, ${T.green}, ${T.greenLight})`, color: "white", border: "none" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>마스터 단어</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{stats?.totalMastered || 0}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>5단계 도달</div>
        </Card>
        <Card style={{ padding: 14, background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`, color: "white", border: "none" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📚</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>학습중</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{stats?.totalLearning || 0}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>복습 진행중</div>
        </Card>
        <Card style={{ padding: 14, background: `linear-gradient(135deg, ${T.red}, ${T.redLight})`, color: "white", border: "none" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>어려워하는</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{stats?.totalStruggling || 0}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>틀림 &gt; 맞음</div>
        </Card>
        <Card style={{ padding: 14, background: `linear-gradient(135deg, ${T.yellow}, ${T.orange})`, color: "white", border: "none" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>⭐</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>즐겨찾기</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{stats?.totalFavorited || 0}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>학생들 단어장</div>
        </Card>
      </div>

      {/* ━━━━━━━━━━━ 2. 오늘 복습 대기 학생 ━━━━━━━━━━━ */}
      <div style={{ fontSize: 12, fontWeight: 800, color: pendingReview.length > 0 ? T.red : T.green, marginBottom: 8, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
        🔔 오늘 복습 대기 학생
        {pendingReview.length > 0 && (
          <span style={{ background: T.red, color: "white", fontSize: 10, fontWeight: 900, borderRadius: 8, padding: "2px 7px" }}>
            {pendingReview.length}명
          </span>
        )}
      </div>
      {pendingReview.length > 0 ? (
        <Card style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
          {pendingReview.slice(0, 10).map((p, i) => {
            const s = studentByName[p.name];
            if (!s) return null;
            return (
              <div key={p.name}
                onClick={() => onStudentClick && onStudentClick(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  borderBottom: i < pendingReview.slice(0, 10).length - 1 ? `1px solid ${T.border}` : "none",
                  cursor: onStudentClick ? "pointer" : "default",
                  background: p.count >= 30 ? T.redLight : "transparent",
                  transition: "all 0.1s"
                }}>
                <div style={{ fontSize: 22 }}>{s.avatar || "🙂"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: T.textMid }}>{s.grade || "학년 미정"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: 16, fontWeight: 900,
                    color: p.count >= 30 ? T.red : p.count >= 10 ? T.orange : T.accent
                  }}>{p.count}개</div>
                  <div style={{ fontSize: 9, color: T.textDim }}>
                    {p.count >= 30 ? "🔴 시급" : p.count >= 10 ? "🟡 주의" : "🟢 보통"}
                  </div>
                </div>
              </div>
            );
          })}
          {pendingReview.length > 10 && (
            <div style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, color: T.textMid, background: T.bg }}>
              외 {pendingReview.length - 10}명 더 있어요
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ padding: 18, marginBottom: 20, background: T.greenLight, border: `1.5px solid ${T.green}33`, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>👏</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.green }}>오늘 복습 대기 학생이 없어요!</div>
          <div style={{ fontSize: 10, color: T.textMid, marginTop: 4 }}>모두 복습을 잘 따라가고 있어요</div>
        </Card>
      )}

      {/* ━━━━━━━━━━━ 3. 학생별 진도 랭킹 ━━━━━━━━━━━ */}
      {(studiedRanking.length > 0 || notStudiedStudents.length > 0) && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>
            🏆 학생별 진도 랭킹
          </div>
          <Card style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
            {studiedRanking.length > 0 ? (
              studiedRanking.map((r, i) => {
                const s = studentByName[r.name];
                if (!s) return null;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                return (
                  <div key={r.name}
                    onClick={() => onStudentClick && onStudentClick(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      borderBottom: i < studiedRanking.length - 1 ? `1px solid ${T.border}` : "none",
                      cursor: onStudentClick ? "pointer" : "default",
                      background: i < 3 ? T.yellowLight : "transparent",
                    }}>
                    <div style={{
                      fontSize: i < 3 ? 22 : 13,
                      fontWeight: 900,
                      minWidth: 32,
                      textAlign: "center",
                      color: i < 3 ? T.text : T.textMid
                    }}>{medal}</div>
                    <div style={{ fontSize: 22 }}>{s.avatar || "🙂"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: T.textMid }}>
                        📚 학습 {r.studied}개 · ✅ 마스터 {r.mastered}개
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 14, fontWeight: 900,
                        color: r.accuracy >= 80 ? T.green : r.accuracy >= 60 ? T.orange : T.red
                      }}>{r.total > 0 ? `${r.accuracy}%` : "-"}</div>
                      <div style={{ fontSize: 9, color: T.textDim }}>정확도</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 18, textAlign: "center", color: T.textMid, fontSize: 12 }}>
                아직 단어를 학습한 학생이 없어요
              </div>
            )}

            {/* 아직 학습 안 한 학생 안내 (작게, 부드럽게) */}
            {notStudiedStudents.length > 0 && (
              <div style={{
                padding: "10px 12px",
                background: T.bg,
                borderTop: studiedRanking.length > 0 ? `1px dashed ${T.border}` : "none",
                fontSize: 10,
                color: T.textDim,
                textAlign: "center",
                lineHeight: 1.5
              }}>
                💤 <strong style={{ color: T.textMid }}>아직 학습 안 한 학생 {notStudiedStudents.length}명</strong>
                <span style={{ marginLeft: 4 }}>
                  ({notStudiedStudents.slice(0, 5).map(s => s.name).join(", ")}
                  {notStudiedStudents.length > 5 && ` 외 ${notStudiedStudents.length - 5}명`})
                </span>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ━━━━━━━━━━━ 4. 최근 7일 학습량 추이 ━━━━━━━━━━━ */}
      <div style={{ fontSize: 12, fontWeight: 800, color: T.textMid, marginBottom: 8, letterSpacing: 0.5 }}>
        📈 최근 7일 학습량 추이
      </div>
      <Card style={{ padding: 14, marginBottom: 20 }}>
        {trend.length === 0 || trend.every(t => t.count === 0) ? (
          <div style={{ padding: 24, textAlign: "center", color: T.textMid, fontSize: 12 }}>
            📉 최근 7일간 학습 기록이 없어요
          </div>
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" stroke={T.textMid} fontSize={11} />
                <YAxis stroke={T.textMid} fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 8, fontSize: 12
                  }}
                  labelStyle={{ color: T.text, fontWeight: 700 }}
                  formatter={(value) => [`${value}개 단어`, "학습"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={T.accent}
                  strokeWidth={3}
                  dot={{ fill: T.accent, r: 4 }}
                  activeDot={{ r: 6, fill: T.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ fontSize: 10, color: T.textDim, marginTop: 8, textAlign: "center" }}>
          ※ 학생들이 학습한 단어 개수 (중복 제외)
        </div>
      </Card>
    </div>
  );
}
