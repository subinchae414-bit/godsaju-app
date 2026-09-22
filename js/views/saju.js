import { getPerson, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildPersonalPrompt } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";
import { computeBazi } from "../sajuCalc.js";
import { getSpaceId } from "../space.js";
import { FORTUNE_RANGES } from "../prompts.js";
import { confirmSpend, cancelledSpendHtml } from "../credits.js";

function initial(name) {
  return name?.trim()?.[0] || "?";
}

function pillarCell(label, p) {
  if (!p) return `<div class="pillar-cell"><div class="pillar-label">${label}</div><div class="pillar-value pillar-empty">시각 모름</div></div>`;
  return `
    <div class="pillar-cell">
      <div class="pillar-label">${label}</div>
      <div class="pillar-value">${p.ganZhiKo}</div>
      <div class="pillar-hanja">${p.ganZhiHanja}</div>
    </div>`;
}

function injectReadingDogs(area) {
  const reading = area.querySelector(".reading");
  if (!reading) return;

  const strengthHeading = Array.from(reading.querySelectorAll("h1, h2, h3")).find((el) => el.textContent.trim().includes("강점"));
  if (strengthHeading) {
    strengthHeading.insertAdjacentHTML(
      "afterend",
      `<div class="reading-dog-card">
        <img src="./img/dogs/strength.jpg" alt="강점 마스코트 강아지" />
        <div class="reading-dog-caption">이게 바로 너의 타고난 강점이야! 🐾</div>
      </div>`
    );
  }

  reading.insertAdjacentHTML(
    "beforeend",
    `<div class="reading-dog-card reading-dog-closing">
      <img src="./img/dogs/encourage.jpg" alt="응원하는 마스코트 강아지" />
      <div class="reading-dog-caption">여기까지가 오늘의 풀이야. 무슨 일이 있어도 힘내멍! 🐾</div>
    </div>`
  );
}

function renderBaziCard(bazi) {
  if (!bazi.ok) {
    return `<div class="error-box" style="margin-top:14px;">${bazi.error}</div>`;
  }
  const { pillars, wuxingCount, zodiac } = bazi;
  const wx = Object.entries(wuxingCount)
    .map(([k, v]) => `<span class="wx-chip wx-${k}">${k} ${v}</span>`)
    .join("");

  return `
    <div class="card bazi-card">
      <div class="section-title" style="margin:0 0 10px;">만세력 사주 조견표 🐾</div>
      <div class="pillar-grid">
        ${pillarCell("연주", pillars.year)}
        ${pillarCell("월주", pillars.month)}
        ${pillarCell("일주", pillars.day)}
        ${pillarCell("시주", pillars.time)}
      </div>
      <div class="wx-row">${wx}</div>
      <div class="hint" style="margin-top:8px;">${zodiac}띠 · 아래 해석은 이 간지를 바탕으로 작성돼요.</div>
    </div>`;
}

export async function renderSaju(container, params) {
  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let person;
  try {
    person = await getPerson(params.id);
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "불러오지 못했어요."}</div></div>`;
    return;
  }

  if (!person) {
    container.innerHTML = `<div class="page"><div class="empty-state">사람을 찾을 수 없어요.</div></div>`;
    return;
  }

  const cacheKey = `saju:${person.id}`;
  const bazi = computeBazi(person);

  container.innerHTML = `
    <div class="page">
      <a href="#/" class="back-link">‹ 목록으로</a>
      <div class="reading-header">
        <div class="person-avatar-wrap">
          <div class="person-avatar">${initial(person.name)}</div>
          <div class="paw-badge">🐾</div>
        </div>
        <div class="person-info">
          <div class="person-name" style="font-size:17px;">${person.name}</div>
          <div class="person-meta">${person.birthDate} · ${person.calendarType === "lunar" ? "음력" : "양력"}${
    person.timeUnknown ? " · 시각 모름" : person.birthTime ? " · " + person.birthTime : ""
  }</div>
        </div>
        <button class="icon-btn" id="edit-btn" title="수정">✎</button>
      </div>

      ${renderBaziCard(bazi)}

      <div class="section-title" style="margin:16px 2px 8px;">기간별 운세 보기 🐾</div>
      <div class="pill-group" style="margin-bottom:4px;">
        ${Object.entries(FORTUNE_RANGES)
          .map(([key, info]) => `<a class="pill" href="#/person/${person.id}/fortune/${key}">${info.label}</a>`)
          .join("")}
      </div>

      <div id="reading-area"></div>
      <div class="row-actions" id="regen-row" style="display:none;">
        <button class="btn btn-ghost" id="regen-btn">다시 풀이하기</button>
        <button class="btn btn-secondary" id="share-btn" style="display:none;">🐾 공유 링크 복사</button>
      </div>
    </div>
    <div class="toast" id="saju-toast"></div>
  `;

  container.querySelector("#edit-btn").addEventListener("click", () => {
    location.hash = `#/person/${person.id}/edit`;
  });

  const area = container.querySelector("#reading-area");
  const regenRow = container.querySelector("#regen-row");
  const regenBtn = container.querySelector("#regen-btn");
  const shareBtn = container.querySelector("#share-btn");
  const toastEl = container.querySelector("#saju-toast");

  regenBtn.addEventListener("click", () => attemptRun());

  shareBtn.addEventListener("click", async () => {
    const spaceId = getSpaceId();
    const shareUrl = `${location.origin}${location.pathname}#/share/${spaceId}/${person.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${person.name}님의 사주풀이`, url: shareUrl });
        return;
      } catch {
        /* 공유 취소 등은 무시하고 클립보드 복사로 대체 */
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("링크가 복사됐어요! 🐾");
    } catch {
      showToast(shareUrl);
    }
  });

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  function setHasReading(hasReading) {
    shareBtn.style.display = hasReading ? "inline-flex" : "none";
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
    injectReadingDogs(area);
    regenRow.style.display = "flex";
    setHasReading(true);
  } else {
    attemptRun();
  }

  function attemptRun() {
    if (!confirmSpend()) {
      area.innerHTML = cancelledSpendHtml();
      regenRow.style.display = "flex";
      setHasReading(false);
      return;
    }
    runReading();
  }

  async function runReading() {
    regenRow.style.display = "none";
    setHasReading(false);
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 사주를 풀이하고 있어요...</div>`;

    let acc = "";

    try {
      const { system, user } = buildPersonalPrompt(person);
      await streamMessage(system, user, (chunk) => {
        acc += chunk;
        area.innerHTML = `<div class="reading">${renderMarkdown(acc)}<span class="cursor-blink"></span></div>`;
      });
      area.innerHTML = `<div class="reading">${renderMarkdown(acc)}</div>`;
      injectReadingDogs(area);
      try {
        await setCachedReading(cacheKey, acc);
      } catch {
        /* 캐시 저장 실패는 조용히 넘어간다 (풀이 자체는 이미 화면에 표시됨) */
      }
      regenRow.style.display = "flex";
      setHasReading(true);
    } catch (err) {
      const message = err instanceof ClaudeApiError ? err.message : err?.message || "알 수 없는 오류가 발생했습니다.";
      area.innerHTML = `<div class="error-box">${message}</div>`;
      regenRow.style.display = "flex";
      setHasReading(false);
    }
  }
}
