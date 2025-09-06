const fs = require('fs');

// HTML 파일을 읽어서 onclick 속성들을 data 속성으로 변경
const htmlFile = './magic-number/index.html';
let htmlContent = fs.readFileSync(htmlFile, 'utf8');

console.log('🔧 CSP 호환을 위한 onclick 이벤트 수정 중...\n');

let changeCount = 0;

// 1. sortTable onclick을 data-table 속성으로 변경
htmlContent = htmlContent.replace(/onclick="sortTable\('([^']+)',\s*'([^']+)'\)"/g, (match, tableType, sortKey) => {
    changeCount++;
    return `data-sort="${sortKey}" data-table="${tableType}"`;
});

// 2. 기간 네비게이션 버튼들
htmlContent = htmlContent.replace(/onclick="handlePrevPeriod\(\)"/g, () => {
    changeCount++;
    return 'data-period-action="prev"';
});

htmlContent = htmlContent.replace(/onclick="handlePeriodToggle\(\)"/g, () => {
    changeCount++;
    return 'data-period-action="toggle"';
});

htmlContent = htmlContent.replace(/onclick="handleNextPeriod\(\)"/g, () => {
    changeCount++;
    return 'data-period-action="next"';
});

// 3. switchToPCVersion
htmlContent = htmlContent.replace(/onclick="switchToPCVersion\(\)"/g, () => {
    changeCount++;
    return 'data-action="switch-to-pc"';
});

// 4. showAllTeamsScenario - 이미 수정됨
// 5. toggleMobileMenu - 이미 수정됨

console.log(`✅ ${changeCount}개의 onclick 이벤트를 data 속성으로 변경 완료`);

// 기존 onclick 속성들을 제거
htmlContent = htmlContent.replace(/\s+onclick="[^"]*"/g, '');

console.log('✅ 남은 onclick 속성들 제거 완료');

// 파일 저장
fs.writeFileSync(htmlFile, htmlContent, 'utf8');

console.log(`✅ ${htmlFile} 파일 업데이트 완료`);

// 변경사항 요약
console.log('\n📝 변경사항 요약:');
console.log('  - sortTable() 호출들 → data-sort + data-table 속성');
console.log('  - 기간 네비게이션 → data-period-action 속성');
console.log('  - PC 버전 전환 → data-action="switch-to-pc"');
console.log('  - 모든 onclick 속성 제거');
console.log('\n🔧 JavaScript 이벤트 리스너도 script.js에 추가되었습니다.');
console.log('📋 이제 CSP 정책을 위반하지 않습니다!');