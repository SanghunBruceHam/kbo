#!/usr/bin/env node
/**
 * HTML 파일에 최적화 스크립트를 점진적으로 통합하는 헬퍼
 */
const fs = require('fs');
const path = require('path');

function addPrecomputedDataLoader(htmlFilePath) {
    const content = fs.readFileSync(htmlFilePath, 'utf8');
    
    // 이미 추가되어 있는지 확인
    if (content.includes('loadPrecomputedUIData') || content.includes('ui-precomputed-data.json')) {
        console.log(`✅ ${htmlFilePath}에 이미 최적화 코드가 적용되어 있습니다.`);
        return;
    }
    
    // </body> 바로 전에 스크립트 추가
    const insertPoint = content.lastIndexOf('</body>');
    if (insertPoint === -1) {
        console.log(`❌ ${htmlFilePath}에서 </body> 태그를 찾을 수 없습니다.`);
        return;
    }
    
    const optimizationScript = `
    <!-- ================== 성능 최적화 스크립트 ================== -->
    <script>
    // 사전계산 데이터 로드 및 적용
    let precomputedUIData = null;
    
    async function loadPrecomputedUIData() {
        try {
            const response = await fetch('data/ui-precomputed-data.json');
            if (!response.ok) {
                console.warn('사전계산 데이터 로드 실패, 기존 방식으로 대체');
                return null;
            }
            precomputedUIData = await response.json();
            console.log('✅ 사전계산 UI 데이터 로드 완료');
            return precomputedUIData;
        } catch (error) {
            console.warn('사전계산 데이터 로드 중 오류:', error.message);
            return null;
        }
    }
    
    // 팀 설정 최적화
    function getOptimizedTeamConfig(teamName) {
        if (precomputedUIData?.teamConfigurations?.[teamName]) {
            return precomputedUIData.teamConfigurations[teamName];
        }
        // 기존 방식으로 폴백
        return null;
    }
    
    // 연승/연패 분석 최적화
    function getOptimizedStreakAnalysis(teamName) {
        if (precomputedUIData?.streakAnalysis?.[teamName]) {
            return precomputedUIData.streakAnalysis[teamName];
        }
        return null;
    }
    
    // 전후반기 통계 최적화  
    function getOptimizedHalfSeasonStats(teamName) {
        if (precomputedUIData?.halfSeasonStats?.[teamName]) {
            return precomputedUIData.halfSeasonStats[teamName];
        }
        return null;
    }
    
    // 페이지 로드 시 사전계산 데이터 먼저 로드
    document.addEventListener('DOMContentLoaded', async function() {
        const startTime = performance.now();
        
        // 사전계산 데이터 로드
        await loadPrecomputedUIData();
        
        const loadTime = performance.now() - startTime;
        console.log(\`⚡ 최적화 데이터 로드 시간: \${loadTime.toFixed(2)}ms\`);
        
        // 기존 초기화 함수가 있다면 실행
        if (typeof initializeDashboard === 'function') {
            initializeDashboard();
        }
    });
    </script>
    <!-- ============================================================ -->
    
`;
    
    const newContent = content.substring(0, insertPoint) + optimizationScript + content.substring(insertPoint);
    
    // 백업 생성
    fs.writeFileSync(`${htmlFilePath}.backup`, content);
    fs.writeFileSync(htmlFilePath, newContent);
    
    console.log(`✅ ${htmlFilePath}에 최적화 스크립트 추가 완료`);
    console.log(`📁 원본 백업: ${htmlFilePath}.backup`);
}

function integrateOptimizedScripts() {
    console.log('🔄 HTML 파일들에 최적화 스크립트 통합 시작...\n');
    
    // 루트 index.html 처리
    const rootHtml = 'index.html';
    if (fs.existsSync(rootHtml)) {
        console.log('1. 루트 index.html 처리 중...');
        addPrecomputedDataLoader(rootHtml);
    } else {
        console.log('❌ 루트 index.html을 찾을 수 없습니다.');
    }
    
    console.log('\n🎯 통합 완료! 다음 단계:');
    console.log('1. 브라우저에서 페이지 열어서 콘솔 확인');
    console.log('2. "✅ 사전계산 UI 데이터 로드 완료" 메시지 확인');
    console.log('3. 로딩 시간 개선 측정');
}

// CLI로 실행할 때
if (require.main === module) {
    integrateOptimizedScripts();
}

module.exports = { addPrecomputedDataLoader, integrateOptimizedScripts };