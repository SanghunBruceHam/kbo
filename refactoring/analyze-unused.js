const fs = require('fs');
const path = require('path');

// 사용되는 파일들
const usedFiles = new Set();
const allFiles = new Set();

// Root index.html에서 사용하는 JSON
const rootJsonFiles = [
    'magic-number/data/kbo-records.json',
    'magic-number/data/enhanced-dashboard.json',
    'magic-number/data/service-data.json',
    'magic-number/data/2025-season-schedule-complete.txt',
    'magic-number/data/game-by-game-records.json',
    'magic-number/data/weekly-analysis.json',
    'magic-number/data/clutch-analysis.json',
    'magic-number/data/home-away-analysis.json',
    'magic-number/data/series-analysis.json',
    'magic-number/data/2025-season-data-clean.txt'
];

// Magic-number index.html에서 사용하는 JS
const magicJsFiles = [
    'magic-number/scripts/error-monitor.js',
    'magic-number/scripts/script.js',
    'magic-number/scripts/simple-chart.js'
];

// script.js에서 fetch하는 JSON 추가
const scriptJsonFiles = [
    'magic-number/data/magic-matrix-data.json',
    'magic-number/data/service-data.json',
    'magic-number/data/kbo-records.json'
];

// 사용되는 파일들 추가
rootJsonFiles.forEach(f => usedFiles.add(f));
magicJsFiles.forEach(f => usedFiles.add(f));
scriptJsonFiles.forEach(f => usedFiles.add(f));

// 모든 JS와 JSON 파일 찾기
function findFiles(dir, extensions) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        if (['node_modules', 'archive', 'deprecated', '.git'].includes(item)) continue;
        
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            files.push(...findFiles(fullPath, extensions));
        } else if (extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

// 모든 JS와 JSON 파일 수집
const jsFiles = findFiles('.', ['.js']);
const jsonFiles = findFiles('.', ['.json']);

console.log('=== 파일 사용 분석 결과 ===\n');

console.log('📁 전체 파일 현황:');
console.log(`  - JavaScript 파일: ${jsFiles.length}개`);
console.log(`  - JSON 파일: ${jsonFiles.length}개\n`);

console.log('✅ 사용 중인 파일들:');
console.log('  [Root index.html]:');
rootJsonFiles.forEach(f => console.log(`    - ${f}`));
console.log('\n  [Magic-number index.html]:');
magicJsFiles.forEach(f => console.log(`    - ${f}`));

// 사용하지 않는 파일 찾기
const unusedJs = jsFiles.filter(f => !usedFiles.has(f.replace('./', '')));
const unusedJson = jsonFiles.filter(f => !usedFiles.has(f.replace('./', '')));

console.log('\n❌ 사용하지 않는 JavaScript 파일:');
if (unusedJs.length === 0) {
    console.log('  없음');
} else {
    unusedJs.forEach(f => console.log(`  - ${f}`));
}

console.log('\n❌ 사용하지 않는 JSON 파일:');
if (unusedJson.length === 0) {
    console.log('  없음');
} else {
    unusedJson.forEach(f => console.log(`  - ${f}`));
}

// 크롤러나 스크립트 파일들 분류
console.log('\n🔧 유틸리티/크롤러 파일들 (정리 대상 후보):');
const utilFiles = [...unusedJs, ...unusedJson].filter(f => 
    f.includes('crawler') || 
    f.includes('test') || 
    f.includes('generate') ||
    f.includes('calculate') ||
    f.includes('process') ||
    f.includes('parse')
);

utilFiles.forEach(f => console.log(`  - ${f}`));

console.log('\n📊 권장사항:');
console.log('  1. crawlers/ 폴더의 파일들은 데이터 업데이트용이므로 유지');
console.log('  2. magic-number/scripts/ 내 미사용 파일들 정리 검토');
console.log('  3. 테스트 파일들은 별도 폴더로 이동 고려');
