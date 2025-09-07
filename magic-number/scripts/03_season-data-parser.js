const fs = require('fs');
const path = require('path');

function parseSeasonData() {
    const dataPath = path.join(__dirname, '../data/2025-season-data-clean.txt');
    const data = fs.readFileSync(dataPath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim());
    
    const games = [];
    let currentDate = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // 날짜 패턴: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            currentDate = trimmed;
        }
        // 경기 결과 패턴: 팀1 스코어1:스코어2 팀2(H)
        else if (trimmed.includes(':') && currentDate) {
            const match = trimmed.match(/^(.+?)\s+(\d+):(\d+)\s+(.+?)$/);
            if (match) {
                const [_, team1, score1, score2, team2AndHome] = match;
                
                // 홈팀 표시 (H) 분리
                const isTeam2Home = team2AndHome.endsWith('(H)');
                const team2 = team2AndHome.replace('(H)', '').trim();
                
                games.push({
                    date: currentDate,
                    away_team: isTeam2Home ? team1 : team2,
                    home_team: isTeam2Home ? team2 : team1,
                    away_score: isTeam2Home ? parseInt(score1) : parseInt(score2),
                    home_score: isTeam2Home ? parseInt(score2) : parseInt(score1),
                    winner: parseInt(score1) > parseInt(score2) ? team1 : 
                           (parseInt(score1) < parseInt(score2) ? team2 : 'draw')
                });
            }
        }
    }
    
    // JSON 파일로 저장
    const outputPath = path.join(__dirname, '../data/2025-season-games.json');
    fs.writeFileSync(outputPath, JSON.stringify(games, null, 2), 'utf-8');
    
    console.log(`✅ ${games.length}개의 경기 데이터를 파싱했습니다.`);
    console.log(`📁 저장 위치: ${outputPath}`);
    
    // 팀별 통계
    const teamStats = {};
    const teams = ['KIA', 'LG', '삼성', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '키움'];
    
    teams.forEach(team => {
        teamStats[team] = {
            games: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            runs_scored: 0,
            runs_allowed: 0
        };
    });
    
    games.forEach(game => {
        const { home_team, away_team, home_score, away_score, winner } = game;
        
        // 홈팀 통계
        if (teamStats[home_team]) {
            teamStats[home_team].games++;
            teamStats[home_team].runs_scored += home_score;
            teamStats[home_team].runs_allowed += away_score;
            
            if (winner === home_team) {
                teamStats[home_team].wins++;
            } else if (winner === away_team) {
                teamStats[home_team].losses++;
            } else {
                teamStats[home_team].draws++;
            }
        }
        
        // 원정팀 통계
        if (teamStats[away_team]) {
            teamStats[away_team].games++;
            teamStats[away_team].runs_scored += away_score;
            teamStats[away_team].runs_allowed += home_score;
            
            if (winner === away_team) {
                teamStats[away_team].wins++;
            } else if (winner === home_team) {
                teamStats[away_team].losses++;
            } else {
                teamStats[away_team].draws++;
            }
        }
    });
    
    // 승률 계산
    Object.keys(teamStats).forEach(team => {
        const stats = teamStats[team];
        stats.win_rate = stats.games > 0 ? 
            (stats.wins / (stats.wins + stats.losses)).toFixed(3) : '0.000';
        stats.run_diff = stats.runs_scored - stats.runs_allowed;
    });
    
    // 팀 통계 저장
    const statsPath = path.join(__dirname, '../data/2025-team-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(teamStats, null, 2), 'utf-8');
    console.log(`📊 팀별 통계 저장: ${statsPath}`);
    
    return { games, teamStats };
}

// 실행
if (require.main === module) {
    parseSeasonData();
}

module.exports = { parseSeasonData };