import { renderHome } from "./views/home.js";
import { renderPersonForm } from "./views/personForm.js";
import { renderSaju } from "./views/saju.js";
import { renderCompat } from "./views/compat.js";
import { renderSettings } from "./views/settings.js";
import { renderLock } from "./views/lock.js";
import { getApiKey } from "./storage.js";
import { getSpaceId } from "./space.js";

const appEl = document.getElementById("app");

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const segments = hash.split("/").filter(Boolean);
  return segments;
}

function currentTab(segments) {
  if (segments[0] === "compat") return "compat";
  if (segments[0] === "settings") return "settings";
  return "home";
}

function renderTabbar(active) {
  const tabs = [
    { key: "home", label: "홈", icon: "🏠", href: "#/" },
    { key: "compat", label: "궁합", icon: "💞", href: "#/compat" },
    { key: "settings", label: "설정", icon: "⚙️", href: "#/settings" },
  ];
  return `
    <div class="tabbar">
      <div class="tabbar-inner">
        ${tabs
          .map(
            (t) => `
          <a class="tab ${t.key === active ? "active" : ""}" href="${t.href}">
            <span class="tab-icon">${t.icon}</span>
            <span>${t.label}</span>
          </a>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderTopbar() {
  return `
    <div class="topbar">
      <a class="brand" href="#/">
        <span class="mark">🔮</span>
        <span>사주풀이</span>
      </a>
      <a class="icon-btn" href="#/settings" title="설정">⚙️</a>
    </div>
  `;
}

function ensureApiKeyBanner() {
  if (getApiKey()) return "";
  return `
    <div class="page" style="padding-bottom:0;">
      <a href="#/settings" class="card" style="display:block;margin-bottom:2px;border-color:var(--gold);">
        <strong style="color:var(--gold);">API 키를 먼저 등록해주세요 →</strong>
        <div class="hint" style="margin-top:4px;">사주/궁합 풀이를 받으려면 Anthropic API 키가 필요해요.</div>
      </a>
    </div>
  `;
}

async function route() {
  if (!getSpaceId()) {
    appEl.innerHTML = "";
    const lockHost = document.createElement("div");
    appEl.appendChild(lockHost);
    renderLock(lockHost, () => route());
    return;
  }

  const segments = parseHash();
  const [first, second, third] = segments;

  const shell = document.createElement("div");
  shell.innerHTML = renderTopbar() + ensureApiKeyBanner();

  const contentHost = document.createElement("div");
  shell.appendChild(contentHost);

  appEl.innerHTML = "";
  appEl.appendChild(shell);

  const tabbarWrap = document.createElement("div");
  tabbarWrap.innerHTML = renderTabbar(currentTab(segments));
  appEl.appendChild(tabbarWrap.firstElementChild);

  if (!first) {
    await renderHome(contentHost);
  } else if (first === "person" && second === "new") {
    await renderPersonForm(contentHost, {});
  } else if (first === "person" && second && third === "edit") {
    await renderPersonForm(contentHost, { id: second });
  } else if (first === "person" && second && third === "saju") {
    await renderSaju(contentHost, { id: second });
  } else if (first === "compat") {
    await renderCompat(contentHost);
  } else if (first === "settings") {
    renderSettings(contentHost);
  } else {
    await renderHome(contentHost);
  }

  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
route();
