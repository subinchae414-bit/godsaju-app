import { getPerson, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildFortunePrompt, FORTUNE_RANGES } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";
import { computeBazi, computeFortuneDays } from "../sajuCalc.js";

function initial(name) {
  return name?.trim()?.[0] || "?";
}

// 오늘 날짜 기준 캐시 키. 매일 바뀌어야 하는 운세라 날짜가 지나면 캐시가 자연히 무효화된다.
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderDaysCard(fortune) {
  if (!fortune.ok) {
    return `<div class="error-box" style="margin-top:14px;">${fortune.error}</div>`;
  }
  const cols = Math.min(fortune.days.length, 4);
  const cells = fortune.days
    .map(
      (d) => `
    <div class="pillar-cell">
      <div class="pillar-label">${d.label}</div>
      <div class="pillar-value">${d.pillar.ganZhiKo}</div>
      <div class="pillar-hanja">${d.tenGod}</div>
    </div>`
    )
    .join("");

  return `
    <div class="card bazi-card">
      <div class="section-title" style="margin:0 0 10px;">일진(日辰) 조견표 🐾</div>
      <div class="pillar-grid" style="grid-template-columns:repeat(${cols}, 1fr);">${cells}</div>
      <div class="hint" style="margin-top:8px;">본인 일간 기준 십신도 함께 표시돼요.</div>
    </div>`;
}

export async function renderFortune(container, { id, range }) {
  const rangeInfo = FORTUNE_RANGES[range];

  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  if (!rangeInfo) {
    container.innerHTML = `<div class="page"><div class="error-box">알 수 없는 운세 종류예요.</div></div>`;
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
  const fortune = computeFortuneDays(bazi, rangeInfo.days);
  const cacheKey = `fortune:${range}:${id}:${todayKey()}`;

  const tabs = Object.entries(FORTUNE_RANGES)
    .map(
      ([key, info]) =>
        `<a class="pill ${key === range ? "active" : ""}" href="#/person/${id}/fortune/${key}">${info.label}</a>`
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
          <div class="person-name" style="font-size:17px;">${person.name}님의 ${rangeInfo.label}</div>
          <div class="person-meta">오늘 기준</div>
        </div>
      </div>

      <div class="pill-group" style="margin:14px 0;">${tabs}</div>

      ${renderDaysCard(fortune)}

      <div id="reading-area"></div>
      <div class="row-actions" id="regen-row" style="display:none;">
        <button class="btn btn-ghost" id="regen-btn">다시 풀이하기</button>
      </div>
    </div>
  `;

  const area = container.querySelector("#reading-area");
  const regenRow = container.querySelector("#regen-row");
  const regenBtn = container.querySelector("#regen-btn");

  regenBtn.addEventListener("click", () => runReading());

  if (!bazi.ok || !fortune.ok) {
    return;
  }

  area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 저장된 운세를 확인하고 있어요...</div>`;
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
    runReading();
  }

  async function runReading() {
    regenRow.style.display = "none";
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 운세를 풀이하고 있어요...</div>`;

    let acc = "";

    try {
      const { system, user } = buildFortunePrompt(person, range);
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
