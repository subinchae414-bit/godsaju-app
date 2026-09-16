// 사주풀이 앱의 Claude API 프록시.
// 브라우저는 더 이상 Anthropic API 키를 들고 있지 않는다 — 이 함수가 서버 쪽 비밀값
// (ANTHROPIC_API_KEY)으로 대신 호출하고, 요청한 space(PIN)의 남은 횟수(credits)를 확인·차감한다.
//
// 배포: supabase functions deploy generate-reading
// 비밀값 등록: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY는 Edge Functions에 기본으로 주입된다)

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MODEL = "claude-sonnet-4-6";

// 새로 생성되는 space(PIN)에게 주는 무료 체험 횟수. 필요하면 값만 바꾸세요.
const FREE_TRIAL_CREDITS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonError(message: string, status: number, code?: string) {
  return new Response(JSON.stringify({ error: { message, code } }), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("허용되지 않은 요청이에요.", 405);
  }
  if (!ANTHROPIC_API_KEY) {
    return jsonError("서버에 ANTHROPIC_API_KEY가 설정되지 않았어요. supabase secrets set 으로 등록해주세요.", 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("서버에 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY가 없어요.", 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError("요청 형식이 올바르지 않아요.", 400);
  }

  const { spaceId, system, user } = body || {};
  if (!spaceId || typeof spaceId !== "string" || !system || !user) {
    return jsonError("요청에 필요한 정보가 빠졌어요.", 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 처음 보는 space면 무료 체험 횟수로 credits 행을 만든다 (이미 있으면 그대로 둠).
  const { error: upsertErr } = await supabase
    .from("credits")
    .upsert({ space_id: spaceId, balance: FREE_TRIAL_CREDITS }, { onConflict: "space_id", ignoreDuplicates: true });
  if (upsertErr) {
    return jsonError(`잔여 횟수를 확인하지 못했어요: ${upsertErr.message}`, 500);
  }

  const { data: creditRow, error: selectErr } = await supabase
    .from("credits")
    .select("balance")
    .eq("space_id", spaceId)
    .maybeSingle();
  if (selectErr) {
    return jsonError(`잔여 횟수를 확인하지 못했어요: ${selectErr.message}`, 500);
  }

  const balance = creditRow?.balance ?? 0;
  if (balance <= 0) {
    return jsonError("사용 가능한 횟수를 모두 썼어요. 충전 후 다시 시도해주세요.", 402, "NO_CREDITS");
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system,
        stream: true,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return jsonError(`AI 서버에 연결하지 못했어요: ${detail}`, 502);
  }

  if (!anthropicRes.ok || !anthropicRes.body) {
    let detail = "";
    try {
      const errJson = await anthropicRes.json();
      detail = errJson?.error?.message || "";
    } catch {
      /* ignore */
    }
    return jsonError(detail || `AI 요청이 실패했어요 (HTTP ${anthropicRes.status}).`, anthropicRes.status);
  }

  // 스트림을 실제로 시작할 수 있었으니(=과금이 발생할 가능성이 생겼으니) 여기서 1회 차감한다.
  // 동시 요청 경합에 대해 완전히 원자적이진 않지만, 개인/소규모 공유 공간 규모에서는 충분하다.
  await supabase
    .from("credits")
    .update({ balance: balance - 1, updated_at: new Date().toISOString() })
    .eq("space_id", spaceId);

  return new Response(anthropicRes.body, {
    headers: { ...corsHeaders, "content-type": "text/event-stream" },
  });
});
