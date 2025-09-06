const fs = require('fs');
const path = require('path');

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 함수 정의 패턴들
    const functionPatterns = [
        /function\s+(\w+)\s*\(/g,                          // function name()
        /const\s+(\w+)\s*=\s*function/g,                   // const name = function
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g,            // const name = () =>
        /const\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>/g,    // const name = async () =>
        /let\s+(\w+)\s*=\s*function/g,                     // let name = function
        /let\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g,              // let name = () =>
        /var\s+(\w+)\s*=\s*function/g,                     // var name = function
        /(\w+):\s*function\s*\(/g,                         // object method
        /(\w+):\s*async\s*function\s*\(/g,                 // async object method
    ];
    
    const definedFunctions = new Set();
    const calledFunctions = new Set();
    
    // 함수 정의 찾기
    functionPatterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern);
        while ((match = regex.exec(content)) !== null) {
            definedFunctions.add(match[1]);
        }
    });
    
    // 함수 호출 찾기
    definedFunctions.forEach(funcName => {
        // 다양한 호출 패턴
        const callPatterns = [
            new RegExp(`\\b${funcName}\\s*\\(`, 'g'),           // funcName()
            new RegExp(`\\.${funcName}\\s*\\(`, 'g'),           // obj.funcName()
            new RegExp(`\\[["']${funcName}["']\\]`, 'g'),       // obj['funcName']
            new RegExp(`addEventListener\\s*\\(\\s*["'][^"']+["']\\s*,\\s*${funcName}`, 'g'), // addEventListener
            new RegExp(`onClick\\s*=\\s*["']?${funcName}`, 'g'), // onClick
            new RegExp(`setTimeout\\s*\\(\\s*${funcName}`, 'g'), // setTimeout
            new RegExp(`setInterval\\s*\\(\\s*${funcName}`, 'g'), // setInterval
            new RegExp(`\\.then\\s*\\(\\s*${funcName}`, 'g'),    // promise.then
            new RegExp(`\\.catch\\s*\\(\\s*${funcName}`, 'g'),   // promise.catch
        ];
        
        let isCalled = false;
        for (const pattern of callPatterns) {
            if (pattern.test(content)) {
                isCalled = true;
                break;
            }
        }
        
        if (isCalled) {
            calledFunctions.add(funcName);
        }
    });
    
    // 특별 케이스 처리 (자동 실행, 이벤트 핸들러 등)
    const specialCases = [
        'init', 'initialize', 'setup', 'main', 'start',
        'onload', 'onLoad', 'ready', 'DOMContentLoaded'
    ];
    
    specialCases.forEach(name => {
        if (definedFunctions.has(name)) {
            calledFunctions.add(name);
        }
    });
    
    // HTML에서 호출될 수 있는 전역 함수들 체크
    const globalPatterns = /window\.(\w+)\s*=/g;
    let match;
    while ((match = globalPatterns.exec(content)) !== null) {
        calledFunctions.add(match[1]);
    }
    
    const unusedFunctions = Array.from(definedFunctions).filter(f => !calledFunctions.has(f));
    
    return {
        defined: Array.from(definedFunctions),
        called: Array.from(calledFunctions),
        unused: unusedFunctions
    };
}

// 분석할 파일들
const filesToAnalyze = [
    'magic-number/scripts/script.js',
    'magic-number/scripts/simple-chart.js',
    'magic-number/scripts/error-monitor.js'
];

console.log('=== JS 함수 사용 분석 ===\n');

filesToAnalyze.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`📄 ${file}:`);
        const result = analyzeFile(file);
        
        console.log(`  총 함수: ${result.defined.length}개`);
        console.log(`  사용 중: ${result.called.length}개`);
        console.log(`  미사용: ${result.unused.length}개\n`);
        
        if (result.unused.length > 0) {
            console.log('  ❌ 미사용 함수 목록:');
            result.unused.forEach(func => {
                console.log(`    - ${func}()`);
            });
            console.log('');
        }
    }
});

console.log('💡 참고사항:');
console.log('  - HTML onclick 등에서 직접 호출되는 함수는 감지 못할 수 있음');
console.log('  - 동적으로 호출되는 함수는 미사용으로 표시될 수 있음');
console.log('  - 정확한 분석을 위해 각 함수를 수동으로 확인 필요');
