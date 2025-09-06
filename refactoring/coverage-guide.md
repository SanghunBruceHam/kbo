# 📊 Chrome DevTools Coverage 측정 가이드

## 1. Coverage 탭 열기
1. Chrome에서 사이트 열기: `http://localhost:8080` 또는 실제 사이트
2. **F12** 또는 **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows)
3. **⋮** 메뉴 → **More tools** → **Coverage**
4. 또는 **Cmd+Shift+P** → "Coverage" 검색

## 2. Coverage 측정 시작
1. Coverage 탭에서 **🔴 Record** 버튼 클릭
2. **⟳ Reload** 버튼 클릭하여 페이지 새로고침
3. 페이지의 모든 기능 사용:
   - 모든 탭 클릭
   - 차트 조작
   - 정렬 기능 사용
   - 스크롤
   - 버튼 클릭

## 3. 결과 분석
- **빨간색 바**: 사용되지 않은 코드
- **초록색 바**: 사용된 코드
- **퍼센트**: 사용되지 않은 코드 비율

## 4. 상세 분석
1. 파일 클릭하여 상세 보기
2. 빨간색 라인 = 미사용 코드
3. 초록색 라인 = 사용된 코드

## 5. 최적화 포인트
- 50% 이상 미사용 = 분리 고려
- 완전 미사용 함수 = 제거 대상
- 조건부 로딩 가능한 코드 식별

## 예시 스크린샷 생성 명령
\`\`\`bash
# Coverage 리포트 저장
1. Coverage 탭에서 Export 버튼 클릭
2. JSON 파일로 저장
3. 분석 도구로 시각화
\`\`\`
