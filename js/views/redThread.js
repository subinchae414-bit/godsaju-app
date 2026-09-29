import { getPerson, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildRedThreadPrompt } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";
import { computeBazi } from "../sajuCalc.js";
import { confirmSpend, cancelledSpendHtml } from "../credits.js";

function initial(name) {
  return name?.trim()?.[0] || "?";
}

export async function renderRedThread(container, { id }) {
  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let person;
  try {
    person = await getPerson(id);
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "불러오지 못했어요."}</div></div>`;
    return;
  }

  if (!person) {
    container.innerHTML = `<div class="page"><div class="empty-state">사람을 찾을 수 없어요.</div></div>`;
    return;
  }

  const bazi = computeBazi(person);
  const cacheKey = `redthread:${id}`;

  container.innerHTML = `
    <div class="page">
      <a href="#/person/${id}/saju" class="back-link">‹ ${person.name}님 사주로</a>
      <div class="reading-header">
        <div class="person-avatar-wrap">
          <div class="person-avatar">${initial(person.name)}</div>
          <div class="paw-badge">🧵</div>
        </div>
        <div class="person-info">
          <div class="person-name" style="font-size:17px;">${person.name}님의 붉은 실 만들기</div>
          <div class="person-meta">나와 잘 맞는 인연 TOP 10</div>
        </div>
      </div>

      <div class="hint" style="margin:2px 2px 14px;">
        사주명리학적으로 잘 맞을 가능성이 높은 "이상적인 인연 유형"을 순위로 뽑아드려요.
        실제 특정 인물을 콕 집어주는 건 아니고, 오행·십신 궁합이 잘 맞는 성향을 알려드리는 거예요.
      </div>

      <div id="reading-area"></div>
      <div class="row-actions" id="regen-row" style="display:none;">
        <button class="btn btn-ghost" id="regen-btn">다시 풀이하기</button>
      </div>
    </div>
  `;

  const area = container.querySelector("#reading-area");
  const regenRow = container.querySelector("#regen-row");
  const regenBtn = container.querySelector("#regen-btn");

  regenBtn.addEventListener("click", () => attemptRun());

  if (!bazi.ok) {
    area.innerHTML = `<div class="error-box">${bazi.error}</div>`;
    return;
  }

  area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 저장된 결과를 확인하고 있어요...</div>`;
  let cached = null;
  try {
    cached = await getCachedReading(cacheKey);
  } catch {
    /* 캐시 조회 실패는 무시하고 새로 풀이한다 */
  }

  if (cached) {
    area.innerHTML = `<div class="reading">${renderMarkdown(cached.text)}</div>`;
    regenRow.style.display = "flex";
  } else {
    attemptRun();
  }

  function attemptRun() {
    if (!confirmSpend()) {
      area.innerHTML = cancelledSpendHtml();
      regenRow.style.display = "flex";
      return;
    }
    runReading();
  }

  async function runReading() {
    regenRow.style.display = "none";
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 붉은 실을 잇고 있어요...</div>`;

    let acc = "";

    try {
      const { system, user } = buildRedThreadPrompt(person);
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
      regenRow.style.display = "flex";
    } catch (err) {
      const message = err instanceof ClaudeApiError ? err.message : err?.message || "알 수 없는 오류가 발생했습니다.";
      area.innerHTML = `<div class="error-box">${message}</div>`;
      regenRow.style.display = "flex";
    }
  }
}
