import { SOCKET_URL } from "./constants.js";
import {
  addMessageToLog,
  addSystemMessage,
  showChatScreen,
  clearChatLog,
  updateRoomTitle,
  setRecommendationButton,
} from "./ui.js";

let socket;
let currentUser = { id: null, localId: null, nickname: null };
let currentRoomKey = null;
let nodeEntryTime = null;
let currentLang = "en"; // main.js에서 설정될 예정

// 이벤트를 등록하기 위한 콜백 함수 저장
const eventCallbacks = {};

export function initializeSocket(callbacks) {
  socket = io(SOCKET_URL);

  Object.assign(eventCallbacks, callbacks); // 콜백 함수 저장

  socket.on("connect", () => {
    console.log(`[연결] Socket.IO 서버에 연결됨: ${socket.id}`);
  });

  socket.on("sessionEstablished", ({ userId, nickname }) => {
    currentUser.id = userId;
    currentUser.nickname = nickname;
    console.log("세션 연결 완료:", currentUser);
    if (eventCallbacks.onSessionEstablished) {
      eventCallbacks.onSessionEstablished(userId, nickname);
    }
  });

  socket.on("history", (messages) => {
    clearChatLog();
    messages.forEach((msg) => addMessageToLog(msg, currentUser.id));
    addSystemMessage(eventCallbacks.getRecommendationNudge(currentLang));
  });

  socket.on("receiveMessage", (message) => {
    addMessageToLog(message, currentUser.id);
  });

  socket.on("recommendationResult", ({ recommendedKey }) => {
    setRecommendationButton(recommendedKey, eventCallbacks.goToNode);
  });

  socket.on("disconnect", () => {
    console.log(`[연결 종료] Socket.IO 서버 연결 끊김: ${socket.id}`);
  });
}

export function emitUserSetup(localId, nickname, utm, lang) {
  currentLang = lang; // 현재 언어를 소켓 모듈에도 알려줌
  socket.emit("userSetup", { localId, nickname, utm });
}

export function emitJoinNodeAndLogTransition(data) {
  const { userId, fromNodeKey, toNodeKey, duration, transitionType } = data;
  socket.emit("joinNodeAndLogTransition", data);
  currentRoomKey = toNodeKey;
  nodeEntryTime = Date.now();
  updateRoomTitle(toNodeKey);
}

export function emitSendMessage(text) {
  if (!currentRoomKey || !currentUser.id) return;
  const messageData = {
    userId: currentUser.id,
    nodeKey: currentRoomKey,
    text: text,
  };
  socket.emit("sendMessage", messageData);
}

export function emitGetRecommendation(nodeKey) {
  socket.emit("getRecommendation", { roomKey: nodeKey });
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentRoomKey() {
  return currentRoomKey;
}

export function getNodeEntryTime() {
  return nodeEntryTime;
}

export function setCurrentRoomKey(key) {
  currentRoomKey = key;
}

export function setNodeEntryTime(time) {
  nodeEntryTime = time;
}

export function setSocketCurrentLang(lang) {
  currentLang = lang;
}
