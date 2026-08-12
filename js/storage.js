// 데이터 저장소.
// - people / readings(사주·궁합 캐시): Supabase에 저장, PIN으로 파생된 space_id로 공유된다.
// - Anthropic API 키: 결제와 직결되는 정보라 동기화하지 않고 이 기기의 localStorage에만 저장한다.

import { getSupabase } from "./supabaseClient.js";
import { getSpaceId } from "./space.js";

export const RELATIONS = ["본인", "가족", "연인", "친구"];

function requireSpace() {
  const spaceId = getSpaceId();
  if (!spaceId) {
    throw new Error("잠금이 해제되지 않았어요. 처음 화면에서 PIN을 입력해주세요.");
  }
  return spaceId;
}

function rowToPerson(row) {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    gender: row.gender,
    calendarType: row.calendar_type,
    birthDate: row.birth_date,
    birthTime: row.birth_time ? row.birth_time.slice(0, 5) : "",
    timeUnknown: !!row.time_unknown,
    memo: row.memo || "",
    createdAt: row.created_at,
  };
}

export async function getPeople() {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("people")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToPerson);
}

export async function getPerson(id) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("people")
    .select("*")
    .eq("space_id", spaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPerson(data) : null;
}

export async function addPerson(person) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("people")
    .insert({
      space_id: spaceId,
      name: person.name.trim(),
      relation: person.relation,
      gender: person.gender,
      calendar_type: person.calendarType,
      birth_date: person.birthDate,
      birth_time: person.timeUnknown ? null : person.birthTime || null,
      time_unknown: !!person.timeUnknown,
      memo: person.memo || "",
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function updatePerson(id, patch) {
  const spaceId = requireSpace();
  const sb = getSupabase();

  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name.trim();
  if (patch.relation !== undefined) dbPatch.relation = patch.relation;
  if (patch.gender !== undefined) dbPatch.gender = patch.gender;
  if (patch.calendarType !== undefined) dbPatch.calendar_type = patch.calendarType;
  if (patch.birthDate !== undefined) dbPatch.birth_date = patch.birthDate;
  if (patch.timeUnknown !== undefined) dbPatch.time_unknown = !!patch.timeUnknown;
  if (patch.birthTime !== undefined || patch.timeUnknown !== undefined) {
    dbPatch.birth_time = patch.timeUnknown ? null : patch.birthTime || null;
  }
  if (patch.memo !== undefined) dbPatch.memo = patch.memo || "";

  const { data, error } = await sb
    .from("people")
    .update(dbPatch)
    .eq("space_id", spaceId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function deletePerson(id) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { error } = await sb.from("people").delete().eq("space_id", spaceId).eq("id", id);
  if (error) throw error;
}

// ---------- API 키 (기기별 저장, 동기화하지 않음) ----------

const API_KEY_KEY = "saju-app-api-key-v1";

export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || "";
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem(API_KEY_KEY, key.trim());
  } else {
    localStorage.removeItem(API_KEY_KEY);
  }
}

// ---------- 사주/궁합 해석 캐시 (공간 공유) ----------

export async function getCachedReading(key) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("readings")
    .select("content")
    .eq("space_id", spaceId)
    .eq("cache_key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? { text: data.content } : null;
}

export async function setCachedReading(key, value) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { error } = await sb
    .from("readings")
    .upsert({ space_id: spaceId, cache_key: key, content: value }, { onConflict: "space_id,cache_key" });
  if (error) throw error;
}

export async function clearCacheFor(prefix) {
  const spaceId = requireSpace();
  const sb = getSupabase();
  const { error } = await sb.from("readings").delete().eq("space_id", spaceId).like("cache_key", `${prefix}%`);
  if (error) throw error;
}
