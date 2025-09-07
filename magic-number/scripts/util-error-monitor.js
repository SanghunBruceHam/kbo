/**
 * KBO 매직넘버 계산기 - 에러 모니터링 시스템
 * - 클라이언트 사이드 에러 추적
 * - 성능 모니터링
 * - 사용자 경험 분석
 * - 서비스 영향 없는 백그라운드 로깅
 */

class ErrorMonitor {
    constructor() {
        this.isEnabled = true;
        this.errors = [];
        this.maxErrors = 100; // 메모리 보호
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        
        // 사용자 환경 정보
        this.userAgent = this.getUserAgent();
        this.pageUrl = window.location.href;
        
        this.init();
    }
    
    init() {
        // 전역 에러 핸들러
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
        });
        
        // Promise rejection 핸들러  
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'promise',
                message: 'Unhandled Promise Rejection',
                reason: event.reason?.toString() || 'Unknown',
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
        });
        
        // 리소스 로딩 에러
        window.addEventListener('error', (event) => {
            if (event.target && event.target !== window) {
                this.logError({
                    type: 'resource',
                    message: 'Resource loading failed',
                    element: event.target.tagName,
                    source: event.target.src || event.target.href || 'unknown',
                    timestamp: new Date().toISOString()
                });
            }
        }, true);
        
        // 페이지 언로드 시 에러 정리
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // 개발자 도구를 위한 글로벌 접근
        window.ErrorMonitor = this;
        
        console.log('🔍 에러 모니터링 시스템 초기화 완료');
    }
    
    /**
     * 에러 로깅
     */
    logError(errorData) {
        if (!this.isEnabled) return;
        
        const enhancedError = {
            ...errorData,
            sessionId: this.sessionId,
            url: this.pageUrl,
            userAgent: this.userAgent,
            timestamp: errorData.timestamp || new Date().toISOString(),
            id: this.generateErrorId()
        };
        
        // 메모리 보호
        if (this.errors.length >= this.maxErrors) {
            this.errors.shift(); // 가장 오래된 에러 제거
        }
        
        this.errors.push(enhancedError);
        
        // 콘솔에 출력 (개발 환경에서만)
        if (this.isDevelopment()) {
            console.error('🚨 에러 감지:', enhancedError);
        }
        
        // 중요한 에러는 즉시 처리
        if (this.isCriticalError(errorData)) {
            this.handleCriticalError(enhancedError);
        }
    }
    
    /**
     * 성능 이슈 로깅
     */
    logPerformanceIssue(issueData) {
        if (!this.isEnabled) return;
        
        this.logError({
            type: 'performance',
            ...issueData,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 사용자 액션 에러 로깅
     */
    logUserActionError(action, errorMessage) {
        if (!this.isEnabled) return;
        
        this.logError({
            type: 'user_action',
            action: action,
            message: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 데이터 로딩 에러 로깅
     */
    logDataError(dataType, errorMessage, details = {}) {
        if (!this.isEnabled) return;
        
        this.logError({
            type: 'data_loading',
            dataType: dataType,
            message: errorMessage,
            details: details,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 중요한 에러인지 판단
     */
    isCriticalError(errorData) {
        const criticalPatterns = [
            /cannot read property/i,
            /is not defined/i,
            /network error/i,
            /failed to fetch/i,
            /service unavailable/i
        ];
        
        const message = errorData.message || '';
        return criticalPatterns.some(pattern => pattern.test(message));
    }
    
    /**
     * 중요한 에러 처리
     */
    handleCriticalError(errorData) {
        // 사용자에게 친화적인 알림 (선택적)
        if (errorData.type === 'data_loading') {
            // 데이터 로딩 실패 시 백업 데이터 사용 제안
            console.warn('⚠️ 데이터 로딩 실패 - 백업 시스템 검토 필요');
        }
    }
    
    /**
     * 에러 통계 조회
     */
    getErrorStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            recent: this.errors.slice(-10),
            session: {
                id: this.sessionId,
                duration: Date.now() - this.startTime,
                url: this.pageUrl
            }
        };
        
        // 타입별 집계
        this.errors.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * 에러 리포트 생성
     */
    generateReport() {
        const stats = this.getErrorStats();
        
        const report = {
            summary: {
                totalErrors: stats.total,
                sessionDuration: `${Math.round(stats.session.duration / 1000)}초`,
                errorTypes: Object.keys(stats.byType).length,
                url: stats.session.url
            },
            errorBreakdown: stats.byType,
            recentErrors: stats.recent,
            userAgent: this.userAgent,
            timestamp: new Date().toISOString()
        };
        
        return report;
    }
    
    /**
     * 에러 리포트 출력
     */
    printReport() {
        const report = this.generateReport();
        
        console.group('📊 에러 모니터링 리포트');
        console.log('📈 요약:', report.summary);
        console.log('📋 타입별 에러:', report.errorBreakdown);
        console.log('🕒 최근 에러 (최대 10개):', report.recentErrors);
        console.groupEnd();
        
        return report;
    }
    
    /**
     * 모니터링 활성화/비활성화
     */
    toggle(enabled = null) {
        this.isEnabled = enabled !== null ? enabled : !this.isEnabled;
        console.log(`🔍 에러 모니터링: ${this.isEnabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 에러 로그 초기화
     */
    clearErrors() {
        this.errors = [];
        console.log('🧹 에러 로그 초기화 완료');
    }
    
    /**
     * 정리 작업
     */
    cleanup() {
        if (this.errors.length > 0 && this.isDevelopment()) {
            console.log(`🔍 세션 종료: ${this.errors.length}개 에러 감지됨`);
            this.printReport();
        }
    }
    
    // 유틸리티 함수들
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateErrorId() {
        return 'error_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    
    getUserAgent() {
        return {
            browser: this.getBrowserName(),
            version: this.getBrowserVersion(),
            os: this.getOS(),
            mobile: this.isMobile(),
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }
    
    getBrowserName() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Unknown';
    }
    
    getBrowserVersion() {
        const userAgent = navigator.userAgent;
        const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/([0-9.]+)/);
        return match ? match[2] : 'Unknown';
    }
    
    getOS() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac OS X')) return 'macOS';
        if (userAgent.includes('Linux')) return 'Linux';
        if (userAgent.includes('Android')) return 'Android';
        if (userAgent.includes('iOS')) return 'iOS';
        return 'Unknown';
    }
    
    isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname.includes('127.0.0.1') ||
               window.location.search.includes('debug=true');
    }
}

// 전역 에러 모니터 초기화
const errorMonitor = new ErrorMonitor();

// 기존 애플리케이션과의 통합을 위한 유틸리티
window.logDataError = (dataType, message, details) => {
    errorMonitor.logDataError(dataType, message, details);
};

window.logUserError = (action, message) => {
    errorMonitor.logUserActionError(action, message);
};

window.logPerformanceIssue = (issueData) => {
    errorMonitor.logPerformanceIssue(issueData);
};

// 개발자 도구용 명령어
window.errorReport = () => errorMonitor.printReport();
window.clearErrors = () => errorMonitor.clearErrors();

// Export removed for browser compatibility
// export default errorMonitor;