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
        
        // 날짜 패턴: YYYY-MM-DD (요일) 또는 YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}(\s*\([월화수목금토일]\))?$/.test(trimmed)) {
            currentDate = trimmed.replace(/\s*\([월화수목금토일]\)/, ''); // 요일 정보 제거
        }
        // 새로운 형식 패턴: "시간 상태 구장 홈팀 어웨이팀 점수 방송사 구분"
        else if (trimmed && currentDate) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 8) {
                const [time, state, stadium, homeTeam, awayTeam, scoreOrStatus, broadcast, ...categoryParts] = parts;
                const category = categoryParts.join(' ');

                // 완료된 경기만 처리 (취소/연기 경기 제외)
                if (state === '종료' || state === '완료' || state === '끝') {
                    // 점수 파싱 (away:home 형식)
                    const scoreMatch = scoreOrStatus.match(/^(\d+):(\d+)$/);
                    if (scoreMatch) {
                        const [, awayScore, homeScore] = scoreMatch;
                        const away_score = parseInt(awayScore);
                        const home_score = parseInt(homeScore);

                        games.push({
                            date: currentDate,
                            time: time,
                            stadium: stadium,
                            away_team: awayTeam,
                            home_team: homeTeam,
                            away_score: away_score,
                            home_score: home_score,
                            winner: away_score > home_score ? awayTeam :
                                   (away_score < home_score ? homeTeam : 'draw'),
                            broadcast: broadcast,
                            category: category,
                            state: state
                        });
                    }
                }
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