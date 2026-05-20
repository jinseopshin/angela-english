// src/api/extract-words/route.js
// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — 교재 사진에서 영단어 자동 추출 API
//   Claude Vision으로 이미지를 분석하여 영어 단어와 한글 뜻 페어 추출
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

  const { image, mediaType } = body;
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
  }

  const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const mt = supportedTypes.includes(mediaType) ? mediaType : "image/jpeg";

  // 3. 프롬프트 구성
  const prompt = `이 이미지는 영어 교재 페이지입니다. 이미지에서 영어 단어와 그에 대응하는 한글 뜻을 모두 추출해주세요.

추출 규칙:
1. 영어 단어와 한글 뜻이 명확히 짝지어진 것만 추출
2. 영어 단어가 있지만 한글 뜻이 없으면 ko를 빈 문자열로
3. 문장이나 예문은 제외, 단어/숙어만 추출
4. 영어 단어는 소문자로 정규화 (단, 고유명사는 그대로)
5. 한글 뜻은 가장 핵심적인 뜻 한 가지만 (여러 뜻 콤마로 구분 가능)

응답은 반드시 다음 JSON 형식으로만 응답하세요. 다른 설명 없이 JSON만:
{
  "words": [
    {"en": "apple", "ko": "사과"},
    {"en": "banana", "ko": "바나나"}
  ]
}`;

  // 4. Anthropic Vision API 호출
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
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mt,
                  data: image,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic Vision API error:", res.status, errText);
      return NextResponse.json(
        { error: `AI 분석 실패 (${res.status}). 잠시 후 다시 시도해주세요.` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || "";

    // 5. JSON 파싱
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
        { error: "AI 응답 파싱 실패. 다른 사진으로 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 6. 정규화 + 중복 제거
    if (!parsed.words || !Array.isArray(parsed.words)) {
      return NextResponse.json({ words: [] });
    }

    const seen = new Set();
    const words = [];
    for (const w of parsed.words) {
      if (!w.en || typeof w.en !== "string") continue;
      const en = w.en.trim().toLowerCase();
      if (!en || seen.has(en)) continue;
      seen.add(en);
      words.push({
        en,
        ko: typeof w.ko === "string" ? w.ko.trim() : "",
      });
    }

    return NextResponse.json({ words });

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