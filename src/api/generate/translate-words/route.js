// app/api/extract-words/route.js
// 교재 사진을 Claude Vision으로 분석하여 영어 단어와 한글 뜻을 추출

import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req) {
  try {
    const { image, mediaType } = await req.json();

    if (!image) {
      return Response.json({ error: "이미지가 없습니다." }, { status: 400 });
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const mt = supportedTypes.includes(mediaType) ? mediaType : "image/jpeg";

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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
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
    });

    // 텍스트 응답에서 JSON 추출
    const text = response.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("");

    // JSON 파싱 (markdown 코드 펜스 제거)
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // JSON 추출 재시도 — { 부터 } 까지
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("AI 응답을 파싱할 수 없습니다");
      }
    }

    if (!parsed.words || !Array.isArray(parsed.words)) {
      return Response.json({ words: [] });
    }

    // 정규화 + 중복 제거
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

    return Response.json({ words });
  } catch (err) {
    console.error("extract-words 에러:", err);
    const msg = err?.message || "사진 분석 실패";
    return Response.json({ error: msg }, { status: 500 });
  }
}
