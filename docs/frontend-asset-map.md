# Frontend Asset Map

_Last updated: 2025-08-05_

이 문서는 주요 스타일시트와 자바스크립트 자산이 어디에서 로드되고, 어떤 역할을 담당하는지 정리합니다. 향후 리팩토링이나 유지보수 시 위치를 빠르게 파악할 수 있도록 사용하세요.

## 1. 루트 대시보드 (`/index.html`)
- **공통 폰트 & 테마 링크**: `index.html:529-530` — Google Fonts와 함께 `css/styles.css`를 링크합니다.
- **주요 인라인 스타일 블록**:
  - `index.html:530-858` — 전체 리셋, CSS 변수, 카드/레이아웃 기본 정의.
  - `index.html:4408-4525`, `index.html:4591-4639`, `index.html:12238-12343`, `index.html:18417-18430` 등 — 섹션 전용 스타일(표, 네비게이션, 모달, 접근성 등).
- **주요 스크립트 로드 지점**:
  - `index.html:15594` — `magic-number/scripts/ui-charts.js` (차트 렌더링 재사용).
  - 다수의 로컬 로직이 문서 하단(~`index.html:5200` 이후)에 인라인 `<script>`로 배치되어 순위표, 통계 패널 등을 렌더링합니다.
- **주요 데이터 fetch**: `index.html:6606-6662` — 주차별/게임별 JSON 로드.

## 2. 매직넘버 페이지 (`/magic-number/index.html`)
- **공통 스타일 링크**: `magic-number/index.html:1027` — `magic-number/css/styles.css` 로드.
- **인라인 스타일 블록**:
  - `magic-number/index.html:89-218` — 카드 레이아웃, 색상 변수, 매트릭스 기본 스타일.
  - `magic-number/index.html:1277-1305`, `magic-number/index.html:1842-1897`, `magic-number/index.html:2201-2245` — 챔피언십 섹션, 매직 매트릭스, 헤더 배지 등 세부 스타일.
- **스크립트 로드**:
  - `magic-number/index.html:2170-2176` — `scripts/util-error-monitor.js`, `scripts/ui-main.js`, `scripts/ui-charts.js`.
  - `magic-number/index.html` 하단에 `scripts/ui-magic-matrix-optimized.js` 및 `scripts/ui-magic-matrix.js`가 defer로 포함됨(현재 HTML 주석/활성화 상태 확인 필요).
- **데이터 소스**: 대부분 `magic-number/data/*.json`을 fetch 하며, 매직/트래직 계산은 `ui-main.js` 내부 로직이 담당.

## 3. 공유 스타일시트
- `css/styles.css` — 루트 대시보드에서 사용하는 공통 변수와 카드/테이블 스타일, 최근에 옮긴 포커스 아웃라인 규칙 (`css/styles.css:1769` 인근).
- `magic-number/css/styles.css` — 매직넘버 전용 테마. 루트와 유사한 변수들이 중복되어 있음.
- `css/styles.css` — 모바일 스티키 컬럼/매트릭스/중계사 테이블 스타일 포함 (`css/styles.css:1438` 이후, 기존 `index.html` 인라인 블록에서 이동) 및 팀별 경기 소화율 카드 스타일(`css/styles.css:1536` 부근).

## 4. 브라우저 실행 스크립트
- `magic-number/scripts/ui-main.js` — 매직넘버 페이지의 메인 UI/데이터 렌더러. HTML 템플릿 문자열에서 많은 인라인 스타일을 출력.
- `magic-number/scripts/ui-charts.js` — 양쪽 페이지에서 공용으로 사용하는 Chart.js 초기화 및 커스텀 레전드 로직.
- `magic-number/scripts/ui-magic-matrix.js` & `ui-magic-matrix-optimized.js` — 매직/트래직 넘버 매트릭스 계산과 사전계산본 렌더러.
- 루트 `index.html` 하단 인라인 스크립트 — standings, 일정, 필터링, 접근성 개선 등을 모두 포함.

## 5. Node 기반 데이터/빌드 스크립트
- `magic-number/scripts/*.js` (예: `02_season-data-processor.js`, `analysis-*.js`) — 데이터 정제/분석 파이프라인.
- 루트 `scripts/` 폴더 — UI 사전계산(`generate-ui-precomputed-data.js`), 퍼포먼스 체크(`quick-performance-check.js`), HTML 통합 헬퍼 등.

## 6. 개선 메모
- 스타일 중복을 줄이기 위해 `css/styles.css` ↔ 인라인 블록 ↔ `magic-number/css/styles.css` 간 변수를 통합할 계획(로드맵 Phase 3 참고).
- JS 모듈화를 위해 향후 Vite 기반 빌드로 각 페이지 스크립트를 묶고, 인라인 로직을 `web/src/` 구조로 분리 예정.

필요한 섹션이나 파일이 늘어나면 이 문서에 위치와 역할을 추가해 주세요.
