// PIN(비밀번호) 기반 "공유 공간" 식별자 관리.
// 같은 PIN을 입력하면 항상 같은 space_id가 만들어져서, 그 PIN을 아는 모든 기기가
// Supabase 상의 같은 데이터(people/readings)를 공유하게 된다.

const SPACE_KEY = "saju-app-space-id-v1";
const SALT = "saju-app-v1::"; // 동일 PIN이라도 다른 서비스와 해시가 겹치지 않도록 하는 고정 salt

export async function deriveSpaceId(pin) {
  const enc = new TextEncoder().encode(SALT + pin.trim());
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getSpaceId() {
  return localStorage.getItem(SPACE_KEY) || "";
}

export function setSpaceId(id) {
  if (id) {
    localStorage.setItem(SPACE_KEY, id);
  } else {
    localStorage.removeItem(SPACE_KEY);
  }
}
