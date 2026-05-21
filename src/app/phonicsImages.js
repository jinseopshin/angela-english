// ══════════════════════════════════════════════════════════════════════════
//   🖼️ phonicsImages.js — 단어 → Cloudinary URL 매핑
//   v4.2 — 알파벳 26개 + CVC 16개 활성화 (#1~42 완료)
// ══════════════════════════════════════════════════════════════════════════

// ⭐ 진섭님의 Cloudinary Cloud Name으로 변경하세요
const CLOUDINARY_BASE = "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/";

// 이미지 변환 옵션 (자동 최적화)
const TRANSFORM = "f_auto,q_auto,w_400,h_300,c_fill/";

// ── 단어 → Cloudinary public_id 매핑 ──
const WORD_TO_PUBLIC_ID = {
  // ═══ Level 1: 알파벳 26개 (완료) ═══
  apple:    "phonics/apple",
  ball:     "phonics/ball",
  cat:      "phonics/cat",
  dog:      "phonics/dog",
  egg:      "phonics/egg",
  fish:     "phonics/fish",
  goat:     "phonics/goat",
  hat:      "phonics/hat",
  igloo:    "phonics/igloo",
  jam:      "phonics/jam",
  king:     "phonics/king",
  lion:     "phonics/lion",
  moon:     "phonics/moon",
  nose:     "phonics/nose",
  octopus:  "phonics/octopus",
  pig:      "phonics/pig",
  queen:    "phonics/queen",
  rabbit:   "phonics/rabbit",
  sun:      "phonics/sun",
  tiger:    "phonics/tiger",
  umbrella: "phonics/umbrella",
  violin:   "phonics/violin",
  watch:    "phonics/watch",
  box:      "phonics/box",
  yellow:   "phonics/yellow",
  zebra:    "phonics/zebra",

  // ═══ Level 2: CVC #27~42 (완료) ═══
  // Short A (8개)
  bat:      "phonics/bat",
  rat:      "phonics/rat",
  mat:      "phonics/mat",
  bag:      "phonics/bag",
  map:      "phonics/map",
  cap:      "phonics/cap",
  fan:      "phonics/fan",
  can:      "phonics/can",
  // Short E (8개)
  bed:      "phonics/bed",
  hen:      "phonics/hen",
  pen:      "phonics/pen",
  ten:      "phonics/ten",
  red:      "phonics/red",
  leg:      "phonics/leg",
  net:      "phonics/net",
  web:      "phonics/web",

  // ═══ Level 2: CVC #43~ (진행 중) ═══
  // 완료한 단어만 주석 해제하세요
  // fish는 알파벳에서 이미 등록됨 - 추가 안 해도 됨
  // six:      "phonics/six",
  // lip:      "phonics/lip",
  // kid:      "phonics/kid",
  // pin:      "phonics/pin",
  // milk:     "phonics/milk",
  // fox:      "phonics/fox",
  // box는 알파벳에서 이미 등록됨 - 추가 안 해도 됨
  // pot:      "phonics/pot",
  // log:      "phonics/log",
  // mop:      "phonics/mop",
  // rock:     "phonics/rock",
  // frog:     "phonics/frog",
  // bus:      "phonics/bus",
  // cup:      "phonics/cup",
  // duck:     "phonics/duck",
  // nut:      "phonics/nut",
  // bug:      "phonics/bug",
  // drum:     "phonics/drum",
  // mug:      "phonics/mug",

  // ═══ Level 3: Magic E (대기 중) ═══
  // cape:     "phonics/cape",
  // tape:     "phonics/tape",
  // kite:     "phonics/kite",
  // pine:     "phonics/pine",
  // ride:     "phonics/ride",
  // tube:     "phonics/tube",

  // ═══ Level 4: Blends (대기 중) ═══
  // chair:    "phonics/chair",
  // cheese:   "phonics/cheese",
  // chicken:  "phonics/chicken",
  // child:    "phonics/child",
  // chocolate:"phonics/chocolate",
  // ship:     "phonics/ship",
  // shoe:     "phonics/shoe",
  // shark:    "phonics/shark",
  // sheep:    "phonics/sheep",
  // shell:    "phonics/shell",
  // thumb:    "phonics/thumb",
  // three:    "phonics/three",
  // blue:     "phonics/blue",
  // black:    "phonics/black",
  // block:    "phonics/block",
  // blanket:  "phonics/blanket",
  // star:     "phonics/star",
  // stone:    "phonics/stone",
  // stairs:   "phonics/stairs",
  // frog은 CVC에서 이미 등록됨 - 추가 안 해도 됨
  // fruit:    "phonics/fruit",
};

// ── 메인 함수: 단어로 이미지 URL 가져오기 ──
export function getCuratedImageUrl(word) {
  if (!word) return null;
  const key = word.toLowerCase().trim();
  const publicId = WORD_TO_PUBLIC_ID[key];
  if (!publicId) return null;
  return `${CLOUDINARY_BASE}${TRANSFORM}${publicId}`;
}

// ── 단어가 큐레이션 되어 있는지 확인 ──
export function hasCuratedImage(word) {
  if (!word) return false;
  return WORD_TO_PUBLIC_ID[word.toLowerCase().trim()] !== undefined;
}
