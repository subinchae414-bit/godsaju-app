// 키캡을 누를 때 나는 짧은 "딸깍" 효과음. 오디오 파일 없이 Web Audio API로 그 자리에서
// 합성한다 — 별도 사운드 에셋이 필요 없고, 브라우저 자동재생 제한에도 안전하다
// (사용자의 실제 클릭 제스처 안에서만 호출되므로).

let audioCtx = null;

export function playKeycapClick() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.03);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    /* 오디오를 지원하지 않는 환경은 조용히 무시 */
  }
}
