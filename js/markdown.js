// 아주 가벼운 마크다운 -> HTML 변환기 (헤더, 굵게, 목록, 문단만 지원)

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listBuffer = [];
  let inList = false;

  function flushList() {
    if (inList) {
      html.push("<ul>" + listBuffer.join("") + "</ul>");
      listBuffer = [];
      inList = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^\s*$/.test(line)) {
      flushList();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);

    if (h3) {
      flushList();
      html.push(`<h3>${inline(h3[1])}</h3>`);
    } else if (h2) {
      flushList();
      html.push(`<h2>${inline(h2[1])}</h2>`);
    } else if (h1) {
      flushList();
      html.push(`<h1>${inline(h1[1])}</h1>`);
    } else if (li) {
      inList = true;
      listBuffer.push(`<li>${inline(li[1])}</li>`);
    } else {
      flushList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();

  return html.join("\n");
}
