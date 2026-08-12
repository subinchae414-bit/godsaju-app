import { getPeople, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildCompatibilityPrompt } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";

export async function renderCompat(container) {
  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let people;
  try {
    people = await getPeople();
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "데이터를 불러오지 못했어요."}</div></div>`;
    return;
  }

  if (people.length < 2) {
    container.innerHTML = `
      <div class="page">
        <h2 style="margin:6px 0 4px;">궁합 보기</h2>
        <div class="empty-state">궁합을 보려면 두 명 이상의 프로필이 필요해요.<br/>홈 화면에서 사람을 먼저 추가해주세요.</div>
      </div>
    `;
    return;
  }

  const options = (selectedId) =>
    people.map((p) => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${p.name} (${p.relation})</option>`).join("");

  const defaultA = people[0].id;
  const defaultB = people.find((p) => p.id !== defaultA)?.id || people[1]?.id;

  container.innerHTML = `
    <div class="page">
      <h2 style="margin:6px 0 16px;">궁합 보기</h2>

      <div class="picker-row">
        <div class="field">
          <label for="c-a">첫 번째 사람</label>
          <select id="c-a">${options(defaultA)}</select>
        </div>
        <div class="heart">♥</div>
        <div class="field">
          <label for="c-b">두 번째 사람</label>
          <select id="c-b">${options(defaultB)}</select>
        </div>
      </div>

      <button class="btn btn-primary" id="c-run">궁합 보기</button>

      <div id="c-error" class="error-box" style="display:none;"></div>
      <div id="c-area"></div>
      <div class="row-actions" id="c-regen-row" style="display:none;">
        <button class="btn btn-ghost" id="c-regen-btn">다시 풀이하기</button>
      </div>
    </div>
  `;

  const selA = container.querySelector("#c-a");
  const selB = container.querySelector("#c-b");
  const runBtn = container.querySelector("#c-run");
  const area = container.querySelector("#c-area");
  const errorBox = container.querySelector("#c-error");
  const regenRow = container.querySelector("#c-regen-row");
  const regenBtn = container.querySelector("#c-regen-btn");

  runBtn.addEventListener("click", () => attemptRun());
  regenBtn.addEventListener("click", () => attemptRun(true));

  async function attemptRun(forceRegen) {
    errorBox.style.display = "none";
    const idA = selA.value;
    const idB = selB.value;

    if (!idA || !idB) return;
    if (idA === idB) {
      errorBox.textContent = "서로 다른 두 사람을 선택해주세요.";
      errorBox.style.display = "block";
      return;
    }

    const personA = people.find((p) => p.id === idA);
    const personB = people.find((p) => p.id === idB);
    const cacheKey = `compat:${[idA, idB].sort().join("_")}`;

    if (!forceRegen) {
      area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 저장된 궁합을 확인하고 있어요...</div>`;
      let cached = null;
      try {
        cached = await getCachedReading(cacheKey);
      } catch {
        /* 무시하고 새로 풀이 */
      }
      if (cached) {
        area.innerHTML = `<div class="reading">${renderMarkdown(cached.text)}</div>`;
        regenRow.style.display = "block";
        return;
      }
    }
    runReading(personA, personB, cacheKey);
  }

  async function runReading(personA, personB, cacheKey) {
    regenRow.style.display = "none";
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 두 분의 궁합을 살펴보고 있어요...</div>`;

    let acc = "";
    const { system, user } = buildCompatibilityPrompt(personA, personB);

    try {
      await streamMessage(system, user, (chunk) => {
        acc += chunk;
        area.innerHTML = `<div class="reading">${renderMarkdown(acc)}<span class="cursor-blink"></span></div>`;
      });
      area.innerHTML = `<div class="reading">${renderMarkdown(acc)}</div>`;
      try {
        await setCachedReading(cacheKey, acc);
      } catch {
        /* 캐시 저장 실패는 조용히 넘어간다 */
      }
      regenRow.style.display = "block";
    } catch (err) {
      const message = err instanceof ClaudeApiError ? err.message : err?.message || "알 수 없는 오류가 발생했습니다.";
      area.innerHTML = "";
      errorBox.textContent = message;
      errorBox.style.display = "block";
      regenRow.style.display = "block";
    }
  }

  // 캐시된 기본 조합이 있다면 바로 보여주기 (없다면 자동으로 새로 풀이하지는 않음)
  if (defaultA && defaultB) {
    showCachedIfAny(defaultA, defaultB);
  }

  async function showCachedIfAny(idA, idB) {
    const cacheKey = `compat:${[idA, idB].sort().join("_")}`;
    try {
      const cached = await getCachedReading(cacheKey);
      if (cached) {
        area.innerHTML = `<div class="reading">${renderMarkdown(cached.text)}</div>`;
        regenRow.style.display = "block";
      }
    } catch {
      /* 조용히 무시 */
    }
  }
}
