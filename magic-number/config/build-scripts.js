/**
 * KBO 프로젝트 빌드 스크립트 설정
 * npm 스크립트들의 중복 제거 및 일관성 유지
 */

const path = require('path');

// 기본 경로 설정
const PATHS = {
    magicNumber: 'magic-number',
    scripts: 'magic-number/scripts',
    utilRunner: 'magic-number/scripts/util-runner.js'
};

// 공통 명령어 생성 헬퍼
const createScriptCommand = (scriptPath, description = '') => {
    const fullPath = path.join(PATHS.scripts, scriptPath);
    const command = `node ${PATHS.utilRunner} ${fullPath}`;
    return description ? `${command} && echo '${description}'` : command;
};

// 스크립트 그룹 정의
const SCRIPT_GROUPS = {
    // 핵심 데이터 처리
    dataProcessing: {
        'process': createScriptCommand('02_season-data-processor.js'),
        'update-data': createScriptCommand('02_season-data-processor.js', '✅ KBO 데이터 업데이트 완료!'),
        'generate-raw-records': createScriptCommand('generate-raw-game-records.js'),
        'enhanced-dashboard': createScriptCommand('stats-comprehensive-generator.js'),
        'parse-season-data': createScriptCommand('03_season-data-parser.js')
    },

    // 분석 스크립트들
    analysis: {
        'weekly-analysis': createScriptCommand('analysis-weekly.js'),
        'clutch-analysis': createScriptCommand('analysis-clutch.js'),
        'home-away-analysis': createScriptCommand('analysis-home-away.js'),
        'series-analysis': createScriptCommand('analysis-series.js'),
        'monthly-analysis': createScriptCommand('analysis-monthly.js'),
        'weekday-analysis': createScriptCommand('analysis-weekday.js')
    },

    // 매직넘버 관련
    magicNumber: {
        'rank-matrix': createScriptCommand('01_magic-number-calculator.js'),
        'precompute-matrix': createScriptCommand('generate-magic-matrix-precomputed.js')
    },

    // 크롤링 및 외부 도구
    external: {
        'crawl': `node ${PATHS.utilRunner} magic-number/crawlers/kbo-python-working-crawler.py`,
        'precompute-ui': 'node scripts/generate-ui-precomputed-data.js',
        'performance-check': 'node scripts/quick-performance-check.js'
    },

    // 개발 도구
    development: {
        'serve': `npx http-server ${PATHS.magicNumber} -p 8080`,
        'test': `node ${PATHS.scripts}/test-paths.js`,
        'test-paths': `node ${PATHS.scripts}/test-cross-platform-paths.js`,
        'validate': `node ${PATHS.utilRunner} --help`,
        'help': `node ${PATHS.utilRunner} --help`
    }
};

// 복합 스크립트 정의
const COMPOSITE_SCRIPTS = {
    'analysis': () => {
        const analysisScripts = Object.keys(SCRIPT_GROUPS.analysis)
            .map(script => `npm run ${script}`)
            .join(' && ');
        return `npm run enhanced-dashboard && ${analysisScripts}`;
    },

    'full-update': () => 'npm run process && npm run analysis && echo \'🎉 전체 업데이트 완료!\'',

    'precompute-all': () => 'npm run precompute-ui && npm run precompute-matrix && echo \'🚀 모든 사전계산 완료!\'',

    'optimize': () => 'npm run precompute-all && npm run performance-check'
};

// 모든 스크립트 통합
const generateAllScripts = () => {
    const allScripts = {};

    // 개별 스크립트 그룹들 추가
    Object.values(SCRIPT_GROUPS).forEach(group => {
        Object.assign(allScripts, group);
    });

    // 복합 스크립트들 추가
    Object.entries(COMPOSITE_SCRIPTS).forEach(([name, generator]) => {
        allScripts[name] = generator();
    });

    return allScripts;
};

// 스크립트 최적화 분석
const analyzeOptimization = () => {
    const analysis = {
        duplicates: [
            { scripts: ['process', 'update-data'], reason: '동일 명령어, 메시지만 다름' },
            { scripts: ['validate', 'help'], reason: '완전히 동일한 명령어' },
            { scripts: ['test', 'test-paths'], reason: '유사한 테스트 기능' }
        ],
        patterns: [
            { pattern: 'util-runner.js', count: 12, suggestion: '공통 헬퍼 함수 사용' },
            { pattern: 'magic-number/scripts/', count: 12, suggestion: '경로 상수화' }
        ],
        recommendations: [
            '중복 스크립트 통합',
            '공통 경로 설정 파일 사용',
            '논리적 그룹화로 가독성 향상',
            '복합 스크립트 단순화'
        ]
    };
    return analysis;
};

module.exports = {
    PATHS,
    SCRIPT_GROUPS,
    COMPOSITE_SCRIPTS,
    generateAllScripts,
    analyzeOptimization,
    createScriptCommand
};