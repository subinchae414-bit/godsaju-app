// Claude API 클라이언트 (브라우저 직접 호출, 빌드 도구 없이 fetch 사용)
import { getApiKey } from "./storage.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5";

export class ClaudeApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ClaudeApiError("API 키가 설정되지 않았습니다. 설정 화면에서 Anthropic API 키를 입력해주세요.", 0);
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      stream: true,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok || !res.body) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new ClaudeApiError(
      detail || `Claude API 요청이 실패했습니다 (HTTP ${res.status}).`,
      res.status
    );
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
