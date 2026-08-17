# apps

## web

- 작품 간 변수·리스트 공유 옵션에서 자동완성 지원
- 타임스탬프 오류 시 작품 목록에서 옵션 UI 보여지도록 수정
- 썸네일, BGM, 작품 간 공유할 변수·리스트 UI 수정
- BGM 시작/끝 시간 정해서 crop하는 기능 추가
- [optional] 작품 이동 시 `endTimestamp` 대신 `startTimestamp`가 이동되도록 수정

# packages

## core

- `shareVariables` 버그 수정

## kinetic

- `analyzeProject` 함수 구현
- `handleMultipleScenes` 함수 구현 (초시계 초기화하기 이전에 `__time__` += 초시계 값 추가)
- `guessProjectTimestamp` 함수 구현
