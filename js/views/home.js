import { getPeople, RELATIONS } from "../storage.js";
import { playKeycapClick } from "../clickSound.js";
import { RELATION_ICON, initial } from "../personDisplay.js";
import { getTheme } from "../theme.js";

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
  const saeunHref = personHref("saeun", "/saeun/current");
  const daewoonHref = personHref("daewoon", "/daewoon/early");
  const redThreadHref = personHref("redthread", "/redthread");

  const isDogTheme = getTheme() === "dog";

  const heroHtml = isDogTheme
    ? `
      <div class="dog-hero-card">
        <img class="dog-hero-avatar" src="./img/dogs/main.jpg" alt="사주풀이 마스코트 강아지" />
        <div class="dog-hero-text">
          <div class="dog-hero-title">오늘도 왔구나 멍! 🐾</div>
          <div class="dog-hero-sub">우리 댕댕이가 봐주는 사주, 한번 볼까?</div>
        </div>
      </div>`
    : "";

  const keycapGridHtml = isDogTheme
    ? `
      <div class="dog-menu-grid">
        <a class="dog-menu-card dog-menu-yellow" href="${sajuHref}" data-menu="saju">
          <img class="dog-menu-photo" src="./img/dogs/saju.jpg" alt="사주보기" />
          <div class="dog-menu-title">사주 보기 🐾</div>
          <div class="dog-menu-sub">용하다고 소문난 댕댕이 사주</div>
        </a>
        <a class="dog-menu-card dog-menu-green" href="#/compat" data-menu="compat">
          <img class="dog-menu-photo" src="./img/dogs/compat.jpg" alt="궁합보기" />
          <div class="dog-menu-title">궁합 보기 🐾</div>
          <div class="dog-menu-sub">우리 사이는 몇 점?</div>
        </a>
        <a class="dog-menu-card dog-menu-blue" href="${saeunHref}" data-menu="saeun">
          <img class="dog-menu-photo" src="./img/dogs/encourage.jpg" alt="연운보기" />
          <div class="dog-menu-title">연운 🐾</div>
          <div class="dog-menu-sub">올해는 어떤 기운이 흐를까?</div>
        </a>
        <a class="dog-menu-card dog-menu-purple" href="${daewoonHref}" data-menu="daewoon">
          <img class="dog-menu-photo" src="./img/dogs/daewoon.jpg" alt="대운보기" />
          <div class="dog-menu-title">대운 보기 🐾</div>
          <div class="dog-menu-sub">물 들어올 때 노 젓자</div>
        </a>
      </div>`
    : `
      <div class="keycap-grid">
        <a class="keycap keycap-img" href="${sajuHref}" data-menu="saju">
          <img src="./img/keycaps/saju.webp" alt="사주보기" />
        </a>
        <a class="keycap keycap-img" href="#/compat" data-menu="compat">
          <img src="./img/keycaps/gunghap.webp" alt="궁합보기" />
        </a>
        <a class="keycap keycap-img" href="${saeunHref}" data-menu="saeun">
          <img src="./img/keycaps/saeun.webp" alt="연운" />
        </a>
        <a class="keycap keycap-img" href="${daewoonHref}" data-menu="daewoon">
          <img src="./img/keycaps/daewoon.webp" alt="대운" />
        </a>
      </div>`;

  const redThreadHtml = `
    <a class="redthread-banner" href="${redThreadHref}" data-menu="redthread">
      <img class="redthread-icon" src="./img/redthread-icon.webp" alt="붉은 실 만들기" />
      <span class="redthread-text">
        <span class="redthread-title">붉은 실 만들기</span>
        <span class="redthread-sub">나와 잘 맞는 인연 TOP 10 찾기</span>
      </span>
      <span class="chevron">›</span>
    </a>`;

  container.innerHTML = `
    <div class="page">
      ${heroHtml}
      ${keycapGridHtml}
      ${redThreadHtml}

      <div class="section-title" style="margin-top:18px;">우리 아이들</div>
      ${listHtml}
    </div>
    <button class="fab" id="add-person-fab" aria-label="사람 추가">＋</button>
  `;

  container.querySelector("#add-person-fab").addEventListener("click", () => {
    location.hash = "#/person/new";
  });

  container.querySelectorAll(".keycap, .dog-menu-card, .redthread-banner").forEach((keycap) => {
    keycap.addEventListener("click", () => playKeycapClick());
  });
}
