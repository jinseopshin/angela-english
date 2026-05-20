// ══════════════════════════════════════════════════════════════════════════
//   사운드 & 액션 효과 시스템
//   - 듀오링고 스타일 게임풍 효과음 (Web Audio API)
//   - 정답/오답/콤보/완료 사운드
//   - 화면 액션: 흔들기, 별 효과, 콤보 표시, 꽃가루
//   - 모든 게임에서 공통으로 사용
// ══════════════════════════════════════════════════════════════════════════

// 사운드 ON/OFF (학생별 설정, localStorage)
export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem("angela_sound_enabled");
  return v === null ? true : v === "true";
}

export function setSoundEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem("angela_sound_enabled", enabled ? "true" : "false");
}

// ── Web Audio API 컨텍스트 (전역 1개만 사용) ─────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext 생성 실패:", e);
      return null;
    }
  }
  // 모바일 브라우저는 사용자 인터랙션 후에만 재생 가능
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ── 기본 톤 생성 헬퍼 ───────────────────────────────────────────────────
function playTone(freq, duration = 0.15, type = "sine", volume = 0.3, detune = 0) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    if (detune) oscillator.detune.setValueAtTime(detune, ctx.currentTime);

    // ADSR 엔벨로프 — 더 풍부한 잔향
    const attackTime = 0.005;
    const releaseTime = duration * 0.7; // 70%는 잔향
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.5, ctx.currentTime + attackTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("playTone 실패:", e);
  }
}

// 화음 재생 (여러 주파수를 동시에)
function playChord(freqs, duration = 0.3, type = "sine", volume = 0.2) {
  if (!isSoundEnabled()) return;
  freqs.forEach(freq => playTone(freq, duration, type, volume, 0));
}

// 반짝이는 고음 효과 (정답 시 매력 포인트)
function playSparkle() {
  if (!isSoundEnabled()) return;
  [1568, 2093, 2637].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.08, "sine", 0.12), i * 30);
  });
}

// 여러 톤을 시간차로 재생 (멜로디)
function playMelody(notes) {
  if (!isSoundEnabled()) return;
  notes.forEach((note, i) => {
    setTimeout(() => {
      playTone(note.freq, note.dur || 0.15, note.type || "sine", note.vol || 0.3);
    }, (note.delay || i * 80));
  });
}

// ══════════════════════════════════════════════════════════════════════════
//   사운드 프리셋 — 듀오링고 스타일
// ══════════════════════════════════════════════════════════════════════════

// 🎵 정답 — 풍부한 화음 + 반짝이는 고음 (C major chord 상승)
export function playCorrect() {
  // 1. 첫 음: 짧고 또렷 (C5)
  playMelody([
    { freq: 523.25, dur: 0.1, type: "triangle", vol: 0.25 },
  ]);
  // 2. 화음 폭발 (50ms 후): C-E-G 메이저 화음
  setTimeout(() => {
    playChord([523.25, 659.25, 783.99], 0.35, "sine", 0.18);
  }, 80);
  // 3. 반짝이는 고음 (150ms 후): 별 떨어지는 느낌
  setTimeout(() => playSparkle(), 150);
  // 4. 마무리 베이스 (200ms 후): 따뜻한 저음
  setTimeout(() => {
    playTone(261.63, 0.25, "sine", 0.15); // C4
  }, 200);
}

// 🎵 오답 — 마림바 같은 "동-동" + 화음 (위로의 느낌)
export function playWrong() {
  // 1. 첫 음: 둥근 마림바 톤
  playMelody([
    { freq: 261.63, dur: 0.15, type: "triangle", vol: 0.22 },  // C4
  ]);
  // 2. 하강 화음 (마이너): A minor
  setTimeout(() => {
    playChord([220, 261.63], 0.3, "triangle", 0.18);  // A3 + C4
  }, 100);
  // 3. 따뜻한 마무리
  setTimeout(() => {
    playTone(196, 0.4, "sine", 0.15, -5);  // G3, 약간 변조
  }, 220);
}

// 🎵 콤보 (3,5,10) — 아르페지오 + 화음 + 잔향
export function playCombo(count) {
  if (count >= 10) {
    // 10콤보: 화려한 4옥타브 아르페지오 + 빅 화음
    playMelody([
      { freq: 523.25, dur: 0.08, type: "triangle", vol: 0.22 },  // C5
      { freq: 659.25, dur: 0.08, type: "triangle", vol: 0.22, delay: 50 },  // E5
      { freq: 783.99, dur: 0.08, type: "triangle", vol: 0.22, delay: 100 },  // G5
      { freq: 1046.5, dur: 0.08, type: "triangle", vol: 0.22, delay: 150 },  // C6
    ]);
    // 빅 화음 폭발
    setTimeout(() => {
      playChord([523.25, 659.25, 783.99, 1046.5], 0.5, "sine", 0.18);
    }, 200);
    // 반짝 ×2
    setTimeout(() => playSparkle(), 250);
    setTimeout(() => playSparkle(), 400);
  } else if (count >= 5) {
    // 5콤보: 빠른 아르페지오 + 화음
    playMelody([
      { freq: 523.25, dur: 0.08, type: "triangle", vol: 0.22 },
      { freq: 659.25, dur: 0.08, type: "triangle", vol: 0.22, delay: 60 },
      { freq: 783.99, dur: 0.08, type: "triangle", vol: 0.22, delay: 120 },
    ]);
    setTimeout(() => {
      playChord([659.25, 783.99, 987.77], 0.4, "sine", 0.18);
    }, 160);
    setTimeout(() => playSparkle(), 200);
  } else if (count >= 3) {
    // 3콤보: 가벼운 트리오 + 미니 화음
    playMelody([
      { freq: 587.33, dur: 0.08, type: "triangle", vol: 0.22 },  // D5
      { freq: 698.46, dur: 0.08, type: "triangle", vol: 0.22, delay: 60 },  // F5
      { freq: 880, dur: 0.12, type: "triangle", vol: 0.25, delay: 120 },  // A5
    ]);
    setTimeout(() => {
      playChord([587.33, 698.46, 880], 0.3, "sine", 0.15);
    }, 150);
  }
}

// 🎵 게임 시작 — 짧은 알림음
export function playStart() {
  playMelody([
    { freq: 440, dur: 0.08, type: "sine", vol: 0.2 },
    { freq: 659.25, dur: 0.12, type: "sine", vol: 0.22, delay: 70 },
  ]);
}

// 🎵 게임 종료 — 점수에 따라 다른 팡파레
export function playFinish(score, total) {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 0.8) {
    // 우수 (80% 이상): 영화같은 팡파레
    // Part 1: 멜로디 라인 상승
    playMelody([
      { freq: 523.25, dur: 0.15, type: "triangle", vol: 0.28 },  // C5
      { freq: 659.25, dur: 0.15, type: "triangle", vol: 0.28, delay: 130 },  // E5
      { freq: 783.99, dur: 0.15, type: "triangle", vol: 0.28, delay: 260 },  // G5
    ]);
    // Part 2: 빅 화음 (500ms 후)
    setTimeout(() => {
      playChord([523.25, 659.25, 783.99, 1046.5], 0.6, "sine", 0.2);
    }, 400);
    // Part 3: 베이스 라인 (저음 동시에)
    setTimeout(() => {
      playTone(130.81, 0.7, "sine", 0.15);  // C3
      playTone(196, 0.7, "sine", 0.12);  // G3
    }, 420);
    // Part 4: 반짝 폭발
    setTimeout(() => playSparkle(), 500);
    setTimeout(() => playSparkle(), 700);
    setTimeout(() => playSparkle(), 900);
    // Part 5: 마무리 종소리 (1초 후)
    setTimeout(() => {
      playChord([1046.5, 1318.5], 0.8, "sine", 0.15);  // C6 + E6
    }, 1000);
  } else if (ratio >= 0.5) {
    // 보통 (50~80%): 밝은 마무리 + 잔향
    playMelody([
      { freq: 523.25, dur: 0.15, type: "triangle", vol: 0.25 },
      { freq: 659.25, dur: 0.15, type: "triangle", vol: 0.25, delay: 130 },
    ]);
    setTimeout(() => {
      playChord([523.25, 659.25, 783.99], 0.5, "sine", 0.18);
    }, 260);
    setTimeout(() => playSparkle(), 300);
  } else {
    // 아쉬움 (50% 미만): 따뜻한 위로 + 격려
    playMelody([
      { freq: 392, dur: 0.2, type: "triangle", vol: 0.22 },  // G4
      { freq: 440, dur: 0.2, type: "triangle", vol: 0.22, delay: 180 },  // A4
      { freq: 523.25, dur: 0.3, type: "triangle", vol: 0.25, delay: 360 },  // C5 (희망적)
    ]);
    setTimeout(() => {
      playChord([392, 523.25], 0.5, "sine", 0.15);
    }, 480);
  }
}

// 🎵 버튼 클릭 (가벼운 톡 사운드)
export function playClick() {
  playTone(800, 0.05, "sine", 0.15);
}

// ══════════════════════════════════════════════════════════════════════════
//   액션 효과 (CSS 애니메이션 트리거)
// ══════════════════════════════════════════════════════════════════════════

// 🎬 화면 흔들기 (정답/오답 강조)
export function shakeScreen(intensity = "soft") {
  if (typeof document === "undefined") return;
  const target = document.body;
  if (target.classList.contains("shake-active")) return; // 중복 방지

  target.classList.add("shake-active", `shake-${intensity}`);
  setTimeout(() => {
    target.classList.remove("shake-active", `shake-${intensity}`);
  }, intensity === "hard" ? 500 : 300);
}

// 🌟 별 튀기기 (정답 시 화면에 별이 튐)
export function burstStars(x = null, y = null) {
  if (typeof document === "undefined") return;
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: ${x !== null ? x : window.innerWidth / 2}px;
    top: ${y !== null ? y : window.innerHeight / 2}px;
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(container);

  const stars = ["⭐", "✨", "🌟", "💫"];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.textContent = stars[Math.floor(Math.random() * stars.length)];
    const angle = (Math.PI * 2 * i) / count;
    const distance = 80 + Math.random() * 60;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    star.style.cssText = `
      position: absolute;
      font-size: ${20 + Math.random() * 12}px;
      transition: all 0.7s cubic-bezier(0.2, 0.8, 0.3, 1);
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    container.appendChild(star);
    requestAnimationFrame(() => {
      star.style.transform = `translate(${tx - 50}%, ${ty - 50}%) rotate(${Math.random() * 360}deg) scale(0.3)`;
      star.style.opacity = "0";
    });
  }
  setTimeout(() => container.remove(), 800);
}

// 🔥 콤보 표시 (화면 중앙 큰 텍스트)
export function showCombo(count) {
  if (typeof document === "undefined") return;
  if (count < 3) return;

  const emoji = count >= 10 ? "🔥🔥🔥" : count >= 5 ? "🔥🔥" : "🔥";
  const color = count >= 10 ? "#ef4444" : count >= 5 ? "#f59e0b" : "#22c55e";

  const banner = document.createElement("div");
  banner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    font-size: 56px;
    font-weight: 900;
    color: ${color};
    text-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 20px ${color}66;
    pointer-events: none;
    z-index: 9998;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
    text-align: center;
    line-height: 1.1;
  `;
  banner.innerHTML = `${emoji}<br/><span style="font-size: 36px;">${count} COMBO!</span>`;
  document.body.appendChild(banner);

  requestAnimationFrame(() => {
    banner.style.transform = "translate(-50%, -50%) scale(1)";
  });

  setTimeout(() => {
    banner.style.transform = "translate(-50%, -120%) scale(0.7)";
    banner.style.opacity = "0";
    setTimeout(() => banner.remove(), 400);
  }, 800);
}

// 🎊 꽃가루 효과 (게임 종료 시 우수 점수)
export function triggerConfetti() {
  if (typeof document === "undefined") return;

  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#4f8ef7", "#a855f7", "#ec4899"];
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement("div");
    const size = 8 + Math.random() * 8;
    confetti.style.cssText = `
      position: absolute;
      left: ${Math.random() * 100}%;
      top: -20px;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() < 0.5 ? "50%" : "2px"};
      opacity: ${0.7 + Math.random() * 0.3};
      transform: rotate(${Math.random() * 360}deg);
      transition: top 2.5s linear, transform 2.5s linear, opacity 2.5s ease-out;
    `;
    container.appendChild(confetti);
    requestAnimationFrame(() => {
      confetti.style.top = `${100 + Math.random() * 20}%`;
      confetti.style.transform = `rotate(${720 + Math.random() * 360}deg) translateX(${(Math.random() - 0.5) * 200}px)`;
      confetti.style.opacity = "0";
    });
  }
  setTimeout(() => container.remove(), 2800);
}

// 📳 진동 (모바일만)
export function vibrate(pattern = 50) {
  if (typeof navigator === "undefined") return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

// ══════════════════════════════════════════════════════════════════════════
//   통합 헬퍼 — 게임에서 한 줄로 호출
// ══════════════════════════════════════════════════════════════════════════

// 정답 처리 (사운드 + 액션 + 진동 한 번에)
export function onCorrect(combo = 0) {
  playCorrect();
  burstStars();
  vibrate(50);
  if (combo >= 3) {
    setTimeout(() => {
      playCombo(combo);
      showCombo(combo);
    }, 200);
  }
}

// 오답 처리
export function onWrong() {
  playWrong();
  shakeScreen("soft");
  vibrate([80, 50, 80]);
}

// 게임 종료
export function onFinish(score, total) {
  playFinish(score, total);
  if (total > 0 && score / total >= 0.8) {
    triggerConfetti();
  }
}
