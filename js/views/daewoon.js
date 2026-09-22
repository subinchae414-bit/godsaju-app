import { getPerson, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildDaewoonPrompt, DAEWOON_PHASES } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";
import { computeBazi, computeDaewoon } from "../sajuCalc.js";
import { confirmSpend, cancelledSpendHtml } from "../credits.js";

function initial(name) {
  return name?.trim()?.[0] || "?";
}

function renderCyclesCard(daewoon, cycles) {
  if (!daewoon.ok) {
    return `<div class="error-box" style="margin-top:14px;">${daewoon.error}</div>`;
  }
  if (cycles.length === 0) {
    return `<div class="error-box" style="margin-top:14px;">이 시기에 해당하는 대운이 없어요.</div>`;
  }
  const cols = Math.min(cycles.length, 4);
  const cells = cycles
    .map(
      (c) => `
    <div class="pillar-cell">
      <div class="pillar-label">${c.startAge}~${c.endAge}세</div>
      <div class="pillar-value">${c.pillar.ganZhiKo}</div>
      <div class="pillar-hanja">${c.tenGod}</div>
    </div>`
    )
    .join("");

  return `
    <div class="card bazi-card">
      <div class="section-title" style="margin:0 0 10px;">대운(大運) 조견표 🐾</div>
      <div class="pillar-grid" style="grid-template-columns:repeat(${cols}, 1fr);">${cells}</div>
      <div class="hint" style="margin-top:8px;">${daewoon.forward ? "순행(順行)" : "역행(逆行)"} · 본인 일간 기준 십신도 함께 표시돼요.</div>
    </div>`;
}

export async function renderDaewoon(container, { id, phase }) {
  const phaseInfo = DAEWOON_PHASES[phase];

  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  if (!phaseInfo) {
    container.innerHTML = `<div class="page"><div class="error-box">알 수 없는 대운 시기예요.</div></div>`;
    return;
  }

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
  const daewoon = computeDaewoon(person);
  const cycles = daewoon.ok ? daewoon.cycles.filter((c) => phaseInfo.match(c.startAge)) : [];
  const cacheKey = `daewoon:${phase}:${id}`;

  const tabs = Object.entries(DAEWOON_PHASES)
    .map(
      ([key, info]) =>
        `<a class="pill ${key === phase ? "active" : ""}" href="#/person/${id}/daewoon/${key}">${info.label}</a>`
    )
    .join("");

  container.innerHTML = `
    <div class="page">
      <a href="#/person/${id}/saju" class="back-link">‹ ${person.name}님 사주로</a>
      <div class="reading-header">
        <div class="person-avatar-wrap">
          <div class="person-avatar">${initial(person.name)}</div>
          <div class="paw-badge">🐾</div>
        </div>
        <div class="person-info">
          <div class="person-name" style="font-size:17px;">${person.name}님의 ${phaseInfo.label}</div>
          <div class="person-meta">10년 단위 대운 흐름</div>
        </div>
      </div>

      <div class="pill-group" style="margin:14px 0;">${tabs}</div>

      ${renderCyclesCard(daewoon, cycles)}

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

  if (!bazi.ok || !daewoon.ok || cycles.length === 0) {
    return;
  }

  area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 저장된 풀이를 확인하고 있어요...</div>`;
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
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 대운을 풀이하고 있어요...</div>`;

    let acc = "";

    try {
      const { system, user } = buildDaewoonPrompt(person, phase);
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
