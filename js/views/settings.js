import { getApiKey, setApiKey } from "../storage.js";
import { setSpaceId } from "../space.js";
import { isSupabaseConfigured } from "../supabaseClient.js";

export function renderSettings(container) {
  const current = getApiKey();
  const configured = isSupabaseConfigured();

  container.innerHTML = `
    <div class="page">
      <h2 style="margin:6px 0 4px;">설정</h2>

      <div class="section-title" style="margin-top:12px;">Anthropic API 키</div>
      <div class="hint" style="margin-bottom:14px;">
        사주/궁합 풀이는 Anthropic Claude API를 브라우저에서 직접 호출해서 만들어져요.<br/>
        이 키는 결제와 연결된 정보라 <strong style="color:var(--gold);">사람 목록과 달리 다른 기기와 공유되지 않고</strong>,
        이 기기에만 저장돼요. 새 기기에서는 다시 입력해주세요.
      </div>

      <div class="field">
        <label for="s-key">Anthropic API 키</label>
        <input type="password" id="s-key" placeholder="sk-ant-..." value="${current}" autocomplete="off" />
        <div class="hint">
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:var(--gold);">console.anthropic.com</a>
          에서 API 키를 발급받을 수 있어요.
        </div>
      </div>

      <div id="s-msg" style="display:none;" class="hint"></div>

      <button class="btn btn-primary" id="s-save">저장</button>
      ${current ? `<button class="btn btn-danger" id="s-clear" style="margin-top:10px;">API 키 삭제</button>` : ""}

      <div class="section-title">공유 공간 (PIN)</div>
      <div class="card" style="margin-bottom:4px;">
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:12px;">
          이 기기는 지금 PIN으로 연결된 공유 공간에 접속해 있어요.
          같은 PIN을 입력한 다른 기기와 사람 목록·사주/궁합 풀이가 함께 보여요.
          ${
            configured
              ? ""
              : `<br/><span style="color:var(--rose);">⚠ Supabase 설정이 비어있어요. js/supabaseConfig.js를 채워주세요.</span>`
          }
        </div>
        <button class="btn btn-ghost" id="s-leave">다른 PIN으로 전환 / 잠그기</button>
      </div>

      <div class="section-title">데이터에 대해</div>
      <div class="card" style="font-size:13px;color:var(--text-dim);line-height:1.7;">
        등록한 프로필과 사주/궁합 풀이 결과는 PIN으로 연결된 Supabase 공간에 저장되어,
        같은 PIN을 입력하는 모든 기기·브라우저에서 함께 보여요.
        PIN은 비밀번호 찾기가 없으니 잊어버리지 않게 잘 보관해주세요.
      </div>
    </div>
  `;

  const input = container.querySelector("#s-key");
  const msg = container.querySelector("#s-msg");

  container.querySelector("#s-save").addEventListener("click", () => {
    setApiKey(input.value.trim());
    msg.textContent = "저장했어요.";
    msg.style.color = "var(--gold)";
    msg.style.display = "block";
    setTimeout(() => (msg.style.display = "none"), 2000);
  });

  const clearBtn = container.querySelector("#s-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      setApiKey("");
      location.reload();
    });
  }

  container.querySelector("#s-leave").addEventListener("click", () => {
    if (confirm("현재 공간에서 나갈까요? 다시 들어오려면 PIN을 입력해야 해요. (데이터는 그대로 남아있어요)")) {
      setSpaceId("");
      location.hash = "#/";
      location.reload();
    }
  });
}
