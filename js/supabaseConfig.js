// Supabase 프로젝트 정보를 입력하세요.
// Supabase 대시보드 > 프로젝트 선택 > Settings > API 에서 확인할 수 있습니다.
// - Project URL         -> SUPABASE_URL
// - anon / public API key -> SUPABASE_ANON_KEY
//
// 이 값들은 "공개되어도 되는" 키입니다 (Supabase의 anon key는 브라우저에 노출되는 것을 전제로 설계됨).
// 실제 데이터 보호는 사용자가 입력하는 PIN(공간 식별자)이 담당합니다. 자세한 내용은 README.md 참고.

export const SUPABASE_URL = "https://asgmpwwrsrdokhvayfpe.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_xhnGJIAdiuafXHGsOfRxCw_87pMotjj";
const SUPABASE_URL = "https://asgmpwwrsrdokhvayfpe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xhnGJIAdiuafXHGsOfrXCw_87pMotjj";

export const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);