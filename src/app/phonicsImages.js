// ══════════════════════════════════════════════════════════════════════════
//   🖼️ phonicsImages.js — 단어 → Cloudinary URL 매핑
//   v4.7 — Magic E 완전체 (30개 + 알파벳 26 + CVC 32 = 88개)
// ══════════════════════════════════════════════════════════════════════════

const CLOUDINARY_BASE = "https://res.cloudinary.com/dfgyp3ovs/image/upload/";
const TRANSFORM = "f_auto,q_auto,w_400,h_300,c_fill/";

// ⚠️ 중요: Public ID는 폴더 접두사 없음 (Cloudinary 실제 ID와 일치)
const WORD_TO_PUBLIC_ID = {
  // ═══ Level 1: 알파벳 26개 ═══
  apple:    "apple",
  ball:     "ball",
  cat:      "cat",
  dog:      "dog",
  egg:      "egg",
  fish:     "fish",
  goat:     "goat",
  hat:      "hat",
  igloo:    "igloo",
  jam:      "jam",
  king:     "king",
  lion:     "lion",
  moon:     "moon",
  nose:     "nose",
  octopus:  "octopus",
  pig:      "pig",
  queen:    "queen",
  rabbit:   "rabbit",
  sun:      "sun",
  tiger:    "tiger",
  umbrella: "umbrella",
  violin:   "violin",
  watch:    "watch",
  box:      "box",
  yellow:   "yellow",
  zebra:    "zebra",

  // ═══ Level 2: CVC 전체 ═══
  // Short A
  bat:      "bat",
  rat:      "rat",
  mat:      "mat",
  bag:      "bag",
  map:      "map",
  cap:      "cap",
  fan:      "fan",
  can:      "can",
  // Short E
  bed:      "bed",
  hen:      "hen",
  pen:      "pen",
  ten:      "ten",
  red:      "red",
  leg:      "leg",
  net:      "net",
  web:      "web",
  // Short I
  six:      "six",
  lip:      "lip",
  kid:      "kid",
  pin:      "pin",
  milk:     "milk",
  // Short O
  fox:      "fox",
  pot:      "pot",
  log:      "log",
  mop:      "mop",
  rock:     "rock",
  frog:     "frog",
  // Short U
  bus:      "bus",
  cup:      "cup",
  duck:     "duck",
  nut:      "nut",
  bug:      "bug",
  drum:     "drum",
  mug:      "mug",

  // ═══ Level 3: Magic E 30개 전체 ═══
  // 기존 6개 long
  cape:     "cape",
  tape:     "tape",
  kite:     "kite",
  pine:     "pine",
  ride:     "ride",
  tube:     "tube",
  // a_e 추가 (mad, made, tap, rate, fad, fade)
  mad:      "mad",
  made:     "made",
  tap:      "tap",
  rate:     "rate",
  fad:      "fad",
  fade:     "fade",
  // i_e 추가 (bit, bite, kit, rid, hid, hide)
  bit:      "bit",
  bite:     "bite",
  kit:      "kit",
  rid:      "rid",
  hid:      "hid",
  hide:     "hide",
  // o_e 추가 (hop, hope, rod, rode, not, note)
  hop:      "hop",
  hope:     "hope",
  rod:      "rod",
  rode:     "rode",
  not:      "not",
  note:     "note",
  // u_e 추가 (cut, cute, tub)
  cut:      "cut",
  cute:     "cute",
  tub:      "tub",

  // ═══ Level 4: Blends (대기 중) ═══
  // 완료 시 주석 해제
  // chair:    "chair",
  // cheese:   "cheese",
  // chicken:  "chicken",
  // child:    "child",
  // chocolate:"chocolate",
  // ship:     "ship",
  // shoe:     "shoe",
  // shark:    "shark",
  // sheep:    "sheep",
  // shell:    "shell",
  // thumb:    "thumb",
  // three:    "three",
  // blue:     "blue",
  // black:    "black",
  // block:    "block",
  // blanket:  "blanket",
  // star:     "star",
  // stone:    "stone",
  // stairs:   "stairs",
  // fruit:    "fruit",
};

export function getCuratedImageUrl(word) {
  if (!word) return null;
  const key = word.toLowerCase().trim();
  const publicId = WORD_TO_PUBLIC_ID[key];
  if (!publicId) return null;
  return `${CLOUDINARY_BASE}${TRANSFORM}${publicId}`;
}

export function hasCuratedImage(word) {
  if (!word) return false;
  return WORD_TO_PUBLIC_ID[word.toLowerCase().trim()] !== undefined;
}
