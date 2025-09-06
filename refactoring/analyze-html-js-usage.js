const fs = require('fs');
const path = require('path');

console.log('🔍 HTML 파일에서 사용하는 JS와 함수들 분석\n');

// HTML 파일 목록
const htmlFiles = [
    './index.html',
    './404.html',
    './magic-number/index.html',
    './magic-number/404.html'
];

// 존재하는 HTML 파일만 필터링
const existingHtmlFiles = htmlFiles.filter(file => {
    try {
        fs.accessSync(file);
        return true;
    } catch (error) {
        return false;
    }
});

console.log('📄 분석할 HTML 파일들:');
existingHtmlFiles.forEach(file => console.log(`  - ${file}`));
console.log('');

// 각 HTML 파일 분석
existingHtmlFiles.forEach((htmlFile, index) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📄 ${htmlFile}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
        const htmlContent = fs.readFileSync(htmlFile, 'utf8');
        
        // 1. 외부 JS 파일 참조 찾기
        const scriptTags = htmlContent.match(/<script[^>]*src\s*=\s*["'][^"']*["'][^>]*>/gi) || [];
        console.log('\n🔗 외부 JS 파일 참조:');
        if (scriptTags.length === 0) {
            console.log('  없음');
        } else {
            scriptTags.forEach(script => {
                const srcMatch = script.match(/src\s*=\s*["']([^"']*)["']/i);
                if (srcMatch) {
                    const src = srcMatch[1];
                    // CDN인지 로컬인지 구분
                    if (src.startsWith('http')) {
                        console.log(`  📡 CDN: ${src}`);
                    } else {
                        console.log(`  📁 로컬: ${src}`);
                    }
                }
            });
        }
        
        // 2. 인라인 JS 코드에서 함수 호출 찾기
        const inlineScriptMatches = htmlContent.match(/<script[^>]*>(.*?)<\/script>/gis) || [];
        console.log('\n📝 인라인 JS 코드:');
        if (inlineScriptMatches.length === 0) {
            console.log('  없음');
        } else {
            inlineScriptMatches.forEach((script, idx) => {
                const scriptContent = script.replace(/<\/?script[^>]*>/gi, '').trim();
                if (scriptContent && !scriptContent.includes('gtag')) { // Google Analytics 제외
                    console.log(`  ${idx + 1}. ${scriptContent.substring(0, 100)}${scriptContent.length > 100 ? '...' : ''}`);
                }
            });
        }
        
        // 3. HTML 속성에서 함수 호출 찾기 (onclick, onload 등)
        const eventHandlers = [];
        
        // onclick 이벤트
        const onclickMatches = htmlContent.match(/onclick\s*=\s*["']([^"']*)["']/gi) || [];
        onclickMatches.forEach(match => {
            const funcCall = match.replace(/onclick\s*=\s*["']/i, '').replace(/["']$/, '');
            eventHandlers.push({ type: 'onclick', call: funcCall });
        });
        
        // onload 이벤트
        const onloadMatches = htmlContent.match(/onload\s*=\s*["']([^"']*)["']/gi) || [];
        onloadMatches.forEach(match => {
            const funcCall = match.replace(/onload\s*=\s*["']/i, '').replace(/["']$/, '');
            eventHandlers.push({ type: 'onload', call: funcCall });
        });
        
        // 다른 이벤트들
        const otherEventMatches = htmlContent.match(/on\w+\s*=\s*["']([^"']*)["']/gi) || [];
        otherEventMatches.forEach(match => {
            if (!match.toLowerCase().includes('onclick') && !match.toLowerCase().includes('onload')) {
                const eventType = match.match(/on(\w+)/i)[1];
                const funcCall = match.replace(/on\w+\s*=\s*["']/i, '').replace(/["']$/, '');
                eventHandlers.push({ type: `on${eventType}`, call: funcCall });
            }
        });
        
        console.log('\n🖱️ 이벤트 핸들러에서 호출되는 함수들:');
        if (eventHandlers.length === 0) {
            console.log('  없음');
        } else {
            const uniqueHandlers = [...new Map(eventHandlers.map(h => [`${h.type}:${h.call}`, h])).values()];
            uniqueHandlers.forEach(handler => {
                console.log(`  ${handler.type}: ${handler.call}`);
            });
        }
        
        // 4. 함수명 추출
        const functionCalls = new Set();
        eventHandlers.forEach(handler => {
            // 함수 호출에서 함수명만 추출
            const funcName = handler.call.match(/(\w+)\s*\(/);
            if (funcName) {
                functionCalls.add(funcName[1]);
            }
        });
        
        console.log('\n🎯 호출되는 함수명들:');
        if (functionCalls.size === 0) {
            console.log('  없음');
        } else {
            [...functionCalls].sort().forEach(func => {
                console.log(`  - ${func}()`);
            });
        }
        
    } catch (error) {
        console.log(`❌ 파일 읽기 실패: ${error.message}`);
    }
});

console.log(`\n\n${'='.repeat(60)}`);
console.log('📊 전체 요약');
console.log(`${'='.repeat(60)}`);

// 전체 요약을 위해 모든 파일 다시 스캔
const allExternalScripts = new Set();
const allFunctionCalls = new Set();
const allEventTypes = new Set();

existingHtmlFiles.forEach(htmlFile => {
    try {
        const htmlContent = fs.readFileSync(htmlFile, 'utf8');
        
        // 외부 스크립트 수집
        const scriptTags = htmlContent.match(/<script[^>]*src\s*=\s*["'][^"']*["'][^>]*>/gi) || [];
        scriptTags.forEach(script => {
            const srcMatch = script.match(/src\s*=\s*["']([^"']*)["']/i);
            if (srcMatch) {
                allExternalScripts.add(srcMatch[1]);
            }
        });
        
        // 함수 호출 수집
        const eventHandlers = [];
        const onclickMatches = htmlContent.match(/onclick\s*=\s*["']([^"']*)["']/gi) || [];
        const onloadMatches = htmlContent.match(/onload\s*=\s*["']([^"']*)["']/gi) || [];
        const otherEventMatches = htmlContent.match(/on\w+\s*=\s*["']([^"']*)["']/gi) || [];
        
        [...onclickMatches, ...onloadMatches, ...otherEventMatches].forEach(match => {
            const funcCall = match.replace(/on\w+\s*=\s*["']/i, '').replace(/["']$/, '');
            const eventType = match.match(/on(\w+)/i)[1];
            allEventTypes.add(eventType);
            
            const funcName = funcCall.match(/(\w+)\s*\(/);
            if (funcName) {
                allFunctionCalls.add(funcName[1]);
            }
        });
        
    } catch (error) {
        // 에러 무시
    }
});

console.log('\n📁 모든 외부 JS 파일:');
if (allExternalScripts.size === 0) {
    console.log('  없음');
} else {
    [...allExternalScripts].sort().forEach(script => {
        if (script.startsWith('http')) {
            console.log(`  📡 ${script}`);
        } else {
            console.log(`  📁 ${script}`);
        }
    });
}

console.log('\n🎯 모든 HTML에서 호출되는 함수들:');
if (allFunctionCalls.size === 0) {
    console.log('  없음');
} else {
    [...allFunctionCalls].sort().forEach(func => {
        console.log(`  - ${func}()`);
    });
}

console.log('\n🖱️ 사용되는 이벤트 타입들:');
if (allEventTypes.size === 0) {
    console.log('  없음');
} else {
    [...allEventTypes].sort().forEach(event => {
        console.log(`  - on${event}`);
    });
}

console.log('\n✅ 분석 완료!');