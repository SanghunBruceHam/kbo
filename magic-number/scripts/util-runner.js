#!/usr/bin/env node

/**
 * 크로스플랫폼 스크립트 런너
 * Windows/macOS/Linux에서 일관되게 스크립트를 실행
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const pathManager = require('../../config/paths');

class CrossPlatformRunner {
    static async run(args) {
        if (args.length < 3) {
            console.log('사용법: node magic-number/scripts/runner.js <스크립트경로> [인자...]');
            console.log('예시:');
            console.log('  node magic-number/scripts/util-runner.js magic-number/scripts/02_season-data-processor.js');
            console.log('  node magic-number/scripts/runner.js magic-number/crawlers/kbo-python-working-crawler.py');
            process.exit(1);
        }

        const scriptPath = args[2];
        const scriptArgs = args.slice(3);

        try {
            await this.runScript(scriptPath, scriptArgs);
        } catch (error) {
            console.error('❌ 스크립트 실행 실패:', error.message);
            process.exit(1);
        }
    }

    static async runScript(scriptPath, args = []) {
        const isWindows = os.platform() === 'win32';
        const absolutePath = path.resolve(pathManager.projectRoot, scriptPath);
        
        console.log(`🚀 스크립트 실행: ${absolutePath}`);
        console.log(`📁 작업 디렉토리: ${pathManager.projectRoot}`);
        console.log(`💻 플랫폼: ${os.platform()}`);

        if (!require('fs').existsSync(absolutePath)) {
            throw new Error(`스크립트 파일을 찾을 수 없습니다: ${absolutePath}`);
        }

        let command, commandArgs;

        if (scriptPath.endsWith('.py')) {
            // Python 스크립트
            command = isWindows ? 'python' : 'python3';
            commandArgs = [absolutePath, ...args];
        } else if (scriptPath.endsWith('.sh')) {
            // Shell 스크립트
            if (isWindows) {
                // Windows에서 bash 사용
                command = 'bash';
                commandArgs = [absolutePath, ...args];
            } else {
                command = 'bash';
                commandArgs = [absolutePath, ...args];
            }
        } else if (scriptPath.endsWith('.js')) {
            // Node.js 스크립트
            command = 'node';
            commandArgs = [absolutePath, ...args];
        } else {
            throw new Error(`지원하지 않는 스크립트 형식: ${scriptPath}`);
        }

        return this.runCommand(command, commandArgs);
    }

    static runCommand(command, args) {
        return new Promise((resolve, reject) => {
            console.log(`▶️ 실행: ${command} ${args.join(' ')}`);
            
            const child = spawn(command, args, {
                stdio: 'inherit',
                cwd: pathManager.projectRoot,
                shell: os.platform() === 'win32'
            });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ 스크립트 실행 완료');
                    resolve();
                } else {
                    reject(new Error(`프로세스가 코드 ${code}로 종료됨`));
                }
            });

            child.on('error', (error) => {
                reject(new Error(`실행 오류: ${error.message}`));
            });
        });
    }

    static printHelp() {
        console.log('🔧 KBO 크로스플랫폼 스크립트 런너');
        console.log('');
        console.log('사용 가능한 스크립트:');
        console.log('  📊 데이터 처리:');
        console.log('    magic-number/scripts/02_season-data-processor.js    - 시즌 데이터 처리');
        console.log('');
        console.log('  🕷️ 크롤링:');
        console.log('    magic-number/crawlers/kbo-python-working-crawler.py - KBO 데이터 크롤링');
        console.log('');
        console.log('  🔧 자동화:');
        console.log('    archive/automation-scripts/auto-update.sh - 자동 업데이트');
        console.log('    archive/automation-scripts/daily-update.sh - 일일 업데이트');
        console.log('');
        console.log('예시:');
        console.log('  node magic-number/scripts/util-runner.js magic-number/scripts/02_season-data-processor.js');
        console.log('  npm run process  (package.json 스크립트 사용)');
    }
}

// 직접 실행시
if (require.main === module) {
    const args = process.argv;
    
    if (args.includes('--help') || args.includes('-h')) {
        CrossPlatformRunner.printHelp();
    } else {
        CrossPlatformRunner.run(args);
    }
}

module.exports = CrossPlatformRunner;