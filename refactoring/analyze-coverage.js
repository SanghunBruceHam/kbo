const fs = require('fs');

// Coverage 데이터 로드
const coverageData = JSON.parse(fs.readFileSync('Coverage-20250906T144206.json', 'utf8'));
const scriptFile = fs.readFileSync('magic-number/scripts/script.js', 'utf8');

// script.js에 대한 coverage 찾기
const scriptCoverage = coverageData.find(item => item.url.includes('scripts/script.js'));

if (!scriptCoverage) {
    console.log('script.js coverage 데이터를 찾을 수 없습니다.');
    process.exit(1);
}

console.log('=== script.js Coverage 분석 ===\n');
console.log(`파일 전체 크기: ${scriptFile.length}자`);
console.log(`실행된 구간 수: ${scriptCoverage.ranges.length}개\n`);

// 실행되지 않은 구간 찾기
const executedRanges = scriptCoverage.ranges.sort((a, b) => a.start - b.start);
const unexecutedRanges = [];

let lastEnd = 0;
for (const range of executedRanges) {
    if (range.start > lastEnd) {
        unexecutedRanges.push({
            start: lastEnd,
            end: range.start
        });
    }
    lastEnd = Math.max(lastEnd, range.end);
}

// 파일 끝까지 실행되지 않은 부분
if (lastEnd < scriptFile.length) {
    unexecutedRanges.push({
        start: lastEnd,
        end: scriptFile.length
    });
}

console.log('❌ 실행되지 않은 코드 구간들:');
console.log(`총 ${unexecutedRanges.length}개 구간\n`);

// 각 미실행 구간의 코드 내용 확인
unexecutedRanges.forEach((range, index) => {
    const code = scriptFile.slice(range.start, range.end);
    const lines = code.split('\n');
    const codeSize = range.end - range.start;
    
    console.log(`구간 ${index + 1}: ${range.start}-${range.end} (${codeSize}자)`);
    
    // 함수 정의나 중요한 코드 찾기
    const funcMatches = code.match(/function\s+(\w+)|const\s+(\w+)\s*=.*function|const\s+(\w+)\s*=.*=>/g);
    if (funcMatches) {
        console.log(`  📝 함수들: ${funcMatches.join(', ')}`);
    }
    
    // 주석이 아닌 실제 코드인지 확인
    const nonCommentLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });
    
    if (nonCommentLines.length > 0) {
        console.log(`  📄 실제 코드 라인: ${nonCommentLines.length}/${lines.length}줄`);
        
        // 첫 몇 줄만 미리보기
        const preview = nonCommentLines.slice(0, 3).map(line => line.trim()).join(' | ');
        if (preview) {
            console.log(`  👀 미리보기: ${preview.substring(0, 100)}${preview.length > 100 ? '...' : ''}`);
        }
    } else {
        console.log(`  💭 주석이나 빈 줄만 포함`);
    }
    
    console.log('');
});

// 실행률 계산
const executedBytes = executedRanges.reduce((sum, range) => sum + (range.end - range.start), 0);
const totalBytes = scriptFile.length;
const executionRate = (executedBytes / totalBytes * 100).toFixed(1);

console.log(`📊 전체 실행률: ${executionRate}% (${executedBytes}/${totalBytes}자)`);
console.log(`🔍 미실행 코드: ${totalBytes - executedBytes}자`);