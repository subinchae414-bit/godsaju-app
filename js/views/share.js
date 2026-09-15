// 링크만 있으면 PIN 없이도 볼 수 있는 읽기 전용 사주 풀이 공유 페이지.
// space_id(해시)와 person id를 URL에 그대로 담아 "링크를 아는 사람만" 볼 수 있게 하는
// 방식으로, 별도 로그인 없이 캐시된 풀이 결과만 읽기 전용으로 보여준다.

import { getPerson, getCachedReading } from "../storage.js";
import { renderMarkdown } from "../markdown.js";
import { computeBazi } from "../sajuCalc.js";
import { setSpaceId } from "../space.js";

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

function renderBaziCard(bazi) {
  if (!bazi.ok) return "";
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
      <div class="hint" style="margin-top:8px;">${zodiac}띠</div>
    </div>`;
}

function renderShell(bodyHtml) {
  return `
    <div class="topbar">
      <a class="brand" href="#/" data-fresh-start>
        <span class="mark">🐶</span>
        <span>사주풀이</span>
      </a>
    </div>
    <div class="page">
      ${bodyHtml}
      <a href="#/" class="card" style="display:block;margin-top:22px;text-align:center;" data-fresh-start>
        <strong style="color:var(--gold);">🐾 나도 사주풀이 받아보기 →</strong>
      </a>
    </div>
  `;
}

// 공유 페이지에서 벗어나 본 앱으로 갈 때는, 이 기기에 다른 사람(원 소유자)의 space가
// 이미 잠금 해제되어 있어도 그 기록을 그대로 보여주지 않고 PIN 입력부터 다시 시작한다.
// (같은 PIN을 다시 입력하면 즉시 원래 공간으로 복귀하므로 데이터 손실은 없다.)
function setShell(container, bodyHtml) {
  container.innerHTML = renderShell(bodyHtml);
  container.querySelectorAll("[data-fresh-start]").forEach((el) => {
    el.addEventListener("click", () => setSpaceId(""));
  });
}

export async function renderShare(container, { spaceId, personId }) {
  setShell(container, `<div class="loading-row"><div class="spinner"></div> 불러오는 중...</div>`);

  if (!spaceId || !personId) {
    setShell(container, `<div class="error-box">공유 링크가 올바르지 않아요.</div>`);
    return;
  }

  let person;
  try {
    person = await getPerson(personId, spaceId);
  } catch (err) {
    setShell(container, `<div class="error-box">${err?.message || "풀이를 불러오지 못했어요."}</div>`);
    return;
  }

  if (!person) {
    setShell(container, `<div class="empty-state">공유된 사주를 찾을 수 없어요.<br/>링크가 만료됐거나 삭제된 프로필일 수 있어요.</div>`);
    return;
  }

  let cached = null;
  try {
    cached = await getCachedReading(`saju:${personId}`, spaceId);
  } catch (err) {
    setShell(container, `<div class="error-box">${err?.message || "풀이를 불러오지 못했어요."}</div>`);
    return;
  }

  const bazi = computeBazi(person);

  const header = `
    <div class="reading-header">
      <div class="person-avatar-wrap">
        <div class="person-avatar">${initial(person.name)}</div>
        <div class="paw-badge">🐾</div>
      </div>
      <div class="person-info">
        <div class="person-name" style="font-size:17px;">${person.name}님의 사주</div>
        <div class="person-meta">${person.birthDate} · ${person.calendarType === "lunar" ? "음력" : "양력"}${
    person.timeUnknown ? " · 시각 모름" : person.birthTime ? " · " + person.birthTime : ""
  }</div>
      </div>
    </div>
  `;

  const body = cached
    ? `<div class="reading">${renderMarkdown(cached.text)}</div>`
    : `<div class="empty-state">아직 저장된 풀이가 없어요.<br/>원본 페이지에서 먼저 사주 풀이를 확인한 뒤 다시 공유해주세요.</div>`;

  setShell(container, header + renderBaziCard(bazi) + body);
}
