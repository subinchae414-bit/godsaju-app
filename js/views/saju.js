import { getPerson, getCachedReading, setCachedReading } from "../storage.js";
import { streamMessage, ClaudeApiError } from "../claude.js";
import { buildPersonalPrompt } from "../prompts.js";
import { renderMarkdown } from "../markdown.js";

function initial(name) {
  return name?.trim()?.[0] || "?";
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

  container.innerHTML = `
    <div class="page">
      <a href="#/" class="back-link">‹ 목록으로</a>
      <div class="reading-header">
        <div class="person-avatar">${initial(person.name)}</div>
        <div class="person-info">
          <div class="person-name" style="font-size:17px;">${person.name}</div>
          <div class="person-meta">${person.birthDate} · ${person.calendarType === "lunar" ? "음력" : "양력"}${
    person.timeUnknown ? " · 시각 모름" : person.birthTime ? " · " + person.birthTime : ""
  }</div>
        </div>
        <button class="icon-btn" id="edit-btn" title="수정">✎</button>
      </div>

      <div id="reading-area"></div>
      <div class="row-actions" id="regen-row" style="display:none;">
        <button class="btn btn-ghost" id="regen-btn">다시 풀이하기</button>
      </div>
    </div>
  `;

  container.querySelector("#edit-btn").addEventListener("click", () => {
    location.hash = `#/person/${person.id}/edit`;
  });

  const area = container.querySelector("#reading-area");
  const regenRow = container.querySelector("#regen-row");
  const regenBtn = container.querySelector("#regen-btn");

  regenBtn.addEventListener("click", () => runReading());

  area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 저장된 풀이를 확인하고 있어요...</div>`;
  let cached = null;
  try {
    cached = await getCachedReading(cacheKey);
  } catch {
    /* 캐시 조회 실패는 무시하고 새로 풀이한다 */
  }

  if (cached) {
    area.innerHTML = `<div class="reading">${renderMarkdown(cached.text)}</div>`;
    regenRow.style.display = "block";
  } else {
    runReading();
  }

  async function runReading() {
    regenRow.style.display = "none";
    area.innerHTML = `<div class="loading-row"><div class="spinner"></div> 사주를 풀이하고 있어요...</div>`;

    let acc = "";
    const { system, user } = buildPersonalPrompt(person);

    try {
      await streamMessage(system, user, (chunk) => {
        acc += chunk;
        area.innerHTML = `<div class="reading">${renderMarkdown(acc)}<span class="cursor-blink"></span></div>`;
      });
      area.innerHTML = `<div class="reading">${renderMarkdown(acc)}</div>`;
      try {
        await setCachedReading(cacheKey, acc);
      } catch {
        /* 캐시 저장 실패는 조용히 넘어간다 (풀이 자체는 이미 화면에 표시됨) */
      }
      regenRow.style.display = "block";
    } catch (err) {
      const message = err instanceof ClaudeApiError ? err.message : err?.message || "알 수 없는 오류가 발생했습니다.";
      area.innerHTML = `<div class="error-box">${message}</div>`;
      regenRow.style.display = "block";
    }
  }
}
