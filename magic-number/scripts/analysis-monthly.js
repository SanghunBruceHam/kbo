const fs = require('fs');
const path = require('path');
const CommonUtils = require('../config/common-utils');

function generateMonthlyRecords() {
    console.log('📅 월별 기록 분석 시작...');
    
    try {
        // 게임 데이터 로드
        const gamesPath = path.join(__dirname, '../data/2025-season-games.json');
        if (!fs.existsSync(gamesPath)) {
            console.error('❌ 2025-season-games.json 파일을 찾을 수 없습니다.');
            return;
        }
        
        const gamesData = fs.readFileSync(gamesPath, 'utf-8');
        const games = JSON.parse(gamesData);
        
        // 실제 게임 데이터에서 팀 이름 수집
        const actualTeams = new Set();
        games.forEach(game => {
            actualTeams.add(game.home_team);
            actualTeams.add(game.away_team);
        });

        const teams = Array.from(actualTeams);
        const monthlyStats = {};

        // 팀/월 단위로 초기화
        teams.forEach(team => {
            monthlyStats[team] = {};
        });
        
        // 각 경기 월별 처리 (페넌트레이스 완료 경기만)
        games.forEach(game => {
            // 페넌트레이스이면서 완료된 경기만 처리
            if (!game.category || !game.category.includes('페넌트레이스') ||
                !game.state || game.state !== '종료') {
                return; // 페넌트레이스가 아니거나 완료되지 않은 경기는 제외
            }

            const date = new Date(game.date);
            const month = date.getMonth() + 1; // 1-12월
            
            // 홈팀 처리
            if (monthlyStats[game.home_team]) {
                if (!monthlyStats[game.home_team][month]) {
                    monthlyStats[game.home_team][month] = {
                        wins: 0, losses: 0, draws: 0,
                        runs_scored: 0, runs_allowed: 0
                    };
                }
                const homeStats = monthlyStats[game.home_team][month];
                homeStats.runs_scored += game.home_score;
                homeStats.runs_allowed += game.away_score;

                if (game.winner === game.home_team) homeStats.wins++;
                else if (game.winner === game.away_team) homeStats.losses++;
                else homeStats.draws++;
            }

            // 원정팀 처리
            if (monthlyStats[game.away_team]) {
                if (!monthlyStats[game.away_team][month]) {
                    monthlyStats[game.away_team][month] = {
                        wins: 0, losses: 0, draws: 0,
                        runs_scored: 0, runs_allowed: 0
                    };
                }
                const awayStats = monthlyStats[game.away_team][month];
                awayStats.runs_scored += game.away_score;
                awayStats.runs_allowed += game.home_score;

                if (game.winner === game.away_team) awayStats.wins++;
                else if (game.winner === game.home_team) awayStats.losses++;
                else awayStats.draws++;
            }
        });
        
        // 결과 정리 - DB와 동일한 구조
        const result = {
            ...CommonUtils.result.createDetailedUpdateMetadata(),
            monthlyRecords: {}
        };
        
        teams.forEach(team => {
            result.monthlyRecords[team] = [];
            
            for (let month = 1; month <= 12; month++) {
                if (monthlyStats[team][month]) {
                    const stats = monthlyStats[team][month];
                    const games = stats.wins + stats.losses + stats.draws;
                    const winRate = stats.wins + stats.losses > 0 ? 
                        (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
                    
                    result.monthlyRecords[team].push({
                        month,
                        wins: stats.wins,
                        losses: stats.losses,
                        draws: stats.draws,
                        games,
                        win_rate: winRate,
                        runs_scored: stats.runs_scored,
                        runs_allowed: stats.runs_allowed
                    });
                }
            }
        });
        
        // JSON 파일로 저장
        const outputPath = path.join(__dirname, '../data/analysis-monthly.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        
        console.log(`✅ 월별 기록 분석 완료: ${outputPath}`);
        console.log(`📊 처리된 경기 수: ${games.length}개`);
        
        return result;
        
    } catch (error) {
        console.error('❌ 월별 기록 분석 중 오류 발생:', error);
        throw error;
    }
}

// 실행
if (require.main === module) {
    generateMonthlyRecords();
}

module.exports = { generateMonthlyRecords };