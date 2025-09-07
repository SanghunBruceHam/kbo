#!/usr/bin/env node

/**
 * 경로 검증 및 테스트 스크립트
 * 개선된 경로 관리 시스템이 올바르게 작동하는지 검증
 */

const pathManager = require('../../config/paths');
const fs = require('fs');
const path = require('path');

class PathValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
    }

    // 메인 검증 실행
    async validate() {
        console.log('🔍 KBO 프로젝트 경로 검증 시작...\n');
        
        try {
            // 1. PathManager 기본 기능 테스트
            this.testPathManager();
            
            // 2. 프로젝트 구조 검증
            this.validateProjectStructure();
            
            // 3. 필수 파일 존재 확인
            this.validateEssentialFiles();
            
            // 4. 데이터 파일 검증
            this.validateDataFiles();
            
            // 5. 실행 권한 확인
            await this.validateExecutionPermissions();
            
            // 결과 출력
            this.printResults();
            
        } catch (error) {
            console.error('❌ 검증 중 오류 발생:', error.message);
            process.exit(1);
        }
    }

    // PathManager 기본 기능 테스트
    testPathManager() {
        console.log('📋 PathManager 기본 기능 테스트...');
        
        try {
            // 프로젝트 루트 확인
            if (pathManager.projectRoot && pathManager.exists(pathManager.projectRoot)) {
                this.success(`프로젝트 루트 확인: ${pathManager.projectRoot}`);
            } else {
                this.error('프로젝트 루트를 찾을 수 없습니다');
            }

            // 주요 디렉토리 경로 확인
            const dirs = [
                { name: 'Magic Number Root', path: pathManager.magicNumberRoot },
                { name: 'Data Directory', path: pathManager.dataDir },
                { name: 'JS Directory', path: pathManager.jsDir },
                { name: 'Crawlers Directory', path: pathManager.crawlersDir }
            ];

            dirs.forEach(dir => {
                if (pathManager.exists(dir.path)) {
                    this.success(`${dir.name}: ${dir.path}`);
                } else {
                    this.error(`${dir.name} 디렉토리가 존재하지 않습니다: ${dir.path}`);
                }
            });

            // ensureDir 기능 테스트
            const testDir = path.join(pathManager.projectRoot, 'temp-test-dir');
            pathManager.ensureDir(testDir);
            if (pathManager.exists(testDir)) {
                this.success('ensureDir 기능 정상 작동');
                fs.rmSync(testDir, { recursive: true, force: true }); // 테스트 디렉토리 정리
            } else {
                this.error('ensureDir 기능 오류');
            }

        } catch (error) {
            this.error(`PathManager 테스트 실패: ${error.message}`);
        }
    }

    // 프로젝트 구조 검증
    validateProjectStructure() {
        console.log('\n🏗️ 프로젝트 구조 검증...');

        const requiredStructure = [
            'package.json',
            'config',
            'magic-number',
            'magic-number/data',
            'magic-number/scripts',
            'magic-number/crawlers',
            'magic-number/index.html'
        ];

        requiredStructure.forEach(item => {
            const fullPath = path.join(pathManager.projectRoot, item);
            if (pathManager.exists(fullPath)) {
                this.success(`구조 확인: ${item}`);
            } else {
                this.warning(`누락된 구조: ${item}`);
            }
        });
    }

    // 필수 파일 존재 확인
    validateEssentialFiles() {
        console.log('\n📄 필수 파일 존재 확인...');

        const essentialFiles = [
            { desc: 'PathManager', path: path.join(pathManager.projectRoot, 'config/paths.js') },
            { desc: 'CrossPlatform Runner', path: pathManager.getJsFile('util-runner.js') },
            { desc: 'Process Season Data', path: pathManager.getJsFile('02_season-data-processor.js') },
            { desc: 'Python Crawler', path: pathManager.getCrawlerFile('kbo-python-working-crawler.py') }
        ];

        essentialFiles.forEach(file => {
            if (pathManager.exists(file.path)) {
                this.success(`${file.desc}: ${file.path}`);
            } else {
                this.error(`필수 파일 누락: ${file.desc} - ${file.path}`);
            }
        });
    }

    // 데이터 파일 검증
    validateDataFiles() {
        console.log('\n💾 데이터 파일 검증...');

        const dataFiles = [
            'api-data.json',
            'calc-standings.json', 
            'calc-head-to-head.json',
            '2025-season-data-clean.txt'
        ];

        dataFiles.forEach(filename => {
            const filePath = pathManager.getDataFile(filename);
            if (pathManager.exists(filePath)) {
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                const lastModified = stats.mtime.toLocaleDateString('ko-KR');
                this.success(`${filename}: ${sizeKB}KB (수정일: ${lastModified})`);
            } else {
                this.warning(`데이터 파일 없음: ${filename}`);
            }
        });

        // 시즌 데이터 파일 자동 탐지 테스트
        const seasonFile = pathManager.findSeasonDataFile();
        if (seasonFile) {
            this.success(`시즌 데이터 자동 탐지: ${seasonFile}`);
        } else {
            this.warning('시즌 데이터 파일을 찾을 수 없습니다');
        }
    }

    // 실행 권한 확인
    async validateExecutionPermissions() {
        console.log('\n🔐 실행 권한 확인...');

        const executableFiles = [
            pathManager.getJsFile('util-runner.js'),
            pathManager.getJsFile('test-paths.js')
        ];

        executableFiles.forEach(file => {
            try {
                fs.accessSync(file, fs.constants.F_OK | fs.constants.R_OK);
                this.success(`실행 가능: ${path.basename(file)}`);
            } catch (error) {
                this.error(`실행 권한 없음: ${path.basename(file)}`);
            }
        });
    }

    // 헬퍼 메소드들
    success(message) {
        this.successes.push(message);
        console.log(`  ✅ ${message}`);
    }

    warning(message) {
        this.warnings.push(message);
        console.log(`  ⚠️ ${message}`);
    }

    error(message) {
        this.errors.push(message);
        console.log(`  ❌ ${message}`);
    }

    // 결과 출력
    printResults() {
        console.log('\n📊 검증 결과 요약');
        console.log('='.repeat(50));
        
        console.log(`✅ 성공: ${this.successes.length}개`);
        console.log(`⚠️ 경고: ${this.warnings.length}개`);
        console.log(`❌ 오류: ${this.errors.length}개`);

        if (this.errors.length === 0) {
            console.log('\n🎉 모든 경로 검증이 성공적으로 완료되었습니다!');
            console.log('\n📋 사용 가능한 npm 명령어:');
            console.log('  npm run process    - 시즌 데이터 처리');
            console.log('  npm run crawl      - KBO 데이터 크롤링');
            console.log('  npm run serve      - 로컬 서버 실행');
            console.log('  npm run help       - 도움말 표시');
        } else {
            console.log('\n⚠️ 일부 오류가 발견되었습니다. 위의 오류 메시지를 확인해주세요.');
            process.exit(1);
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️ 경고사항:');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
    }

    // 추가 정보 표시
    static printSystemInfo() {
        console.log('💻 시스템 정보');
        console.log('='.repeat(30));
        console.log(`Node.js: ${process.version}`);
        console.log(`플랫폼: ${process.platform}`);
        console.log(`아키텍처: ${process.arch}`);
        console.log(`작업 디렉토리: ${process.cwd()}`);
        console.log('');
    }
}

// 실행
if (require.main === module) {
    const validator = new PathValidator();
    
    if (process.argv.includes('--system-info')) {
        PathValidator.printSystemInfo();
    }
    
    if (process.argv.includes('--paths-only')) {
        pathManager.printPaths();
        process.exit(0);
    }
    
    validator.validate();
}

module.exports = PathValidator;