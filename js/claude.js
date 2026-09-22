// Claude API 클라이언트.
// 브라우저가 Anthropic API를 직접 호출하지 않는다 — Supabase Edge Function(generate-reading)이
// 서버 쪽에서 API 키를 들고 대신 호출하고, space(PIN)의 남은 젤리(credits)도 거기서 확인·차감한다.
import { getSpaceId } from "./space.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-reading`;

export class ClaudeApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Claude에게 메시지를 보내고 텍스트 스트림을 받는다.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {(chunk: string) => void} onChunk - 텍스트 조각이 도착할 때마다 호출
 * @returns {Promise<string>} 전체 응답 텍스트
 */
export async function streamMessage(systemPrompt, userPrompt, onChunk) {
  const spaceId = getSpaceId();
  if (!spaceId) {
    throw new ClaudeApiError("잠금이 해제되지 않았어요. 처음 화면에서 PIN을 입력해주세요.", 0);
  }

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ spaceId, system: systemPrompt, user: userPrompt }),
  });

  if (!res.ok || !res.body) {
    let detail = "";
    let code = "";
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || "";
      code = errJson?.error?.code || "";
    } catch {
      /* ignore */
    }
    throw new ClaudeApiError(detail || `요청이 실패했어요 (HTTP ${res.status}).`, res.status, code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr) continue;
      let evt;
      try {
        evt = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        fullText += evt.delta.text;
        onChunk(evt.delta.text);
      } else if (evt.type === "error") {
        throw new ClaudeApiError(evt.error?.message || "스트리밍 중 오류가 발생했습니다.", 0);
      }
    }
  }

  return fullText;
}
