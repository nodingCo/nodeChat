import { translations } from "./constants.js";
import { generateRandomNickname, getUtmParameters } from "./utils.js";
import { fetchHotNodes } from "./api.js";
import {
  setLanguage,
  addSystemMessage,
  showChatScreen,
  showEntryScreen,
  updateRoomTitle,
  renderHotNodes,
  showLoadingHotNodes,
  showErrorLoadingHotNodes,
} from "./ui.js";
import {
  initializeSocket,
  emitUserSetup,
  emitJoinNodeAndLogTransition,
  emitSendMessage,
  emitGetRecommendation,
  getCurrentUser,
  getCurrentRoomKey,
  getNodeEntryTime,
  setCurrentRoomKey,
  setNodeEntryTime,
  setSocketCurrentLang,
} from "./socket.js";

// --- 상태 변수 (일부) ---
let currentLang = "en"; // 초기값 설정
const nicknameInput = document.getElementById("nickname-input");
const roomKeyInput = document.getElementById("room-key-input");
const entryButton = document.getElementById("entry-button");
const leaveButton = document.getElementById("leave-button");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const regenNicknameBtn = document.getElementById("regen-nickname-btn");

// --- 핵심 로직 함수들 (이벤트 핸들러 역할) ---

function setupUserIdentity() {
  let localId = localStorage.getItem("userLocalId");
  if (!localId) {
    localId = "user_" + Math.random().toString(36).substr(2, 16);
    localStorage.setItem("userLocalId", localId);
  }
  getCurrentUser().localId = localId; // socket.js의 currentUser 업데이트

  let storedNickname = localStorage.getItem("userNickname");
  let storedLang = localStorage.getItem("userLanguage");

  if (storedNickname && storedLang === currentLang) {
    nicknameInput.value = storedNickname;
  } else {
    nicknameInput.value = generateRandomNickname(currentLang);
  }
}

function goToNode(nodeKey, transitionType) {
  const currentUser = getCurrentUser();
  const currentRoomKey = getCurrentRoomKey();
  const nodeEntryTime = getNodeEntryTime();

  if (!nodeKey || !currentUser.id) return;

  const duration = nodeEntryTime
    ? Math.round((Date.now() - nodeEntryTime) / 1000)
    : 0;

  emitJoinNodeAndLogTransition({
    userId: currentUser.id,
    fromNodeKey: currentRoomKey,
    toNodeKey: nodeKey,
    duration: duration,
    transitionType: transitionType,
  });

  emitGetRecommendation(nodeKey); // 새 노드에 진입 후 추천 노드 요청
}

async function handleJoinChat() {
  const nickname = nicknameInput.value.trim();
  const roomKey = roomKeyInput.value.trim();
  const maxLength = currentLang === "ko" ? 10 : 20;

  if (!nickname || nickname.length > maxLength) {
    alert(translations[currentLang].alertNickname);
    return;
  }
  if (!roomKey) {
    alert(
      translations[currentLang].alertRoomKey || "Please enter a node title."
    );
    return;
  }

  getCurrentUser().nickname = nickname; // socket.js의 currentUser 업데이트
  localStorage.setItem("userNickname", nickname);
  localStorage.setItem("userLanguage", currentLang);

  const utmParams = getUtmParameters();
  emitUserSetup(getCurrentUser().localId, nickname, utmParams, currentLang);
}

function handleLeaveChat() {
  setCurrentRoomKey(null);
  setNodeEntryTime(null);
  showEntryScreen();
  loadHotNodes(); // 첫 화면으로 돌아갈 때 핫 노드 목록 다시 불러오기
}

function handleMessageInput() {
  const text = messageInput.value.trim();
  if (!text) return;

  if (text.startsWith("/go ")) {
    const nodeKey = text.substring(4).trim();
    if (nodeKey) goToNode(nodeKey, "GO_COMMAND");
  } else {
    emitSendMessage(text);
  }
  messageInput.value = "";
}

async function loadHotNodes() {
  showLoadingHotNodes(currentLang); // 로딩 메시지 표시
  try {
    const hotNodes = await fetchHotNodes();
    renderHotNodes(hotNodes, currentLang, handleJoinChat); // 핫 노드 렌더링
  } catch (error) {
    showErrorLoadingHotNodes(currentLang); // 에러 메시지 표시
  }
}

// --- 초기화 및 이벤트 리스너 설정 ---
document.addEventListener("DOMContentLoaded", () => {
  const userLang = navigator.language.split("-")[0];
  currentLang = translations[userLang] ? userLang : "en";
  setSocketCurrentLang(currentLang); // 소켓 모듈에 현재 언어 설정

  setLanguage(currentLang);
  setupUserIdentity();
  loadHotNodes(); // 페이지 로드 시 핫 노드 불러오기

  // Socket.IO 초기화 및 콜백 함수 전달
  initializeSocket({
    onSessionEstablished: (userId, nickname) => {
      // 세션이 확립되면 채팅 화면으로 이동
      const roomKey = roomKeyInput.value.trim();
      goToNode(roomKey, "INITIAL");
      showChatScreen();
    },
    goToNode: goToNode, // socket.js에서 추천 노드 클릭 시 goToNode를 호출할 수 있도록 전달
    getRecommendationNudge: (lang) => translations[lang].recommendationNudge,
  });

  // 이벤트 핸들러 연결
  entryButton.addEventListener("click", handleJoinChat);
  roomKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleJoinChat();
  });
  leaveButton.addEventListener("click", handleLeaveChat);
  sendButton.addEventListener("click", handleMessageInput);
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleMessageInput();
  });
  regenNicknameBtn.addEventListener("click", () => {
    nicknameInput.value = generateRandomNickname(currentLang);
  });
});
