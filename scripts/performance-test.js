/**
 * JSON 사전계산 방식 vs 기존 방식 성능 비교 테스트
 * 로딩 시간, 메모리 사용량, 렌더링 시간 등을 측정
 */

class PerformanceTest {
    constructor() {
        this.results = {
            originalMethod: {},
            precomputedMethod: {},
            comparison: {}
        };
    }

    // 메모리 사용량 측정
    measureMemory(label) {
        if (performance.memory) {
            return {
                label,
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
        }
        return { label, message: 'Memory API not available' };
    }

    // 네트워크 요청 시간 측정
    async measureNetworkTiming(url) {
        const startTime = performance.now();
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            const endTime = performance.now();
            
            return {
                url,
                loadTime: endTime - startTime,
                dataSize: JSON.stringify(data).length,
                status: response.status,
                success: true
            };
        } catch (error) {
            const endTime = performance.now();
            return {
                url,
                loadTime: endTime - startTime,
                error: error.message,
                success: false
            };
        }
    }

    // 렌더링 성능 측정
    async measureRenderingPerformance(renderFunction, label) {
        // 메모리 측정 시작
        const memoryBefore = this.measureMemory(`${label}_before`);
        
        // 렌더링 시간 측정
        const startTime = performance.now();
        
        try {
            await renderFunction();
            const endTime = performance.now();
            
            // 메모리 측정 완료
            const memoryAfter = this.measureMemory(`${label}_after`);
            
            return {
                label,
                renderTime: endTime - startTime,
                memoryBefore,
                memoryAfter,
                memoryDiff: memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize,
                success: true
            };
        } catch (error) {
            const endTime = performance.now();
            
            return {
                label,
                renderTime: endTime - startTime,
                error: error.message,
                success: false
            };
        }
    }

    // 전체 페이지 로드 성능 측정
    measurePageLoadPerformance() {
        if (performance.getEntriesByType) {
            const navigation = performance.getEntriesByType('navigation')[0];
            
            if (navigation) {
                return {
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
                    fullLoad: navigation.loadEventEnd - navigation.navigationStart,
                    domInteractive: navigation.domInteractive - navigation.navigationStart,
                    domComplete: navigation.domComplete - navigation.navigationStart,
                    firstPaint: this.getFirstPaintTime(),
                    firstContentfulPaint: this.getFirstContentfulPaintTime()
                };
            }
        }
        
        return { message: 'Navigation Timing API not available' };
    }

    // First Paint 시간 측정
    getFirstPaintTime() {
        try {
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? firstPaint.startTime : null;
        } catch {
            return null;
        }
    }

    // First Contentful Paint 시간 측정
    getFirstContentfulPaintTime() {
        try {
            const paintEntries = performance.getEntriesByType('paint');
            const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            return firstContentfulPaint ? firstContentfulPaint.startTime : null;
        } catch {
            return null;
        }
    }

    // 매직넘버 매트릭스 성능 테스트
    async testMagicMatrixPerformance() {
        console.log('🧪 매직넘버 매트릭스 성능 테스트 시작...');

        // 1. 사전계산 데이터 로드 테스트
        const precomputedDataTiming = await this.measureNetworkTiming('magic-number/data/ui-magic-matrix-precomputed.json');
        
        // 2. 기존 데이터 로드 테스트  
        const originalDataTiming = await this.measureNetworkTiming('magic-number/data/calc-magic-numbers.json');

        // 3. 렌더링 성능 비교 (시뮬레이션)
        const precomputedRenderTest = await this.measureRenderingPerformance(
            () => this.simulatePrecomputedMatrixRender(),
            'precomputed_matrix_render'
        );

        const originalRenderTest = await this.measureRenderingPerformance(
            () => this.simulateOriginalMatrixRender(),
            'original_matrix_render'
        );

        this.results.magicMatrix = {
            precomputedDataLoad: precomputedDataTiming,
            originalDataLoad: originalDataTiming,
            precomputedRender: precomputedRenderTest,
            originalRender: originalRenderTest
        };

        return this.results.magicMatrix;
    }

    // 루트 UI 성능 테스트
    async testRootUIPerformance() {
        console.log('🧪 루트 UI 성능 테스트 시작...');

        // 1. 사전계산 데이터 로드 테스트
        const precomputedDataTiming = await this.measureNetworkTiming('data/ui-precomputed-data.json');
        
        // 2. 기존 데이터들 로드 테스트
        const rawGameRecordsTiming = await this.measureNetworkTiming('magic-number/data/raw-game-records.json');
        const seasonGamesTiming = await this.measureNetworkTiming('magic-number/data/2025-season-games.json');

        // 3. 렌더링 성능 비교
        const precomputedRenderTest = await this.measureRenderingPerformance(
            () => this.simulatePrecomputedRootRender(),
            'precomputed_root_render'
        );

        const originalRenderTest = await this.measureRenderingPerformance(
            () => this.simulateOriginalRootRender(),
            'original_root_render'
        );

        this.results.rootUI = {
            precomputedDataLoad: precomputedDataTiming,
            originalDataLoads: [rawGameRecordsTiming, seasonGamesTiming],
            precomputedRender: precomputedRenderTest,
            originalRender: originalRenderTest
        };

        return this.results.rootUI;
    }

    // 사전계산 매트릭스 렌더링 시뮬레이션
    async simulatePrecomputedMatrixRender() {
        // 단순한 JSON 파싱과 DOM 생성만 시뮬레이션
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
            const mockData = {
                team: 'LG',
                currentRank: 1,
                remainingGames: 16,
                banner: null,
                cells: Array(9).fill({ rank: 1, label: '확보', className: 'magic-confirmed' })
            };
            
            // DOM 생성 시뮬레이션
            const div = document.createElement('div');
            div.innerHTML = `<td class="magic-cell">${mockData.cells[0].label}</td>`;
        }
    }

    // 기존 매트릭스 렌더링 시뮬레이션
    async simulateOriginalMatrixRender() {
        // 복잡한 계산과 DOM 생성 시뮬레이션
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
            // 복잡한 계산 시뮬레이션
            const mockTeam = { W: 78, L: 47, T: 3 };
            const R = 144 - (mockTeam.W + mockTeam.L + mockTeam.T);
            const winPct = mockTeam.W / (mockTeam.W + mockTeam.L);
            
            // 매직넘버 계산 시뮬레이션
            for (let rank = 1; rank <= 9; rank++) {
                const Kk_max = Math.random() * 0.7;
                const D = mockTeam.W + mockTeam.L + R;
                const rhsMagic = Kk_max * D - mockTeam.W;
                const x_strict = Math.max(0, Math.floor(rhsMagic) + 1);
                const x_clamped = Math.max(0, Math.min(R, x_strict));
            }
            
            // DOM 생성
            const div = document.createElement('div');
            div.innerHTML = `<td class="magic-cell">계산결과</td>`;
        }
    }

    // 사전계산 루트 렌더링 시뮬레이션
    async simulatePrecomputedRootRender() {
        const iterations = 500;
        
        for (let i = 0; i < iterations; i++) {
            const mockStreakData = {
                winStreaks: { 1: 5, 2: 3, 3: 2 },
                loseStreaks: { 1: 4, 2: 2, 3: 1 },
                maxWinStreak: 6,
                maxLoseStreak: 4
            };
            
            // 단순한 DOM 생성
            const table = document.createElement('table');
            table.innerHTML = `<tr><td>${mockStreakData.maxWinStreak}</td><td>${mockStreakData.maxLoseStreak}</td></tr>`;
        }
    }

    // 기존 루트 렌더링 시뮬레이션
    async simulateOriginalRootRender() {
        const iterations = 500;
        
        for (let i = 0; i < iterations; i++) {
            // 복잡한 연승/연패 계산 시뮬레이션
            const mockGames = Array(130).fill(0).map(() => ({ result: Math.random() > 0.5 ? 'W' : 'L' }));
            
            // 연승/연패 패턴 계산
            const winStreaks = {};
            const loseStreaks = {};
            let currentStreak = 0;
            let currentType = null;
            
            mockGames.forEach(game => {
                if (game.result === currentType) {
                    currentStreak++;
                } else {
                    if (currentType && currentStreak > 0) {
                        if (currentType === 'W') {
                            winStreaks[currentStreak] = (winStreaks[currentStreak] || 0) + 1;
                        } else {
                            loseStreaks[currentStreak] = (loseStreaks[currentStreak] || 0) + 1;
                        }
                    }
                    currentType = game.result;
                    currentStreak = 1;
                }
            });
            
            // DOM 생성
            const table = document.createElement('table');
            table.innerHTML = `<tr><td>계산결과</td></tr>`;
        }
    }

    // 종합 성능 분석
    async runFullPerformanceTest() {
        console.log('🚀 전체 성능 테스트 시작...');
        console.time('전체 성능 테스트');

        // 페이지 로드 성능 측정
        this.results.pageLoad = this.measurePageLoadPerformance();

        // 각 구성요소별 성능 테스트
        await this.testMagicMatrixPerformance();
        await this.testRootUIPerformance();

        // 메모리 사용량 최종 측정
        this.results.finalMemory = this.measureMemory('final');

        console.timeEnd('전체 성능 테스트');

        return this.generatePerformanceReport();
    }

    // 성능 리포트 생성
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                pageLoadTime: this.results.pageLoad?.fullLoad || 'N/A',
                memoryUsage: this.results.finalMemory?.usedJSHeapSize || 'N/A'
            },
            magicMatrix: {
                dataLoadSpeedup: this.calculateSpeedup(
                    this.results.magicMatrix?.originalDataLoad?.loadTime,
                    this.results.magicMatrix?.precomputedDataLoad?.loadTime
                ),
                renderSpeedup: this.calculateSpeedup(
                    this.results.magicMatrix?.originalRender?.renderTime,
                    this.results.magicMatrix?.precomputedRender?.renderTime
                )
            },
            rootUI: {
                dataLoadSpeedup: this.calculateDataLoadSpeedup(),
                renderSpeedup: this.calculateSpeedup(
                    this.results.rootUI?.originalRender?.renderTime,
                    this.results.rootUI?.precomputedRender?.renderTime
                )
            },
            recommendations: this.generateRecommendations()
        };

        console.log('📊 성능 테스트 결과:');
        console.table(report.summary);
        console.table(report.magicMatrix);
        console.table(report.rootUI);

        return report;
    }

    // 속도 향상 계산
    calculateSpeedup(originalTime, optimizedTime) {
        if (!originalTime || !optimizedTime) return 'N/A';
        
        const speedup = originalTime / optimizedTime;
        const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
        
        return {
            speedup: `${speedup.toFixed(2)}x`,
            improvement: `${improvement}%`,
            original: `${originalTime.toFixed(2)}ms`,
            optimized: `${optimizedTime.toFixed(2)}ms`
        };
    }

    // 데이터 로드 속도 향상 계산 (여러 파일 vs 단일 파일)
    calculateDataLoadSpeedup() {
        if (!this.results.rootUI) return 'N/A';
        
        const originalTotalTime = this.results.rootUI.originalDataLoads?.reduce(
            (total, timing) => total + (timing.loadTime || 0), 0
        ) || 0;
        
        const optimizedTime = this.results.rootUI.precomputedDataLoad?.loadTime || 0;
        
        return this.calculateSpeedup(originalTotalTime, optimizedTime);
    }

    // 권장사항 생성
    generateRecommendations() {
        const recommendations = [];

        // 메모리 사용량 기반 권장사항
        if (this.results.finalMemory?.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB 초과
            recommendations.push('메모리 사용량이 높습니다. 데이터 정리 및 가비지 컬렉션을 고려하세요.');
        }

        // 렌더링 시간 기반 권장사항
        if (this.results.magicMatrix?.precomputedRender?.renderTime > 100) {
            recommendations.push('매트릭스 렌더링 시간이 높습니다. Virtual DOM 또는 청크 렌더링을 고려하세요.');
        }

        if (recommendations.length === 0) {
            recommendations.push('성능이 양호합니다. 현재 최적화 상태를 유지하세요.');
        }

        return recommendations;
    }
}

// 전역 함수로 노출
window.performanceTest = new PerformanceTest();
window.runPerformanceTest = () => window.performanceTest.runFullPerformanceTest();

// 페이지 로드 완료 후 자동 실행 (개발 모드일 때만)
if (window.location.search.includes('perf=true')) {
    window.addEventListener('load', () => {
        setTimeout(() => window.runPerformanceTest(), 1000);
    });
}

console.log('🧪 성능 테스트 도구 로드 완료. window.runPerformanceTest() 실행으로 테스트 시작 가능');