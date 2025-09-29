/**
 * KBO 프로젝트 공통 유틸리티 함수들
 * 중복 코드 방지 및 일관성 유지
 */

const CommonUtils = {
    /**
     * 날짜 포맷팅 유틸리티
     */
    date: {
        /**
         * 현재 시간을 ISO 문자열로 반환
         */
        getCurrentISO() {
            return new Date().toISOString();
        },

        /**
         * 현재 날짜를 한국어 형식으로 반환
         */
        getCurrentKorean() {
            return new Date().toLocaleDateString('ko-KR');
        },

        /**
         * 현재 날짜를 상세 한국어 형식으로 반환 (년 월 일)
         */
        getCurrentKoreanDetailed() {
            return new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'Asia/Seoul'
            });
        },

        /**
         * 현재 날짜를 요일 포함 상세 형식으로 반환
         */
        getCurrentKoreanWithWeekday() {
            return new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        },

        /**
         * 특정 날짜를 한국어 월-일 형식으로 반환
         */
        toKoreanShort(date) {
            return date.toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric'
            });
        },

        /**
         * 백업용 날짜 문자열 생성 (YYYY-MM-DD)
         */
        getBackupDateString() {
            return new Date().toISOString().slice(0, 10);
        }
    },

    /**
     * 숫자 계산 및 포맷팅 유틸리티
     */
    number: {
        /**
         * 승률 계산 (소수점 3자리)
         */
        calculateWinRate(wins, losses, draws = 0) {
            const decisiveGames = wins + losses;
            if (decisiveGames === 0) return '0.000';
            return (wins / decisiveGames).toFixed(3);
        },

        /**
         * 승률 계산 (퍼센트, 소수점 1자리)
         */
        calculateWinRatePercent(wins, losses, draws = 0) {
            const decisiveGames = wins + losses;
            if (decisiveGames === 0) return '0.0';
            return ((wins / decisiveGames) * 100).toFixed(1);
        },

        /**
         * 파일 크기를 KB로 변환
         */
        bytesToKB(bytes) {
            return Math.round(bytes / 1024);
        },

        /**
         * 숫자를 안전하게 parseFloat 후 toFixed
         */
        safeToFixed(value, decimals = 3) {
            return parseFloat(Number(value).toFixed(decimals));
        },

        /**
         * 평균 계산 (소수점 2자리)
         */
        calculateAverage(total, count) {
            if (count === 0) return '0.00';
            return (total / count).toFixed(2);
        }
    },

    /**
     * 공통 JSON 결과 구조 생성
     */
    result: {
        /**
         * 표준 업데이트 메타데이터 생성
         */
        createUpdateMetadata() {
            return {
                lastUpdated: CommonUtils.date.getCurrentISO(),
                updateDate: CommonUtils.date.getCurrentKorean()
            };
        },

        /**
         * 상세 업데이트 메타데이터 생성 (stats-comprehensive 스타일)
         */
        createDetailedUpdateMetadata() {
            return {
                updateTime: CommonUtils.date.getCurrentISO(),
                updateDate: CommonUtils.date.getCurrentKoreanDetailed()
            };
        }
    },

    /**
     * 에러 처리 유틸리티
     */
    error: {
        /**
         * 표준 에러 데이터 생성
         */
        createErrorData(error, context = '') {
            return {
                timestamp: CommonUtils.date.getCurrentISO(),
                message: error.message,
                stack: error.stack,
                context: context
            };
        }
    }
};

module.exports = CommonUtils;