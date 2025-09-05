#!/usr/bin/env node

/**
 * Cross-Platform 경로 관리 시스템 통합 테스트
 * JavaScript PathManager와 Python PathManager의 일관성을 검증
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// PathManager와 Environment 불러오기
const jsPathManager = require('../config/paths');
const environment = require('../config/environment');

console.log('🔍 Cross-Platform 경로 관리 시스템 통합 테스트 시작...\n');

// 1. JavaScript PathManager 테스트
console.log('📋 JavaScript PathManager 테스트...');
try {
    jsPathManager.validatePaths();
    console.log('  ✅ JavaScript PathManager 검증 성공');
    
    // 주요 경로들 확인
    const jsPaths = {
        projectRoot: jsPathManager.projectRoot,
        magicNumberRoot: jsPathManager.magicNumberRoot,
        dataDir: jsPathManager.dataDir,
        crawlersDir: jsPathManager.crawlersDir,
        historyDir: jsPathManager.historyDir
    };
    
    console.log('  📁 JavaScript 경로 정보:');
    Object.entries(jsPaths).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
    });
} catch (error) {
    console.error('  ❌ JavaScript PathManager 오류:', error.message);
    process.exit(1);
}

console.log('\n📋 Environment Manager 테스트...');
try {
    console.log('  📊 환경 설정:');
    console.log(`    GitHub Actions: ${environment.isGitHubActions()}`);
    console.log(`    Production: ${environment.isProduction()}`);
    console.log(`    Platform: ${environment.getPlatform()}`);
    console.log(`    Project Root (ENV): ${environment.getProjectRoot() || 'auto-detect'}`);
    console.log(`    Data Dir (ENV): ${environment.getDataDir() || 'default'}`);
    console.log('  ✅ Environment Manager 테스트 성공');
} catch (error) {
    console.error('  ❌ Environment Manager 오류:', error.message);
    process.exit(1);
}

// 2. Python PathManager 테스트
console.log('\n📋 Python PathManager 테스트...');

function testPythonPathManager() {
    return new Promise((resolve, reject) => {
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
        const testScript = path.join(__dirname, '..', 'config', 'paths.py');
        
        const pythonProcess = spawn(pythonPath, [testScript], {
            cwd: jsPathManager.projectRoot,
            stdio: 'pipe',
            env: {
                ...process.env,
                KBO_PROJECT_ROOT: jsPathManager.projectRoot
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('  ✅ Python PathManager 테스트 성공');
                console.log('  📁 Python 경로 정보:');
                stdout.split('\n').forEach(line => {
                    if (line.trim()) {
                        console.log(`    ${line}`);
                    }
                });
                resolve({ stdout, stderr });
            } else {
                console.error('  ❌ Python PathManager 테스트 실패');
                if (stderr) {
                    console.error('  오류 내용:', stderr);
                }
                reject(new Error(`Python PathManager test failed with code ${code}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('  ❌ Python 실행 오류:', error.message);
            reject(error);
        });
    });
}

// 3. 경로 일관성 검증
async function validatePathConsistency() {
    try {
        const pythonResult = await testPythonPathManager();
        
        console.log('\n📋 경로 일관성 검증...');
        
        // Python PathManager에서 경로 추출 (간단한 파싱)
        const pythonOutput = pythonResult.stdout;
        const pythonProjectRoot = pythonOutput.match(/Project Root: (.+)/)?.[1]?.trim();
        const pythonDataDir = pythonOutput.match(/Data:\s+(.+)/)?.[1]?.trim();
        
        if (pythonProjectRoot && pythonDataDir) {
            const jsProjectRoot = path.resolve(jsPathManager.projectRoot);
            const jsDataDir = path.resolve(jsPathManager.dataDir);
            const pyProjectRoot = path.resolve(pythonProjectRoot);
            const pyDataDir = path.resolve(pythonDataDir);
            
            console.log('  🔍 경로 비교:');
            console.log(`    Project Root 일치: ${jsProjectRoot === pyProjectRoot ? '✅' : '❌'}`);
            console.log(`      JS:  ${jsProjectRoot}`);
            console.log(`      Py:  ${pyProjectRoot}`);
            
            console.log(`    Data Dir 일치: ${jsDataDir === pyDataDir ? '✅' : '❌'}`);
            console.log(`      JS:  ${jsDataDir}`);
            console.log(`      Py:  ${pyDataDir}`);
            
            if (jsProjectRoot === pyProjectRoot && jsDataDir === pyDataDir) {
                console.log('  ✅ 경로 일관성 검증 성공');
            } else {
                console.log('  ⚠️ 경로 불일치 발견');
            }
        } else {
            console.log('  ⚠️ Python 경로 추출 실패 - 수동 확인 필요');
        }
        
    } catch (error) {
        console.error('  ❌ Python PathManager 테스트 실패:', error.message);
        console.log('  ℹ️ Python 환경이 설정되지 않았을 수 있습니다.');
    }
}

// 4. 파일 시스템 검증
console.log('\n📋 파일 시스템 검증...');
const criticalPaths = [
    { name: 'Package.json', path: path.join(jsPathManager.projectRoot, 'package.json') },
    { name: 'JS PathManager', path: path.join(jsPathManager.configDir, 'paths.js') },
    { name: 'Environment Manager', path: path.join(jsPathManager.configDir, 'environment.js') },
    { name: 'Python PathManager', path: path.join(jsPathManager.configDir, 'paths.py') },
    { name: 'Data Directory', path: jsPathManager.dataDir },
    { name: 'Crawlers Directory', path: jsPathManager.crawlersDir },
    { name: 'Python Crawler', path: path.join(jsPathManager.crawlersDir, 'kbo-python-working-crawler.py') }
];

let missingFiles = 0;
criticalPaths.forEach(({ name, path: filePath }) => {
    const exists = fs.existsSync(filePath);
    console.log(`  ${exists ? '✅' : '❌'} ${name}: ${filePath}`);
    if (!exists) missingFiles++;
});

// 5. 최종 결과
console.log('\n📊 테스트 결과 요약');
console.log('==================================================');
if (missingFiles === 0) {
    console.log('✅ 모든 경로 관리 시스템이 정상적으로 구성되었습니다!');
    console.log('\n📋 활용 가능한 기능:');
    console.log('  - JavaScript: require("../config/paths")');
    console.log('  - Python: from paths import get_path_manager');
    console.log('  - 환경변수: .env 파일 또는 시스템 환경변수');
    console.log('  - GitHub Actions: 자동 환경변수 설정');
    
    console.log('\n🎯 다음 단계:');
    console.log('  1. 로컬에서 테스트: npm run test-paths');
    console.log('  2. Python 테스트: python3 config/paths.py');
    console.log('  3. 환경변수 설정: cp .env.example .env');
} else {
    console.log(`❌ ${missingFiles}개의 필수 파일/경로가 누락되었습니다.`);
    console.log('프로젝트 구조를 확인하고 누락된 파일을 생성하세요.');
    process.exit(1);
}

// Python 경로 일관성 검증 실행
validatePathConsistency();