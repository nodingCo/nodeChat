// src/api.js

import { SERVER_URL } from "./constants.js";

/**
 * 서버로부터 현재 핫한 노드 목록을 가져옵니다.
 * @returns {Promise<Array<Object>>} 핫 노드 데이터 배열을 반환하는 Promise.
 * @throws {Error} 네트워크 오류 또는 서버 응답 오류 발생 시.
 */
export async function fetchHotNodes() {
  try {
    // limit=5는 예시입니다. 필요에 따라 상수로 분리하거나 파라미터로 받을 수 있습니다.
    const response = await fetch(`${SERVER_URL}/hot-nodes?limit=5`);

    if (!response.ok) {
      // HTTP 상태 코드가 200-299 범위가 아닐 경우 에러 처리
      const errorText = await response.text(); // 서버에서 보낸 에러 메시지 확인
      console.error(
        `API: HTTP error! status: ${response.status}, response: ${errorText}`
      );
      throw new Error(`핫 노드 조회 실패: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API: 핫 노드 로드 중 예외 발생:", error);
    throw error; // 에러를 호출자에게 다시 던져 main.js에서 UI 처리하도록
  }
}

// ... 다른 서버 API 요청 함수들 (예: /recommendation 엔드포인트가 HTTP였다면 여기에 추가)
