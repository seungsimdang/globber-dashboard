/**
 * 목업 서비스 레이어 전용 지연 시뮬레이션 유틸리티.
 *
 * 실제 네트워크 호출처럼 보이도록 모든 목업 요청(조회/검색/추가/수정/삭제)에 공통으로 적용한다.
 * 실제 백엔드 API로 전환되면 이 유틸리티 호출은 제거된다.
 */

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

/** 300~800ms 사이의 랜덤한 시간만큼 대기한다. */
export const mockDelay = (): Promise<void> => {
  const delayMs = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};
