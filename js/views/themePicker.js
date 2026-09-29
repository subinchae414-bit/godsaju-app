import { setTheme } from "../theme.js";

export function renderThemePicker(container, onSelect) {
  container.innerHTML = `
    <div class="page" style="padding-top:48px;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:40px;">🎨</div>
        <h2 style="margin:10px 0 12px;">테마를 골라주세요</h2>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="hint" style="font-size:13.5px;margin-top:0;text-align:center;">
          마음에 드는 테마로 시작해요.<br/>설정 화면에서 언제든 바꿀 수 있어요.
        </div>
      </div>

      <div class="theme-pick-grid">
        <button class="theme-pick-card" data-theme="dog">
          <img src="./img/dogs/main.jpg" alt="강아지 테마" />
          <div class="theme-pick-label">🐶 강아지 테마</div>
        </button>
        <button class="theme-pick-card" data-theme="fruit">
          <img src="./img/bg-summer.webp" alt="과일 테마" />
          <div class="theme-pick-label">🍉 과일 테마</div>
        </button>
      </div>
    </div>
  `;

  container.querySelectorAll(".theme-pick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTheme(btn.dataset.theme);
      onSelect();
    });
  });
}
