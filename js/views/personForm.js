import { RELATIONS, addPerson, updatePerson, deletePerson, getPerson, clearCacheFor } from "../storage.js";

export async function renderPersonForm(container, params) {
  const isEdit = !!params.id;

  container.innerHTML = `<div class="page"><div class="loading-row"><div class="spinner"></div> 불러오는 중...</div></div>`;

  let existing = null;
  if (isEdit) {
    try {
      existing = await getPerson(params.id);
    } catch (err) {
      container.innerHTML = `<div class="page"><div class="error-box">${err?.message || "불러오지 못했어요."}</div></div>`;
      return;
    }
    if (!existing) {
      container.innerHTML = `<div class="page"><div class="empty-state">사람을 찾을 수 없어요.</div></div>`;
      return;
    }
  }

  const state = {
    name: existing?.name || "",
    relation: existing?.relation || "가족",
    gender: existing?.gender || "female",
    calendarType: existing?.calendarType || "solar",
    birthDate: existing?.birthDate || "",
    birthTime: existing?.birthTime || "",
    timeUnknown: existing?.timeUnknown ?? false,
    memo: existing?.memo || "",
  };

  container.innerHTML = `
    <div class="page">
      <a href="#/" class="back-link">‹ 목록으로</a>
      <h2 style="margin:0 0 18px;">${isEdit ? "프로필 수정" : "새 프로필 추가"}</h2>

      <div class="field">
        <label for="f-name">이름</label>
        <input type="text" id="f-name" placeholder="예) 김서연" value="${state.name}" />
      </div>

      <div class="field">
        <label>나와의 관계</label>
        <div class="pill-group" id="f-relation">
          ${RELATIONS.map(
            (r) => `<button type="button" class="pill ${r === state.relation ? "active" : ""}" data-value="${r}">${r}</button>`
          ).join("")}
        </div>
      </div>

      <div class="field">
        <label>성별</label>
        <div class="pill-group" id="f-gender">
          <button type="button" class="pill ${state.gender === "female" ? "active" : ""}" data-value="female">여자</button>
          <button type="button" class="pill ${state.gender === "male" ? "active" : ""}" data-value="male">남자</button>
        </div>
      </div>

      <div class="field">
        <label>양력 / 음력</label>
        <div class="pill-group" id="f-calendar">
          <button type="button" class="pill ${state.calendarType === "solar" ? "active" : ""}" data-value="solar">양력</button>
          <button type="button" class="pill ${state.calendarType === "lunar" ? "active" : ""}" data-value="lunar">음력</button>
        </div>
      </div>

      <div class="field">
        <label for="f-date">생년월일</label>
        <input type="date" id="f-date" value="${state.birthDate}" />
      </div>

      <div class="field">
        <label for="f-time">출생 시각</label>
        <input type="time" id="f-time" value="${state.birthTime}" ${state.timeUnknown ? "disabled" : ""} />
        <div class="checkbox-row">
          <input type="checkbox" id="f-time-unknown" ${state.timeUnknown ? "checked" : ""} />
          <label for="f-time-unknown" style="margin:0;">출생 시각을 몰라요</label>
        </div>
        <div class="hint">시주(時柱) 없이도 해석은 가능하지만, 시각을 알면 더 정확한 풀이를 받을 수 있어요.</div>
      </div>

      <div class="field">
        <label for="f-memo">메모 (선택)</label>
        <textarea id="f-memo" placeholder="예) 회사 동료, 5월생">${state.memo}</textarea>
      </div>

      <div id="f-error" class="error-box" style="display:none;"></div>

      <button class="btn btn-primary" id="f-submit" style="margin-top:6px;">${isEdit ? "수정 완료" : "추가하기"}</button>
      ${isEdit ? `<button class="btn btn-danger" id="f-delete" style="margin-top:10px;">이 프로필 삭제</button>` : ""}
    </div>
  `;

  const relationGroup = container.querySelector("#f-relation");
  const genderGroup = container.querySelector("#f-gender");
  const calendarGroup = container.querySelector("#f-calendar");
  const timeInput = container.querySelector("#f-time");
  const timeUnknownBox = container.querySelector("#f-time-unknown");
  const errorBox = container.querySelector("#f-error");
  const submitBtn = container.querySelector("#f-submit");

  function wirePillGroup(group, key) {
    group.querySelectorAll(".pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state[key] = btn.dataset.value;
        group.querySelectorAll(".pill").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
  }
  wirePillGroup(relationGroup, "relation");
  wirePillGroup(genderGroup, "gender");
  wirePillGroup(calendarGroup, "calendarType");

  timeUnknownBox.addEventListener("change", () => {
    state.timeUnknown = timeUnknownBox.checked;
    timeInput.disabled = timeUnknownBox.checked;
    if (timeUnknownBox.checked) timeInput.value = "";
  });

  submitBtn.addEventListener("click", async () => {
    const name = container.querySelector("#f-name").value.trim();
    const birthDate = container.querySelector("#f-date").value;
    const birthTime = container.querySelector("#f-time").value;

    if (!name) return showError("이름을 입력해주세요.");
    if (!birthDate) return showError("생년월일을 입력해주세요.");

    const payload = {
      name,
      relation: state.relation,
      gender: state.gender,
      calendarType: state.calendarType,
      birthDate,
      birthTime,
      timeUnknown: state.timeUnknown,
      memo: container.querySelector("#f-memo").value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "저장 중...";
    errorBox.style.display = "none";

    try {
      if (isEdit) {
        await updatePerson(existing.id, payload);
        await clearCacheFor(`saju:${existing.id}`);
        await clearCacheFor(`compat:`);
      } else {
        await addPerson(payload);
      }
      location.hash = "#/";
    } catch (err) {
      showError(err?.message || "저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "수정 완료" : "추가하기";
    }
  });

  if (isEdit) {
    const deleteBtn = container.querySelector("#f-delete");
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`${existing.name}님의 프로필을 삭제할까요? 저장된 사주 풀이도 함께 사라져요.`)) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = "삭제 중...";
      try {
        await deletePerson(existing.id);
        await clearCacheFor(`saju:${existing.id}`);
        await clearCacheFor(`compat:`);
        location.hash = "#/";
      } catch (err) {
        showError(err?.message || "삭제에 실패했어요.");
        deleteBtn.disabled = false;
        deleteBtn.textContent = "이 프로필 삭제";
      }
    });
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
}
