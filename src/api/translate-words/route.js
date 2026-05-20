// src/api/translate-words/route.js
// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — 영어 단어를 한꺼번에 한글로 번역하는 API
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

  const { words } = body;
  if (!Array.isArray(words) || words.length === 0) {
    return NextResponse.json({ error: "번역할 단어가 없습니다." }, { status: 400 });
  }
  if (words.length > 100) {
    return NextResponse.json({ error: "한 번에 최대 100개까지 번역 가능합니다." }, { status: 400 });
  }

  const wordList = words.map(w => String(w).trim()).filter(Boolean).slice(0, 100);

  const prompt = `다음 영어 단어들의 한글 뜻을 알려주세요.
각 단어의 가장 핵심적인 뜻 한 가지만 작성해주세요. 여러 뜻이 중요하면 콤마로 구분(예: "사과, 사과하다").
중·고등학생이 학습하는 교과서 수준의 뜻을 우선해주세요.

단어 목록:
${wordList.map((w, i) => `${i+1}. ${w}`).join("\n")}

응답은 반드시 다음 JSON 형식으로만 응답하세요. 다른 설명 없이 JSON만:
{
  "translations": [
    {"en": "apple", "ko": "사과"},
    {"en": "banana", "ko": "바나나"}
  ]
}`;

  // 3. Anthropic API 호출
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
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

    // 4. JSON 파싱
    let parsed = null;
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        parsed = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "raw:", raw);
      return NextResponse.json(
        { error: "AI 응답 파싱 실패. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    const translations = (parsed.translations || []).map(t => ({
      en: String(t.en || "").trim().toLowerCase(),
      ko: String(t.ko || "").trim(),
    })).filter(t => t.en && t.ko);

    return NextResponse.json({ translations });

  } catch (networkErr) {
    console.error("Network error:", networkErr);
    return NextResponse.json(
      { error: "네트워크 오류. 다시 시도해주세요." },
      { status: 503 }
    );
  }
}

// GET 요청은 허용하지 않음
export async function GET() {
  return NextResponse.json({ error: "POST 요청만 지원합니다." }, { status: 405 });
}