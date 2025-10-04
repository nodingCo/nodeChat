import { adjectives, nouns } from "./constants.js";

export function generateRandomNickname(lang = "en") {
  const adjList = adjectives[lang] || adjectives["en"];
  const nounList = nouns[lang] || nouns["en"];
  const adj = adjList[Math.floor(Math.random() * adjList.length)];
  const noun = nounList[Math.floor(Math.random() * nounList.length)];
  return `${adj} ${noun}`;
}

export function formatTimestamp(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString(navigator.language, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getUtmParameters() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  if (params.has("utm_source")) utm.source = params.get("utm_source");
  // ...
  return utm;
}

// 기타 유틸리티 함수들
