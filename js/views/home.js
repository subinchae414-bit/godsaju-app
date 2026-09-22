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
  const tomorrowHref = personHref("/fortune/tomorrow");

  container.innerHTML = `
    <div class="page">
      <div class="hero-card">
        <div class="hero-photo"><img src="./img/dogs/main.jpg" alt="사주풀이 마스코트 강아지" /></div>
        <div class="hero-text">
          <div class="hero-title">오늘도 왔구나 멍! 🐾</div>
          <div class="hero-desc">우리 댕댕이가 봐주는 사주, 한번 볼까?</div>
        </div>
      </div>

      <div class="menu-grid">
        <a class="menu-card menu-yellow" href="${sajuHref}" data-menu="saju">
          <div class="menu-photo blob-a"><img src="./img/dogs/saju.jpg" alt="사주 보기" /></div>
          <div class="menu-title">사주 보기 <span class="menu-badge">🐾</span></div>
          <div class="menu-desc">용하다고 소문난 댕댕이 사주</div>
        </a>
        <a class="menu-card menu-green" href="#/compat" data-menu="compat">
          <div class="menu-photo blob-b"><img src="./img/dogs/compat.jpg" alt="궁합 보기" /></div>
          <div class="menu-title">궁합 보기 <span class="menu-badge">🐾</span></div>
          <div class="menu-desc">우리 사이는 몇 점?</div>
        </a>
        <a class="menu-card menu-purple" href="${todayHref}" data-menu="today">
          <div class="menu-photo blob-c"><img src="./img/dogs/today.jpg" alt="오늘 운세" /></div>
          <div class="menu-title">오늘 운세 <span class="menu-badge">🐾</span></div>
          <div class="menu-desc">오늘 하루는 어떨까?</div>
        </a>
        <a class="menu-card menu-peach" href="${tomorrowHref}" data-menu="tomorrow">
          <div class="menu-photo blob-d"><img src="./img/dogs/encourage.jpg" alt="내일 운세" /></div>
          <div class="menu-title">내일 운세 <span class="menu-badge">🐾</span></div>
          <div class="menu-desc">내일은 또 어떤 하루?</div>
        </a>
        <a class="menu-card menu-blue" href="${daewoonHref}" data-menu="daewoon">
          <div class="menu-photo blob-a"><img src="./img/dogs/daewoon.jpg" alt="대운 보기" /></div>
          <div class="menu-title">대운 보기 <span class="menu-badge">🐾</span></div>
          <div class="menu-desc">물 들어올 때 노 젓자</div>
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
}
