# 🔧 코드 리팩토링 계획

## 즉시 제거 가능 (안전)
### script.js
- showNotification() 함수 - 사용 안 함
- getStatusIndicator() 함수 - 사용 안 함
- isChartAvailable 변수 - 사용 안 함

### simple-chart.js  
- handlePrevPeriod() - 사용 안 함
- handleNextPeriod() - 사용 안 함
- handlePeriodToggle() - 사용 안 함
- waitForChart() - 사용 안 함

## 변수 정리 필요
### 미사용 할당 변수들
\`\`\`javascript
// 예시: script.js
const { wins, losses, draws } = team; // wins, losses, draws 미사용
// 수정안:
const team = data.team; // 필요한 것만 사용
\`\`\`

## 에러 처리 개선
\`\`\`javascript
// 현재
} catch (error) {
    // error 미사용
}

// 개선
} catch {
    // 에러 변수 불필요시 생략
}
\`\`\`

## 함수 통합 제안
1. 중복 데이터 처리 함수들 통합
2. 유사한 차트 업데이트 함수 병합
3. 반복되는 DOM 조작 코드 모듈화

## 성능 최적화
1. 미사용 이벤트 리스너 제거
2. 불필요한 데이터 계산 제거
3. 조건부 로딩으로 초기 로드 개선
