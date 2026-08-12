import { getPeople, RELATIONS } from "../storage.js";

const RELATION_ICON = {
  본인: "🧑",
  가족: "👨‍👩‍👧",
  연인: "💕",
  친구: "🤝",
};

function initial(name) {
  return name?.trim()?.[0] || "?";
}

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
              <div class="person-avatar">${initial(p.name)}</div>
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
      <div class="section-title" style="margin-top:6px;">오늘의 사주</div>
      <div class="card" style="margin-bottom:4px;">
        <div style="font-size:14px;color:var(--text-dim);line-height:1.6;">
          등록해둔 사람의 이름을 눌러 사주 풀이를 확인하고,<br/>
          하단의 <strong style="color:var(--gold);">궁합</strong> 탭에서 두 사람의 궁합도 볼 수 있어요.
        </div>
      </div>
      ${listHtml}
    </div>
    <button class="fab" id="add-person-fab" aria-label="사람 추가">＋</button>
  `;

  container.querySelector("#add-person-fab").addEventListener("click", () => {
    location.hash = "#/person/new";
  });
}
