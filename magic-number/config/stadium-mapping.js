/**
 * KBO 팀별 경기장 매핑 설정
 * 모든 스크립트에서 공통으로 사용하는 경기장 정보
 */

const STADIUM_CONFIG = {
    // 팀별 홈구장 (간단한 이름)
    homeStadiums: {
        'LG': '잠실',
        '두산': '잠실',
        '키움': '고척',
        '한화': '대전',
        'KT': '수원',
        'SSG': '인천',
        '삼성': '대구',
        'NC': '창원',
        'KIA': '광주',
        '롯데': '사직'
    },

    // 팀별 정식 경기장명 (LG/두산 구분)
    stadiums: {
        'KIA': '광주 챔피언스필드',
        'LG': '서울 잠실야구장 (LG)',
        '두산': '서울 잠실야구장 (두산)',
        '삼성': '대구 삼성라이온즈파크',
        'SSG': '인천 SSG랜더스필드',
        'KT': '수원 KT위즈파크',
        'NC': '창원 NC파크',
        '롯데': '부산 사직야구장',
        '한화': '대전 한화생명이글스파크',
        '키움': '서울 고척스카이돔'
    },

    // HTML 표시용 매핑
    stadiumDisplayMap: {
        '광주 챔피언스필드': 'KIA',
        '서울 잠실야구장 (LG)': 'LG',
        '서울 잠실야구장 (두산)': '두산',
        '대구 삼성라이온즈파크': '삼성',
        '인천 SSG랜더스필드': 'SSG',
        '수원 KT위즈파크': 'KT',
        '창원 NC파크': 'NC',
        '부산 사직야구장': '롯데',
        '대전 한화생명이글스파크': '한화',
        '서울 고척스카이돔': '키움'
    }
};

// 헬퍼 함수들
const StadiumHelper = {
    /**
     * 팀의 홈구장 반환 (정식명)
     */
    getStadium(homeTeam) {
        return STADIUM_CONFIG.stadiums[homeTeam] || '미상';
    },

    /**
     * 팀의 홈구장 반환 (간단명)
     */
    getHomeStadium(team) {
        return STADIUM_CONFIG.homeStadiums[team] || '알 수 없음';
    },

    /**
     * 경기장명에서 홈팀 추출
     */
    getTeamFromStadium(stadium) {
        return STADIUM_CONFIG.stadiumDisplayMap[stadium] || null;
    },

    /**
     * 홈/원정 경기장 결정
     */
    getGameStadium(opponent, isHome, currentTeam) {
        if (isHome) {
            return this.getHomeStadium(currentTeam);
        } else {
            return this.getHomeStadium(opponent);
        }
    }
};

module.exports = {
    STADIUM_CONFIG,
    StadiumHelper
};