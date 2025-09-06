const fs = require('fs');

console.log('=== ESLint vs Coverage 미사용 함수 비교 ===\n');

// 우리가 이미 찾은 static analysis (analyze-unused-functions.js) 결과
const staticUnused = [
    'btnScrollHandler', 
    'btnClickHandler'
];

console.log('🔍 Static Analysis (함수 호출 패턴 분석):');
staticUnused.forEach(func => console.log(`  - ${func}()`));

// ESLint no-unused-vars에서 찾은 함수들 (JSON에서 추출)
const eslintUnused = [
    'isChartAvailable',
    'showNotification', 
    'sortTable',
    'getStatusIndicator',
    'determineCellData',
    'calculateMaintainRankMagic',
    'calculateChampionshipMagic', 
    'calculatePlayoffMagic',
    'calculateTragicNumber',
    'determineTeamStatus',
    'scrollToWeeklyAnalysis',
    'toggleMobileMenu',
    'smoothScrollTo',
    'canReachTop5'
];

console.log('\n📋 ESLint no-unused-vars:');
eslintUnused.forEach(func => console.log(`  - ${func}()`));

// Coverage에서 미실행으로 나온 주요 함수들
const coverageUnused = [
    'isChartAvailable',
    'getHomeAwayDisplay', 
    'getMagicNumberDisplay',
    'calculatePlayoffMagicNumber',
    'sortTable', 
    'sortStandingsTable',
    'sortPlayoffTable',
    'showDetailedScenarios',
    'shareOptions 관련 함수들',
    'showAllTeamsScenario'
];

console.log('\n📊 Coverage 미실행 (주요 함수들):');
coverageUnused.forEach(func => console.log(`  - ${func}()`));

// 교집합: ESLint + Coverage 둘 다에서 미사용으로 나온 함수들
const definitelyUnused = eslintUnused.filter(func => 
    // Coverage에서도 미실행된 것들만
    ['isChartAvailable', 'sortTable'].includes(func)
);

console.log('\n✅ 확실히 안 쓰는 함수들 (ESLint + Coverage 교집합):');
if (definitelyUnused.length === 0) {
    console.log('  없음 (대부분 이벤트 핸들러라 Coverage에서만 미실행)');
} else {
    definitelyUnused.forEach(func => console.log(`  - ${func}()`));
}

// Coverage에만 있는 것들 = 이벤트 핸들러나 사용자 인터랙션 함수들
const interactionFunctions = eslintUnused.filter(func => 
    !['isChartAvailable', 'sortTable'].includes(func)
);

console.log('\n🖱️ 사용자 인터랙션 함수들 (ESLint 미사용이지만 Coverage에서는 정의만 실행):');
interactionFunctions.forEach(func => console.log(`  - ${func}() - 버튼 클릭이나 이벤트에서 사용될 수 있음`));

// 실제로 HTML에서 사용되는지 확인해야 할 함수들
console.log('\n🔍 HTML 파일에서 확인 필요한 함수들:');
const needHTMLCheck = [
    'scrollToWeeklyAnalysis',
    'toggleMobileMenu', 
    'showDetailedScenarios',
    'smoothScrollTo'
];

needHTMLCheck.forEach(func => console.log(`  - ${func}() - onClick, onload 등에서 사용 가능성 체크 필요`));

console.log('\n📝 결론:');
console.log('1. isChartAvailable() - 확실히 삭제 가능');
console.log('2. sortTable() - 확실히 삭제 가능');
console.log('3. 나머지는 HTML에서 사용 여부 확인 후 결정');
console.log('4. Coverage 미실행 != 완전히 안 쓰는 함수');