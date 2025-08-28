const fs = require('fs');
const path = require('path');

// 피타고리안 기대승률 계산
function calculatePythagorean(runsScored, runsAllowed, exponent = 1.83) {
    if (runsAllowed === 0) return 1;
    return Math.pow(runsScored, exponent) / 
           (Math.pow(runsScored, exponent) + Math.pow(runsAllowed, exponent));
}

// 운 지수 계산 (실제 승률 - 기대 승률)
function calculateLuckIndex(actualWinRate, expectedWinRate) {
    return actualWinRate - expectedWinRate;
}

// 메인 함수
function addPythagoreanStats() {
    try {
        // 파일 경로
        const serviceDataPath = path.join(__dirname, '../data/service-data.json');
        const teamStatsPath = path.join(__dirname, '../data/2025-team-stats.json');
        
        // 데이터 읽기
        const serviceData = JSON.parse(fs.readFileSync(serviceDataPath, 'utf8'));
        const teamStats = JSON.parse(fs.readFileSync(teamStatsPath, 'utf8'));
        
        // 각 팀의 순위 데이터에 피타고리안 통계 추가
        serviceData.standings = serviceData.standings.map(team => {
            const stats = teamStats[team.team];
            
            if (stats && stats.runs_scored && stats.runs_allowed) {
                // 피타고리안 기대승률 계산
                const expectedWinRate = calculatePythagorean(
                    stats.runs_scored, 
                    stats.runs_allowed
                );
                
                // 실제 승률 (무승부 제외)
                const actualWinRate = team.wins / (team.wins + team.losses);
                
                // 운 지수 계산
                const luckIndex = calculateLuckIndex(actualWinRate, expectedWinRate);
                
                // 기대 승수 계산
                const expectedWins = expectedWinRate * (team.wins + team.losses);
                
                return {
                    ...team,
                    runsScored: stats.runs_scored,
                    runsAllowed: stats.runs_allowed,
                    runDiff: stats.run_diff,
                    pythagoreanWinRate: Number(expectedWinRate.toFixed(4)),
                    expectedWins: Math.round(expectedWins),
                    luckIndex: Number(luckIndex.toFixed(4)),
                    luckRating: getLuckRating(luckIndex)
                };
            }
            
            return team;
        });
        
        // 운 지수에 따른 평가
        function getLuckRating(luckIndex) {
            if (luckIndex > 0.05) return '매우 행운';
            if (luckIndex > 0.02) return '행운';
            if (luckIndex > -0.02) return '보통';
            if (luckIndex > -0.05) return '불운';
            return '매우 불운';
        }
        
        // 파일 저장
        fs.writeFileSync(serviceDataPath, JSON.stringify(serviceData, null, 2));
        
        console.log('✅ 피타고리안 기대승률과 운 지수가 service-data.json에 추가되었습니다.');
        
        // 결과 출력
        console.log('\n📊 팀별 피타고리안 분석:');
        console.log('━'.repeat(80));
        console.log('팀명\t실제승률\t기대승률\t운지수\t\t평가\t\t득점\t실점\t득실차');
        console.log('━'.repeat(80));
        
        serviceData.standings.forEach(team => {
            if (team.pythagoreanWinRate) {
                console.log(
                    `${team.team}\t${team.winRate.toFixed(3)}\t\t${team.pythagoreanWinRate.toFixed(3)}\t\t${team.luckIndex > 0 ? '+' : ''}${team.luckIndex.toFixed(3)}\t\t${team.luckRating}\t${team.runsScored}\t${team.runsAllowed}\t${team.runDiff > 0 ? '+' : ''}${team.runDiff}`
                );
            }
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

// 실행
addPythagoreanStats();