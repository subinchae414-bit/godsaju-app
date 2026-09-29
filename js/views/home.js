import { getPeople, RELATIONS } from "../storage.js";
import { playKeycapClick } from "../clickSound.js";
import { RELATION_ICON, initial } from "../personDisplay.js";

export async function renderHome(container) {
  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let people;
  try {
    people = await getPeople();
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "데이터를 불러오지 못했어요."}</div></div>`;
    return;
  }

  const grouped = RELATIONS.map((rel) => ({
    rel,
    people: people.filter((p) => p.relation === rel),
  })).filter((g) => g.people.length > 0);

  const listHtml =
    people.length === 0
      ? `<div class="empty-state">아직 등록된 사람이 없어요.<br/>오른쪽 아래 + 버튼으로 첫 프로필을 추가해보세요.</div>`
      : grouped
          .map(
            (g) => `
        <div class="section-title">${RELATION_ICON[g.rel] || ""} ${g.rel}</div>
        <div class="person-list">
          ${g.people
            .map(
              (p) => `
            <a class="person-row" href="#/person/${p.id}/saju" data-id="${p.id}">
              <div class="person-avatar-wrap">
                <div class="person-avatar">${initial(p.name)}</div>
                <div class="paw-badge">🐾</div>
              </div>
              <div class="person-info">
                <div class="person-name">${p.name}</div>
                <div class="person-meta">${p.birthDate} · ${p.calendarType === "lunar" ? "음력" : "양력"}${
                p.timeUnknown ? "" : p.birthTime ? " · " + p.birthTime : ""
              }</div>
              </div>
              <div class="chevron">›</div>
            </a>`
            )
            .join("")}
        </div>`
          )
          .join("");

  const personHref = (target, suffix) => {
    if (people.length === 0) return "#/person/new";
    if (people.length === 1) return `#/person/${people[0].id}${suffix}`;
    return `#/pick/${target}`;
  };
  const sajuHref = personHref("saju", "/saju");
  const daewoonHref = personHref("daewoon", "/daewoon/early");
  const todayHref = personHref("today", "/fortune/today");

  container.innerHTML = `
    <div class="page">
      <div class="keycap-grid">
        <a class="keycap keycap-img" href="${sajuHref}" data-menu="saju">
          <img src="./img/keycaps/saju.webp" alt="사주보기" />
        </a>
        <a class="keycap keycap-img" href="#/compat" data-menu="compat">
          <img src="./img/keycaps/gunghap.webp" alt="궁합보기" />
        </a>
        <a class="keycap keycap-img" href="${todayHref}" data-menu="today">
          <img src="./img/keycaps/today.webp" alt="오늘의 운세" />
        </a>
        <a class="keycap keycap-img" href="${daewoonHref}" data-menu="daewoon">
          <img src="./img/keycaps/daewoon.webp" alt="대운" />
        </a>
      </div>

      <div class="section-title" style="margin-top:18px;">우리 아이들</div>
      ${listHtml}
    </div>
    <button class="fab" id="add-person-fab" aria-label="사람 추가">＋</button>
  `;

  container.querySelector("#add-person-fab").addEventListener("click", () => {
    location.hash = "#/person/new";
  });

  container.querySelectorAll(".keycap").forEach((keycap) => {
    keycap.addEventListener("click", () => playKeycapClick());
  });
}
