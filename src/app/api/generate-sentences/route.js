// src/app/api/generate-sentences/route.js
// ══════════════════════════════════════════════════════════════════════════
//   Angela's English Academy — AI 문장 생성 API 엔드포인트
//   장르/난이도/개수에 따라 영어 문장 + 한글 번역 자동 생성
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

  const { topic, grade, difficulty, count, extraNote } = body;

  // 3. 입력 검증
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return NextResponse.json({ error: "주제를 입력해주세요." }, { status: 400 });
  }
  if (count < 1 || count > 20) {
    return NextResponse.json({ error: "문장 수는 1~20개 사이여야 합니다." }, { status: 400 });
  }

  // 4. 프롬프트 구성
  const gradeDescMap = {
    "유치원": "매우 쉬운 단어만 사용. 3-4단어 문장. CVC 단어 위주 (cat, dog, sun, big 등)",
    "초등1": "기초 단어, 4-5단어 짧은 문장",
    "초등2": "기초 어휘, 5-6단어 단순 문장",
    "초등3": "기본 어휘, 5-7단어 문장",
    "초등4": "초등 기본 문법, 6-8단어 문장",
    "초등5": "초등 중급 문법, 7-9단어 문장",
    "초등6": "초등 고급, 8-10단어 문장",
    "중1": "중학교 1학년 수준",
    "중2": "중학교 2학년 수준",
    "중3": "중학교 3학년 수준",
  };
  const gradeDesc = gradeDescMap[grade] || grade;

  const difficultyDescMap = {
    "easy": "쉬움 - 단순한 SVO 또는 SVC 구조. 접속사 없음.",
    "medium": "보통 - 형용사, 부사 포함. 간단한 접속사(and, but) 사용 가능.",
    "hard": "어려움 - 더 긴 문장. 시제 변화, 종속절, 다양한 접속사 사용 가능.",
  };
  const difficultyDesc = difficultyDescMap[difficulty] || difficultyDescMap.easy;

  const prompt = `당신은 한국 초중등 영어 선생님을 돕는 AI입니다.
아래 조건에 맞는 영어 학습용 문장 ${count}개를 JSON 배열로 생성해주세요.

조건:
- 주제/상황: ${topic.trim()}
- 학년/수준: ${grade} (${gradeDesc})
- 난이도: ${difficulty} (${difficultyDesc})
- 문장 수: ${count}개
${extraNote && extraNote.trim() ? `- 추가 요청: ${extraNote.trim()}` : ""}

각 문장은 다음을 포함:
- english: 영어 문장 (마침표, 물음표, 느낌표 포함)
- korean: 자연스러운 한국어 번역
- words: 영어 문장을 공백으로 분리한 단어 배열 (구두점은 마지막 단어에 붙임)

예시:
"The cat is fat." → words: ["The", "cat", "is", "fat."]
"Is this a pen?" → words: ["Is", "this", "a", "pen?"]

중요:
- 모든 문장은 학생이 쉽게 이해할 수 있어야 함
- 단어가 너무 길지 않고 단어 수가 적절해야 함 (어순 학습용)
- 같은 패턴 반복보다는 다양한 문장 구조 사용
- 한국 학생에게 익숙한 단어 위주

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "english": "The cat is cute.",
    "korean": "고양이가 귀여워요.",
    "words": ["The", "cat", "is", "cute."]
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
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
    let sentences = null;
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        sentences = JSON.parse(arrMatch[0]);
      } else {
        sentences = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "raw:", raw);
      return NextResponse.json(
        { error: "AI 응답 파싱 실패. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 7. 유효성 검증 및 정제
    if (!Array.isArray(sentences)) {
      return NextResponse.json(
        { error: "AI가 올바른 형식으로 응답하지 않았어요. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    const validated = sentences
      .filter(s => s && typeof s.english === "string" && s.english.trim() &&
                   typeof s.korean === "string" && s.korean.trim())
      .map((s) => {
        const english = s.english.trim();
        const korean = s.korean.trim();
        // words가 잘못되어 있으면 영어 문장에서 자동 추출
        let words = Array.isArray(s.words) ? s.words.filter(w => w && w.trim()) : [];
        if (words.length === 0) {
          words = english.split(/\s+/).filter(w => w.length > 0);
        }
        return {
          english,
          korean,
          words,
          difficulty,
        };
      })
      .filter(s => s.words.length >= 2 && s.words.length <= 15); // 단어 수 2~15개

    if (validated.length === 0) {
      return NextResponse.json(
        { error: "생성된 문장이 없어요. 주제를 바꿔서 다시 시도해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ sentences: validated });

  } catch (networkErr) {
    console.error("Network error:", networkErr);
    return NextResponse.json(
      { error: "네트워크 오류. 인터넷 연결을 확인해주세요." },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "POST 요청만 지원합니다." }, { status: 405 });
}
