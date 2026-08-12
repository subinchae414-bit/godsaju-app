import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js";

let client = null;

export function isSupabaseConfigured() {
  return (
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON_PUBLIC_KEY")
  );
}

export function getSupabase() {
  if (client) return client;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 아직 설정되지 않았어요. js/supabaseConfig.js 파일에 프로젝트 URL과 anon key를 입력해주세요."
    );
  }
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
  }

  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
