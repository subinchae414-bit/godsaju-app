import { deriveSpaceId, setSpaceId } from "../space.js";
import { isSupabaseConfigured } from "../supabaseClient.js";

export function renderLock(container, onUnlock) {
  const configWarning = isSupabaseConfigured()
    ? ""
    : `<div class="error-box" style="margin-bottom:16px;">
        Supabase가 아직 설정되지 않았어요. <code>js/supabaseConfig.js</code> 파일에 프로젝트 URL과 anon key를 입력한 뒤 다시 시도해주세요.
      </div>`;

  container.innerHTML = `
    <div class="page" style="padding-top:56px;">
      <div style="text-align:center;margin-bottom:26px;">
        <div style="font-size:44px;">🔮</div>
        <h2 style="margin:10px 0 6px;">사주풀이</h2>
        <div class="hint" style="font-size:13.5px;">
          가족·연인과 함께 쓸 PIN(비밀번호)을 입력하세요.<br/>
          같은 PIN을 입력하면 어떤 기기에서든 같은 사람 목록과 사주 풀이를 볼 수 있어요.
        </div>
      </div>

      ${configWarning}

      <div class="field">
        <label for="lock-pin">PIN / 비밀번호</label>
        <input type="password" id="lock-pin" placeholder="예) 우리가족0501" autocomplete="off" />
      </div>

      <div id="lock-error" class="error-box" style="display:none;"></div>

      <button class="btn btn-primary" id="lock-submit">입장하기</button>

      <div class="hint" style="margin-top:16px;">
        처음 쓰는 PIN이면 새로운 공간이 자동으로 만들어져요.<br/>
        PIN을 잊어버리면 그 공간의 데이터에는 다시 접근할 수 없으니 꼭 기억해두세요. (비밀번호 찾기 기능은 없어요)
      </div>
    </div>
  `;

  const input = container.querySelector("#lock-pin");
  const errorBox = container.querySelector("#lock-error");
  const submit = container.querySelector("#lock-submit");

  async function trySubmit() {
    const pin = input.value.trim();
    errorBox.style.display = "none";

    if (pin.length < 4) {
      errorBox.textContent = "PIN은 4자 이상 입력해주세요.";
      errorBox.style.display = "block";
      return;
    }

    submit.disabled = true;
    submit.textContent = "확인 중...";

    try {
      const spaceId = await deriveSpaceId(pin);
      setSpaceId(spaceId);
      onUnlock();
    } catch (err) {
      errorBox.textContent = "오류가 발생했어요: " + (err?.message || err);
      errorBox.style.display = "block";
      submit.disabled = false;
      submit.textContent = "입장하기";
    }
  }

  submit.addEventListener("click", trySubmit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySubmit();
  });
  input.focus();
}
