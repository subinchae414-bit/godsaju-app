import { getPeople, RELATIONS } from "../storage.js";
import { RELATION_ICON, initial } from "../personDisplay.js";

const TARGETS = {
  saju: { title: "사주보기", hrefFor: (id) => `#/person/${id}/saju` },
  saeun: { title: "세운(연운)", hrefFor: (id) => `#/person/${id}/saeun/current` },
  daewoon: { title: "대운", hrefFor: (id) => `#/person/${id}/daewoon/early` },
  redthread: { title: "붉은 실 만들기", hrefFor: (id) => `#/person/${id}/redthread` },
};

export async function renderPickPerson(container, { target } = {}) {
  const config = TARGETS[target] || TARGETS.saju;

  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let people;
  try {
    people = await getPeople();
  } catch (err) {
    container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "데이터를 불러오지 못했어요."}</div></div>`;
    return;
  }

  if (people.length === 0) {
    container.innerHTML = `
      <div class="page">
        <h2 style="margin:6px 0 4px;">${config.title}</h2>
        <div class="empty-state">아직 등록된 사람이 없어요.<br/>먼저 프로필을 추가해주세요.</div>
        <button class="btn btn-primary" id="pick-add-btn" style="margin-top:14px;">＋ 프로필 추가하기</button>
      </div>
    `;
    container.querySelector("#pick-add-btn").addEventListener("click", () => {
      location.hash = "#/person/new";
    });
    return;
  }

  const grouped = RELATIONS.map((rel) => ({
    rel,
    people: people.filter((p) => p.relation === rel),
  })).filter((g) => g.people.length > 0);

  const listHtml = grouped
    .map(
      (g) => `
    <div class="section-title">${RELATION_ICON[g.rel] || ""} ${g.rel}</div>
    <div class="person-list">
      ${g.people
        .map(
          (p) => `
        <a class="person-row" href="${config.hrefFor(p.id)}" data-id="${p.id}">
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

  container.innerHTML = `
    <div class="page">
      <h2 style="margin:6px 0 4px;">${config.title}</h2>
      <div class="hint" style="margin-bottom:10px;">누구를 볼까요? 이름을 선택해주세요.</div>
      ${listHtml}
    </div>
  `;
}
