import { getPeople, RELATIONS } from "../storage.js";
import { playKeycapClick } from "../clickSound.js";

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

  const personHref = (suffix) => (people.length > 0 ? `#/person/${people[0].id}${suffix}` : "#/person/new");
  const sajuHref = personHref("/saju");
  const daewoonHref = personHref("/daewoon/early");
  const todayHref = personHref("/fortune/today");

  container.innerHTML = `
    <div class="page">
      <div class="hero-banner">
        <img class="hero-bg-photo" src="./img/dogs/main.jpg" alt="사주풀이 마스코트 강아지" />
        <div class="speech-bubble hero-speech">
          <div>어서와멍! 🐾</div>
          <div>키캡을 눌러봐라멍!</div>
        </div>
      </div>

      <div class="keycap-grid">
        <a class="keycap keycap-sky" href="${sajuHref}" data-menu="saju">
          <span class="keycap-fruit">💗⭐</span>
          <span class="keycap-caption"><span class="keycap-caption-icon">★</span><span class="keycap-label">사주보기</span></span>
        </a>
        <a class="keycap keycap-pink" href="#/compat" data-menu="compat">
          <span class="keycap-fruit">🍒💗</span>
          <span class="keycap-caption"><span class="keycap-caption-icon">♡</span><span class="keycap-label">궁합보기</span></span>
        </a>
        <a class="keycap keycap-yellow" href="${todayHref}" data-menu="today">
          <span class="keycap-fruit">🍉🍋</span>
          <span class="keycap-caption"><span class="keycap-caption-icon">☀</span><span class="keycap-label">오늘의 운세</span></span>
        </a>
        <a class="keycap keycap-lavender" href="${daewoonHref}" data-menu="daewoon">
          <span class="keycap-fruit">☁️⭐</span>
          <span class="keycap-caption"><span class="keycap-caption-icon">∞</span><span class="keycap-label">대운</span></span>
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
