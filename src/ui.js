// src/ui.js

import { translations } from "./constants.js";
import { formatTimestamp } from "./utils.js";

// --- DOM 요소 가져오기 (전역적으로 한 번만 가져옵니다) ---
const chatLog = document.getElementById("chat-log");
const hotNodesList = document.getElementById("hot-nodes-list");
const roomTitle = document.getElementById("room-title");
const nicknameInput = document.getElementById("nickname-input");
const roomKeyInput = document.getElementById("room-key-input");
const entryScreen = document.getElementById("entry-screen");
const chatScreen = document.getElementById("chat-screen");
const recommendBtn = document.getElementById("recommend-btn");

/**
 * 현재 언어에 따라 UI 텍스트를 설정합니다.
 * @param {string} lang - 현재 언어 코드 (예: 'ko', 'en').
 */
export function setLanguage(lang) {
  const langPack = translations[lang] || translations["en"];
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.dataset.i18nKey;
    const translation = langPack[key];
    if (translation) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = translation;
      } else {
        el.innerHTML = translation;
      }
    }
  });
}

/**
 * 채팅 로그에 메시지를 추가합니다.
 * @param {Object} message - 메시지 객체. (ex: { userId, senderNickname, text, createdAt })
 * @param {string} currentUserId - 현재 사용자의 ID.
 */
export function addMessageToLog(message, currentUserId) {
  const msgGroup = document.createElement("div");
  msgGroup.classList.add("message-group");

  const senderInfo = document.createElement("div");
  senderInfo.classList.add("sender-info");

  const timestampSpan = document.createElement("span");
  timestampSpan.classList.add("timestamp");
  timestampSpan.textContent = formatTimestamp(message.createdAt);

  const msgText = document.createElement("div");
  msgText.classList.add("message-text");
  msgText.textContent = message.text;

  const nicknameSpan = document.createElement("span");
  nicknameSpan.classList.add("nickname");
  nicknameSpan.textContent = message.senderNickname;

  senderInfo.appendChild(nicknameSpan);
  senderInfo.appendChild(timestampSpan);

  if (message.userId === currentUserId) {
    msgGroup.classList.add("sent");
  } else {
    msgGroup.classList.add("received");
  }

  msgGroup.appendChild(senderInfo);
  msgGroup.appendChild(msgText);
  chatLog.appendChild(msgGroup);
  chatLog.scrollTop = chatLog.scrollHeight;
}

/**
 * 채팅 로그에 시스템 메시지를 추가합니다.
 * @param {string} text - 시스템 메시지 텍스트.
 */
export function addSystemMessage(text) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("system-message");
  msgDiv.textContent = text;
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
}

/**
 * 채팅 로그를 비웁니다.
 */
export function clearChatLog() {
  chatLog.innerHTML = "";
}

/**
 * 채팅 화면을 표시하고 엔트리 화면을 숨깁니다.
 */
export function showChatScreen() {
  entryScreen.style.display = "none";
  chatScreen.style.display = "flex";
  roomKeyInput.value = ""; // 채팅방 진입 시 입력창 비우기
}

/**
 * 엔트리 화면을 표시하고 채팅 화면을 숨깁니다.
 */
export function showEntryScreen() {
  chatScreen.style.display = "none";
  entryScreen.style.display = "flex";
  clearChatLog(); // 엔트리 화면으로 돌아올 때 채팅 로그 비우기
}

/**
 * 채팅방 제목을 업데이트합니다.
 * @param {string} nodeKey - 현재 노드의 키.
 */
export function updateRoomTitle(nodeKey) {
  roomTitle.textContent = `🔒 ${nodeKey}`;
}

/**
 * 추천 노드 버튼의 가시성을 설정하고 클릭 이벤트를 바인딩합니다.
 * @param {string|null} recommendedKey - 추천 노드 키 (없으면 null).
 * @param {Function} goToNodeCallback - 추천 노드 클릭 시 호출할 콜백 함수.
 */
export function setRecommendationButton(recommendedKey, goToNodeCallback) {
  if (recommendedKey) {
    recommendBtn.style.display = "flex";
    recommendBtn.onclick = () =>
      goToNodeCallback(recommendedKey, "RECOMMENDATION");
  } else {
    recommendBtn.style.display = "none";
    recommendBtn.onclick = null; // 이벤트 리스너 제거
  }
}

/**
 * 핫 노드 목록을 렌더링합니다.
 * @param {Array<Object>} nodes - 핫 노드 데이터 배열.
 * @param {string} currentLang - 현재 언어 코드.
 * @param {Function} joinChatCallback - 노드 아이템 클릭 시 호출할 콜백 함수 (채팅 참여).
 */
export function renderHotNodes(nodes, currentLang, joinChatCallback) {
  hotNodesList.innerHTML = ""; // 기존 내용 제거

  if (nodes.length === 0) {
    hotNodesList.innerHTML = `<p>${
      translations[currentLang].noHotNodes || "아직 인기 노드가 없습니다."
    }</p>`;
    return;
  }

  nodes.forEach((node) => {
    const nodeItem = document.createElement("div");
    nodeItem.classList.add("hot-node-item");
    nodeItem.dataset.roomKey = node.roomKey;

    const statsText = translations[currentLang].nodeStats
      .replace("{visits}", node.totalVisits)
      .replace("{users}", node.uniqueUsersCount);

    nodeItem.innerHTML = `
          <span class="node-key">${node.roomKey}</span>
          <span class="node-stats">${statsText}</span>
      `;

    nodeItem.addEventListener("click", () => {
      roomKeyInput.value = node.roomKey;
      joinChatCallback(); // main.js에서 전달받은 콜백 함수 호출
    });

    hotNodesList.appendChild(nodeItem);
  });
}

/**
 * 핫 노드 로딩 메시지를 표시합니다.
 * @param {string} currentLang - 현재 언어 코드.
 */
export function showLoadingHotNodes(currentLang) {
  hotNodesList.innerHTML = `<p>${translations[currentLang].loadingHotNodes}</p>`;
}

/**
 * 핫 노드 로딩 실패 메시지를 표시합니다.
 * @param {string} currentLang - 현재 언어 코드.
 */
export function showErrorLoadingHotNodes(currentLang) {
  hotNodesList.innerHTML = `<p>${
    translations[currentLang].errorLoadingHotNodes ||
    "인기 노드를 불러오는데 실패했습니다."
  }</p>`;
}

// --- Getter/Setter for input elements (main.js에서 DOM 직접 접근을 최소화하기 위함) ---
export function getNicknameInputValue() {
  return nicknameInput.value;
}

export function setNicknameInputValue(value) {
  nicknameInput.value = value;
}

export function getRoomKeyInputValue() {
  return roomKeyInput.value;
}

export function setRoomKeyInputValue(value) {
  roomKeyInput.value = value;
}

export function getMessageInputValue() {
  return messageInput.value;
}

export function clearMessageInput() {
  messageInput.value = "";
}

// ... 기타 UI 관련 함수들 (필요하다면 추가)
