export const RELATION_ICON = {
  본인: "🧑",
  가족: "👨‍👩‍👧",
  연인: "💕",
  친구: "🤝",
};

export function initial(name) {
  return name?.trim()?.[0] || "?";
}
