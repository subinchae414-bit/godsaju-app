// 화면 테마(강아지 / 과일) 선택 상태. 기기(로컬 브라우저) 단위로 저장되며,
// PIN 공간과는 무관하게 이 기기에서 항상 마지막으로 고른 테마를 기억한다.

const THEME_KEY = "saju-app-theme-v1";
export const THEMES = ["dog", "fruit"];

export function getTheme() {
  const t = localStorage.getItem(THEME_KEY);
  return THEMES.includes(t) ? t : "";
}

export function setTheme(theme) {
  if (THEMES.includes(theme)) {
    localStorage.setItem(THEME_KEY, theme);
  } else {
    localStorage.removeItem(THEME_KEY);
  }
}
