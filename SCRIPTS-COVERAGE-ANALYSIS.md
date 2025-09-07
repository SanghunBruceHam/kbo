# JSON 생성 스크립트 커버리지 분석 📊

## 🎯 GitHub Actions에서 실행되는 스크립트들

### ✅ **현재 실행되는 6개 npm 명령어**
```bash
npm run crawl               # 크롤링
npm run process            # 기본 데이터 처리 (중복 실행됨)
npm run parse-season-data  # 시즌 데이터 파싱
npm run generate-raw-records  # raw-game-records.json
npm run rank-matrix        # calc-magic-numbers.json
npm run analysis           # 모든 분석 스크립트
```

## 📋 **package.json의 모든 JSON 생성 스크립트들**

| 스크립트명 | 실행 파일 | GitHub Actions | 상태 |
|------------|-----------|----------------|------|
| **crawl** | kbo-python-working-crawler.py | ✅ 실행됨 | **포함** |
| **process** | 02_season-data-processor.js | ✅ 실행됨 (중복) | **포함** |
| **parse-season-data** | 03_season-data-parser.js | ✅ 실행됨 | **포함** |
| **generate-raw-records** | generate-raw-game-records.js | ✅ 실행됨 | **포함** |
| **rank-matrix** | 01_magic-number-calculator.js | ✅ 실행됨 | **포함** |
| **enhanced-dashboard** | stats-comprehensive-generator.js | ✅ analysis 안에서 실행 | **포함** |
| **weekly-analysis** | analysis-weekly.js | ✅ analysis 안에서 실행 | **포함** |
| **clutch-analysis** | analysis-clutch.js | ✅ analysis 안에서 실행 | **포함** |
| **home-away-analysis** | analysis-home-away.js | ✅ analysis 안에서 실행 | **포함** |
| **series-analysis** | analysis-series.js | ✅ analysis 안에서 실행 | **포함** |
| **monthly-analysis** | analysis-monthly.js | ✅ analysis 안에서 실행 | **포함** |
| **weekday-analysis** | analysis-weekday.js | ✅ analysis 안에서 실행 | **포함** |
| **stadium-analysis** | analysis-stadium.js | ✅ analysis 안에서 실행 | **포함** |

### 📦 **npm run analysis가 실행하는 하위 스크립트들**
```bash
npm run analysis = 
  npm run enhanced-dashboard +      # stats-comprehensive.json
  npm run weekly-analysis +         # analysis-weekly.json  
  npm run clutch-analysis +         # analysis-clutch.json
  npm run home-away-analysis +      # analysis-home-away.json
  npm run series-analysis +         # analysis-series.json
  npm run monthly-analysis +        # analysis-monthly.json
  npm run weekday-analysis +        # analysis-weekday.json
  npm run stadium-analysis          # analysis-stadium.json
```

## 🏗️ **실행 순서 매핑**

### **GitHub Actions 실행 플로우**
```
1. npm run crawl (크롤링)
   └── 2025-season-data-clean.txt 생성

2. npm run process (중복 실행)
   ├── api-data.json ✅
   ├── calc-standings.json ✅  
   └── calc-head-to-head.json ✅

3. npm run parse-season-data
   ├── 2025-season-games.json ✅
   └── 2025-team-stats.json ✅

4. npm run generate-raw-records
   └── raw-game-records.json ✅

5. npm run rank-matrix
   └── calc-magic-numbers.json ✅

6. npm run analysis
   ├── stats-comprehensive.json ✅ (enhanced-dashboard)
   ├── analysis-weekly.json ✅ (weekly-analysis)
   ├── analysis-clutch.json ✅ (clutch-analysis)  
   ├── analysis-home-away.json ✅ (home-away-analysis)
   ├── analysis-series.json ✅ (series-analysis)
   ├── analysis-monthly.json ✅ (monthly-analysis)
   ├── analysis-weekday.json ✅ (weekday-analysis)
   └── analysis-stadium.json ✅ (stadium-analysis)
```

## ✅ **결론: 100% 커버리지**

**모든 JSON 생성 스크립트가 GitHub Actions에 포함되어 있습니다!**

### 📊 **포함된 스크립트: 13개**
- 6개 직접 실행 스크립트
- 8개 `npm run analysis` 하위 스크립트 (enhanced-dashboard 포함)
- 1개 크롤링 스크립트

### 🎯 **생성되는 JSON: 15개**  
모든 필요한 JSON 파일이 정상적으로 생성됩니다.

### ⚠️ **발견된 이슈**
- `npm run process`가 **3번 실행됨** (10단계, 10-2단계에서 중복)
- 하지만 **기능적으로는 완벽**함

**답변: 네, 모든 JS 파일들이 GitHub Actions 워크플로우에 포함되어 있습니다!**