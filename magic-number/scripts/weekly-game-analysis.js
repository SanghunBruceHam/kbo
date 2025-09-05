const fs = require('fs');
const path = require('path');

// 데이터 경로
const DATA_PATH = path.join(__dirname, '../data');
const gamesFile = path.join(DATA_PATH, '2025-season-games.json');
const teamStatsFile = path.join(DATA_PATH, '2025-team-stats.json');

// 팀 목록
const TEAMS = ['KIA', 'LG', '삼성', '두산', 'SSG', '롯데', 'KT', '한화', '키움', 'NC'];

/**
 * 주차별 성적 분석 함수
 */
function analyzeWeeklyPerformance(games) {
    const weeklyStats = {};
    
    games.forEach(game => {
        const gameDate = new Date(game.date);
        const yearWeek = getYearWeek(gameDate);
        
        if (!weeklyStats[yearWeek]) {
            weeklyStats[yearWeek] = {
                week: yearWeek,
                startDate: getWeekStartDate(gameDate),
                endDate: getWeekEndDate(gameDate),
                teams: {}
            };
            
            // 모든 팀 초기화
            TEAMS.forEach(team => {
                weeklyStats[yearWeek].teams[team] = {
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    runs_scored: 0,
                    runs_allowed: 0
                };
            });
        }
        
        const week = weeklyStats[yearWeek];
        
        // 원정팀 통계 업데이트
        week.teams[game.away_team].games++;
        week.teams[game.away_team].runs_scored += game.away_score;
        week.teams[game.away_team].runs_allowed += game.home_score;
        
        // 홈팀 통계 업데이트
        week.teams[game.home_team].games++;
        week.teams[game.home_team].runs_scored += game.home_score;
        week.teams[game.home_team].runs_allowed += game.away_score;
        
        // 승부 결과 처리
        if (game.away_score === game.home_score) {
            // 무승부
            week.teams[game.away_team].draws++;
            week.teams[game.home_team].draws++;
        } else if (game.winner === game.away_team) {
            // 원정팀 승리
            week.teams[game.away_team].wins++;
            week.teams[game.home_team].losses++;
        } else {
            // 홈팀 승리
            week.teams[game.home_team].wins++;
            week.teams[game.away_team].losses++;
        }
    });
    
    // 승률 계산
    Object.keys(weeklyStats).forEach(week => {
        Object.keys(weeklyStats[week].teams).forEach(team => {
            const stats = weeklyStats[week].teams[team];
            if (stats.games > 0) {
                stats.win_rate = ((stats.wins / (stats.wins + stats.losses)) || 0).toFixed(3);
                stats.run_diff = stats.runs_scored - stats.runs_allowed;
            }
        });
    });
    
    return weeklyStats;
}

/**
 * 게임별 승패 기록과 연승/연패 분석
 */
function analyzeGameByGameRecord(games) {
    const teamRecords = {};
    
    // 팀별 기록 초기화
    TEAMS.forEach(team => {
        teamRecords[team] = {
            games: [],
            currentStreak: { type: null, count: 0 },
            longestWinStreak: 0,
            longestLoseStreak: 0,
            streaks: []
        };
    });
    
    // 날짜순 정렬
    const sortedGames = games.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedGames.forEach((game, index) => {
        const { away_team, home_team, away_score, home_score, date, winner } = game;
        
        // 각 팀의 게임 결과 기록
        [away_team, home_team].forEach(team => {
            const isHome = team === home_team;
            const teamScore = isHome ? home_score : away_score;
            const opponentScore = isHome ? away_score : home_score;
            const opponent = isHome ? away_team : home_team;
            
            let result;
            if (teamScore === opponentScore) {
                result = 'D'; // 무승부
            } else if (winner === team) {
                result = 'W'; // 승리
            } else {
                result = 'L'; // 패배
            }
            
            const gameRecord = {
                gameNumber: teamRecords[team].games.length + 1,
                date: date,
                opponent: opponent,
                isHome: isHome,
                score: `${teamScore}:${opponentScore}`,
                result: result,
                runs_scored: teamScore,
                runs_allowed: opponentScore
            };
            
            teamRecords[team].games.push(gameRecord);
            
            // 연승/연패 계산
            updateStreakRecord(teamRecords[team], result);
        });
    });
    
    return teamRecords;
}

/**
 * 연승/연패 기록 업데이트
 */
function updateStreakRecord(teamRecord, result) {
    const current = teamRecord.currentStreak;
    
    if (result === 'D') {
        // 무승부는 연승/연패를 끊음
        if (current.count > 0) {
            teamRecord.streaks.push({...current});
        }
        current.type = null;
        current.count = 0;
    } else if (current.type === result) {
        // 연승/연패 계속
        current.count++;
    } else {
        // 연승/연패 끊김
        if (current.count > 0) {
            teamRecord.streaks.push({...current});
        }
        current.type = result;
        current.count = 1;
    }
    
    // 최장 연승/연패 기록 업데이트
    if (result === 'W' && current.count > teamRecord.longestWinStreak) {
        teamRecord.longestWinStreak = current.count;
    } else if (result === 'L' && current.count > teamRecord.longestLoseStreak) {
        teamRecord.longestLoseStreak = current.count;
    }
}

/**
 * 연도-주차 계산
 */
function getYearWeek(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * 주차 시작일 계산
 */
function getWeekStartDate(date) {
    const dayOfWeek = date.getDay();
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - dayOfWeek);
    return startDate.toISOString().split('T')[0];
}

/**
 * 주차 종료일 계산
 */
function getWeekEndDate(date) {
    const dayOfWeek = date.getDay();
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + (6 - dayOfWeek));
    return endDate.toISOString().split('T')[0];
}

/**
 * 메인 함수
 */
async function main() {
    try {
        console.log('📊 주차별 성적 및 게임별 기록 분석 시작...');
        
        // 게임 데이터 로드
        const gamesData = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));
        console.log(`🎮 총 ${gamesData.length}경기 데이터 로드 완료`);
        
        // 주차별 성적 분석
        console.log('📅 주차별 성적 분석 중...');
        const weeklyStats = analyzeWeeklyPerformance(gamesData);
        
        // 게임별 기록 분석
        console.log('🏆 게임별 승패 기록 분석 중...');
        const gameRecords = analyzeGameByGameRecord(gamesData);
        
        // 결과 저장
        const outputPath = path.join(DATA_PATH, 'weekly-analysis.json');
        const gameRecordsPath = path.join(DATA_PATH, 'game-by-game-records.json');
        
        fs.writeFileSync(outputPath, JSON.stringify(weeklyStats, null, 2), 'utf8');
        fs.writeFileSync(gameRecordsPath, JSON.stringify(gameRecords, null, 2), 'utf8');
        
        console.log('✅ 분석 완료!');
        console.log(`📄 주차별 통계: ${outputPath}`);
        console.log(`📄 게임별 기록: ${gameRecordsPath}`);
        
        // 간단한 통계 출력
        const weekCount = Object.keys(weeklyStats).length;
        console.log(`\n📈 통계 요약:`);
        console.log(`- 총 ${weekCount}주차 데이터 생성`);
        console.log(`- 팀별 게임 기록:`);
        
        TEAMS.forEach(team => {
            const record = gameRecords[team];
            const totalGames = record.games.length;
            const wins = record.games.filter(g => g.result === 'W').length;
            const losses = record.games.filter(g => g.result === 'L').length;
            const draws = record.games.filter(g => g.result === 'D').length;
            
            console.log(`  ${team}: ${totalGames}경기 (${wins}승 ${losses}패 ${draws}무) - 최장연승: ${record.longestWinStreak}, 최장연패: ${record.longestLoseStreak}`);
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    analyzeWeeklyPerformance,
    analyzeGameByGameRecord
};