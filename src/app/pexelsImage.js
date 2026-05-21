// ══════════════════════════════════════════════════════════════════════════
//   🖼️ pexelsImage.js — Pexels API 이미지 로딩 헬퍼
//
//   - 단어를 검색해 어린이 친화적 이미지 1장 반환
//   - sessionStorage 캐싱으로 같은 단어 재호출 방지
//   - 실패 시 null 반환 (호출 측에서 이모지 폴백)
//
//   환경변수: NEXT_PUBLIC_PEXELS_API_KEY
//   - Vercel: Settings > Environment Variables 에 추가
//   - 로컬: .env.local 파일에 추가
// ══════════════════════════════════════════════════════════════════════════

const PEXELS_API = "https://api.pexels.com/v1/search";
const CACHE_PREFIX = "pexels_img_";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일 캐싱

// ── 단어 → Pexels 검색어 매핑 (애매한 단어는 명확하게) ──
const SEARCH_OVERRIDES = {
  // 동물 - 단순 단어보다 동물 키워드 추가
  bat:    "fruit bat animal",
  rat:    "rat rodent",
  hen:    "hen chicken",
  fox:    "fox animal",
  pig:    "pig farm",
  cat:    "cute cat",
  dog:    "cute dog",
  goat:   "goat animal",
  duck:   "duck pond",
  frog:   "frog green",
  // 사물 - 영어 동음이의어 회피
  mat:    "yoga mat",
  bag:    "school bag",
  cap:    "baseball cap",
  fan:    "electric fan",
  can:    "soda can",
  pen:    "writing pen",
  net:    "fishing net",
  web:    "spider web",
  bib:    "baby bib",
  pot:    "cooking pot",
  top:    "spinning top toy",
  log:    "wood log",
  mop:    "cleaning mop",
  bus:    "yellow school bus",
  cup:    "tea cup",
  nut:    "walnut nut",
  bug:    "ladybug insect",
  mug:    "coffee mug",
  rock:   "rock stone",
  drum:   "drum musical",
  // 추상 개념 - 시각화 가능한 형태로
  big:    "big elephant",
  red:    "red color",
  hot:    "hot chili pepper",
  hit:    "boxing punch",
  sit:    "child sitting",
  kid:    "happy kid",
  win:    "trophy winner",
  pin:    "push pin",
  wet:    "water splash",
  run:    "running person",
  // 알파벳 대표 단어
  apple:  "red apple fruit",
  ball:   "colorful ball",
  egg:    "white egg",
  fish:   "fish swimming",
  hat:    "wool hat",
  igloo:  "igloo snow house",
  jam:    "strawberry jam jar",
  king:   "king crown",
  lion:   "lion animal",
  moon:   "moon night",
  nose:   "human nose",
  octopus:"octopus sea",
  queen:  "queen crown",
  rabbit: "rabbit bunny",
  sun:    "sun bright",
  tiger:  "tiger animal",
  umbrella: "colorful umbrella",
  violin: "violin instrument",
  watch:  "wrist watch",
  box:    "cardboard box",
  yellow: "yellow color",
  zebra:  "zebra animal",
};

function getCachedImage(word) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + word);
    if (!raw) return null;
    const { url, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(CACHE_PREFIX + word);
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function setCachedImage(word, url) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CACHE_PREFIX + word,
      JSON.stringify({ url, ts: Date.now() })
    );
  } catch {}
}

// 캐시에 "없음(null)"으로 기록 — API 실패한 단어 재호출 막기
function setCachedMiss(word) {
  setCachedImage(word, "__MISS__");
}

// ── 메인 함수: 단어로 이미지 URL 가져오기 ──
export async function fetchWordImage(word) {
  if (!word) return null;
  const key = word.toLowerCase().trim();

  // 1) 캐시 체크
  const cached = getCachedImage(key);
  if (cached === "__MISS__") return null;
  if (cached) return cached;

  // 2) API 키 체크
  const apiKey = process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[pexelsImage] NEXT_PUBLIC_PEXELS_API_KEY 미설정");
    return null;
  }

  // 3) 검색어 결정 (override 우선)
  const searchTerm = SEARCH_OVERRIDES[key] || key;

  // 4) API 호출
  try {
    const url = `${PEXELS_API}?query=${encodeURIComponent(searchTerm)}&per_page=3&orientation=square`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey }
    });
    if (!res.ok) {
      console.warn("[pexelsImage] API 오류:", res.status);
      setCachedMiss(key);
      return null;
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) {
      setCachedMiss(key);
      return null;
    }
    // medium 사이즈가 적당 (350px 정도)
    const imgUrl = photo.src.medium || photo.src.small || photo.src.original;
    setCachedImage(key, imgUrl);
    return imgUrl;
  } catch (err) {
    console.warn("[pexelsImage] fetch 실패:", err.message);
    setCachedMiss(key);
    return null;
  }
}

// ── 디버그용: 캐시 초기화 ──
export function clearImageCache() {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(window.sessionStorage);
    keys.forEach(k => {
      if (k.startsWith(CACHE_PREFIX)) {
        window.sessionStorage.removeItem(k);
      }
    });
  } catch {}
}
