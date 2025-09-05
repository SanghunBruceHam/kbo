# KBO 2025 프로젝트 종합 분석 문서

## 📋 프로젝트 개요
KBO(한국프로야구) 2025시즌 데이터 분석 및 매직넘버 계산 시스템

### 🎯 주요 기능
- **매직넘버 계산**: 각 팀의 플레이오프 진출 및 우승 매직넘버
- **실시간 순위표**: KBO 팀별 순위 및 경기 결과
- **상대전적 분석**: 팀간 직접 대결 기록
- **홈/원정 성적**: 구장별 팀 성적 분석
- **클러치 상황 분석**: 접전 상황에서의 팀 성적
- **시리즈 분석**: 연속 경기 성적 분석

## 📁 프로젝트 구조

### 🗂️ 루트 디렉토리
```
/
├── index.html                 # 메인 대시보드 페이지
├── README.md                  # 프로젝트 설명서
├── package.json              # Node.js 의존성 관리
├── robots.txt                # 검색엔진 크롤링 정책
├── sitemap.xml               # 사이트맵
└── rss.xml                   # RSS 피드
```

### 🧮 Magic Number 디렉토리
```
magic-number/
├── index.html               # 매직넘버 계산기 메인 페이지
├── css/                     # 스타일시트
├── js/                      # JavaScript 모듈
├── data/                    # 데이터 파일
├── history/                 # 과거 데이터 기록
├── icons/                   # PWA 아이콘
├── images/                  # 팀 로고 이미지
├── scripts/                 # 데이터 처리 스크립트
└── crawlers/               # 데이터 수집 도구
```

## 🔧 기술 스택

### Frontend
- **HTML5**: 시맨틱 마크업
- **CSS3**: 반응형 디자인, CSS Grid/Flexbox
- **JavaScript (ES6+)**: 모듈화된 클라이언트 사이드 로직
- **PWA**: Progressive Web App 기능

### Backend & Data
- **Node.js**: 서버사이드 처리
- **SQLite**: 로컬 데이터베이스
- **Python**: 데이터 크롤링 및 분석
- **JSON**: 데이터 교환 형식

### Automation
- **GitHub Actions**: CI/CD 파이프라인
- **Cron Jobs**: 정기적 데이터 업데이트
- **Shell Scripts**: 자동화 스크립트

## 📊 데이터 소스 및 처리

### 데이터 수집
- **KBO 공식 웹사이트**: 경기 결과 및 순위 데이터
- **실시간 크롤링**: Python 기반 자동 데이터 수집
- **데이터 검증**: 무결성 검사 및 오류 처리

### 데이터 처리 파이프라인
1. **Raw Data 수집** → `2025-season-data-clean.txt`
2. **파싱 및 정제** → `service-data.json`
3. **분석 처리** → 각종 분석 JSON 파일
4. **캐싱 및 백업** → `backup/`, `history/`

## 🚀 주요 기능 모듈

### 1. 매직넘버 계산 엔진
```javascript
// process-season-data.js
- 플레이오프 매직넘버 계산
- 우승 매직넘버 계산
- 엘리미네이션 넘버 계산
```

### 2. 데이터 분석 모듈
```javascript
// 분석 모듈들
- weekly-analysis.js      # 주간 성적 분석
- clutch-analysis.js      # 클러치 상황 분석
- home-away-analysis.js   # 홈/원정 분석
- series-analysis.js      # 시리즈 분석
```

### 3. 데이터베이스 관리
```javascript
// 데이터베이스 모듈
- create-kbo-database.js        # 기본 DB 생성
- enhanced-kbo-database.js      # 고급 분석용 DB
- kbo-data-analytics.js         # 데이터 분석 쿼리
```

### 4. UI 컴포넌트
```javascript
// 사용자 인터페이스
- script.js              # 메인 UI 로직
- error-monitor.js       # 에러 모니터링
- weekly-analysis-display.js # 분석 결과 표시
```

## 🔄 자동화 워크플로우

### GitHub Actions 워크플로우
```yaml
# .github/workflows/
- update-kbo-data.yml    # 데이터 자동 업데이트
- deploy.yml             # 배포 자동화
```

### 데이터 업데이트 주기
- **매일 23:30 KST**: 경기 결과 업데이트
- **실시간**: 매직넘버 재계산
- **주간**: 종합 분석 리포트 생성

## 📱 Progressive Web App (PWA)

### PWA 기능
- **오프라인 지원**: Service Worker 캐싱
- **설치 가능**: 홈 화면 추가
- **반응형 디자인**: 모바일 최적화
- **빠른 로딩**: 리소스 최적화

### 매니페스트
```json
{
  "name": "KBO 매직넘버 계산기",
  "short_name": "KBO 매직넘버",
  "start_url": "/magic-number/",
  "display": "standalone"
}
```

## 🔍 분석 및 통계

### 제공되는 분석
1. **팀 순위 및 매직넘버**
2. **홈/원정 성적 비교**
3. **최근 10경기 성적**
4. **팀간 상대전적**
5. **클러치 상황 승률**
6. **월별/요일별 성적**
7. **시리즈 승부 기록**

### 통계 지표
- **승률 (Win Rate)**
- **피타고리안 기댓값**
- **게임 차이 (Games Behind)**
- **매직넘버/엘리미네이션 넘버**

## 🛠️ 운영 및 유지보수

### 모니터링
- **에러 추적**: JavaScript 에러 모니터링
- **성능 측정**: 로딩 시간 및 응답성 모니터링
- **데이터 무결성**: 자동 검증 시스템

### 백업 및 복구
- **일일 백업**: 모든 데이터 파일 백업
- **버전 관리**: Git을 통한 코드 버전 관리
- **롤백 시스템**: 문제 발생시 이전 버전 복구

## 🌐 배포 및 접근

### 배포 환경
- **GitHub Pages**: 정적 사이트 호스팅
- **Custom Domain**: 사용자 친화적 URL
- **HTTPS**: 보안 연결 보장

### 접근 경로
- **메인 대시보드**: `/`
- **매직넘버 계산기**: `/magic-number/`
- **API 엔드포인트**: `/magic-number/data/`

## 📈 성능 최적화

### 프론트엔드 최적화
- **리소스 압축**: CSS/JS 미니파이
- **이미지 최적화**: 팀 로고 최적화
- **캐싱 전략**: 브라우저 캐시 활용

### 백엔드 최적화
- **데이터 캐싱**: JSON 파일 캐싱
- **효율적 쿼리**: SQLite 인덱스 활용
- **배치 처리**: 대용량 데이터 처리 최적화

## 🔮 향후 계획

### 기능 확장
- **예측 모델**: 머신러닝 기반 승부 예측
- **실시간 알림**: 중요 경기 결과 알림
- **상세 통계**: 선수별 개인 기록 추가

### 기술 개선
- **TypeScript 도입**: 타입 안정성 강화
- **테스트 자동화**: 유닛 테스트 및 통합 테스트
- **성능 모니터링**: APM 도구 도입

---

**📅 최종 업데이트**: 2025년 9월 5일
**👨‍💻 관리자**: SanghunBruceHam
**📧 문의**: GitHub Issues를 통한 문의