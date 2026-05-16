// src/app/api/generate/route.js
// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — AI 문제 생성 API 엔드포인트
//   서버에서만 ANTHROPIC_API_KEY 사용 → 클라이언트에 키 노출 없음
// ══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

export async function POST(request) {
  // 1. API 키 확인
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." },
      { status: 500 }
    );
  }

  // 2. 요청 본문 파싱
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { topic, grade, tag, count } = body;

  // 3. 입력 검증
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return NextResponse.json({ error: "주제를 입력해주세요." }, { status: 400 });
  }
  if (count < 1 || count > 15) {
    return NextResponse.json({ error: "문항 수는 1~15개 사이여야 합니다." }, { status: 400 });
  }

  // 4. 프롬프트 구성
  const gradeDescMap = {
    "유치원":"매우 쉬운 단어, 1~2단어 수준",
    "초등1":"간단한 단어, 기초 문장",
    "초등2":"기초 문장 이해",
    "초등3":"기본 어휘, 단문 이해",
    "초등4":"초등 기본 문법",
    "초등5":"초등 중급 문법",
    "초등6":"초등 고급, 중학 기초",
    "중1":"중학교 1학년",
    "중2":"중학교 2학년",
    "중3":"중학교 3학년",
  };
  const gradeDesc = gradeDescMap[grade] || grade;

  const prompt = `당신은 한국 초중등 영어 선생님을 돕는 AI입니다.
아래 조건에 맞는 영어 객관식 문제 ${count}개를 JSON 배열로 생성해주세요.

조건:
- 주제: ${topic.trim()}
- 학년/수준: ${grade} (${gradeDesc})
- 문법 태그: ${tag}
- 문항 수: ${count}개
- 모든 문제는 5지 선다형 (보기 정확히 5개)
- 정답 번호는 0~4 중 하나 (0이 첫 번째 보기)
- 빈칸 문제는 ____로 표시
- 해설은 한 줄 이내로 간결하게

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "q": "문제 내용",
    "opts": ["보기1","보기2","보기3","보기4","보기5"],
    "ans": 정답인덱스,
    "exp": "해설"
  }
]`;

  // 5. Anthropic API 호출
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // 빠르고 저렴한 모델 사용
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json(
        { error: `AI API 오류 (${res.status}). 잠시 후 다시 시도해주세요.` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || "";

    // 6. JSON 파싱
    let questions = null;
    try {
      // ```json ... ``` 블록 제거
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      // 배열 부분만 추출
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        questions = JSON.parse(arrMatch[0]);
      } else {
        questions = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "raw:", raw);
      return NextResponse.json(
        { error: "AI 응답 파싱 실패. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 7. 유효성 검증 및 정제
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { error: "AI가 올바른 형식으로 응답하지 않았어요. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    const validated = questions
      .filter(q => q && typeof q.q === "string" && q.q.trim() && Array.isArray(q.opts))
      .map((q, i) => ({
        id: Date.now() + i,
        q: q.q.trim(),
        opts: q.opts.slice(0, 5).map(o => String(o || "").trim()),
        ans: typeof q.ans === "number" ? Math.max(0, Math.min(4, q.ans)) : 0,
        exp: typeof q.exp === "string" ? q.exp.trim() : "",
      }))
      .filter(q => q.opts.filter(o => o).length >= 2); // 보기 최소 2개

    if (validated.length === 0) {
      return NextResponse.json(
        { error: "생성된 문제가 없어요. 주제를 바꿔서 다시 시도해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: validated });

  } catch (networkErr) {
    console.error("Network error:", networkErr);
    return NextResponse.json(
      { error: "네트워크 오류. 인터넷 연결을 확인해주세요." },
      { status: 503 }
    );
  }
}

// GET 요청은 허용하지 않음
export async function GET() {
  return NextResponse.json({ error: "POST 요청만 지원합니다." }, { status: 405 });
}
