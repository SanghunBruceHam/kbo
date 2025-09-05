const fs = require('fs');
const path = require('path');

const MAGIC_NUMBER_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(MAGIC_NUMBER_DIR, 'data');
const SERVICE_DATA_PATH = path.join(DATA_DIR, 'service-data.json');

function loadServiceData() {
    try {
        return JSON.parse(fs.readFileSync(SERVICE_DATA_PATH, 'utf8'));
    } catch (error) {
        console.error('❌ service-data.json 파일을 읽을 수 없습니다:', error.message);
        process.exit(1);
    }
}

function calculateMagicNumbers(serviceData) {
    const standings = serviceData.standings;
    const totalGames = 144;
    
    console.log('📊 KBO 매직넘버 계산 시작 (승수 기반)...');
    
    // 1. 모든 팀의 최대가능 승수 계산 (현재 승수 + 잔여 경기)
    const teamMaxStats = standings.map(team => {
        const maxWins = team.wins + team.remainingGames;
        const maxLosses = team.losses; // 잔여경기를 모두 이기므로 패수는 현재와 동일
        const maxWinRate = maxWins / (maxWins + maxLosses);
        
        return {
            team: team.team,
            currentWins: team.wins,
            currentLosses: team.losses,
            remainingGames: team.remainingGames,
            maxWins: maxWins,
            maxLosses: maxLosses,
            maxWinRate: maxWinRate
        };
    });
    
    // 2. 최대가능 승률 순으로 정렬 (승률 → 승패차 → 잔여경기 많은 순)
    teamMaxStats.sort((a, b) => {
        // 승률 비교
        if (Math.abs(a.maxWinRate - b.maxWinRate) > 0.001) {
            return b.maxWinRate - a.maxWinRate;
        }
        // 승률이 같으면 승패차로 비교
        const aWinLossMargin = a.maxWins - a.maxLosses;
        const bWinLossMargin = b.maxWins - b.maxLosses;
        if (aWinLossMargin !== bWinLossMargin) {
            return bWinLossMargin - aWinLossMargin;
        }
        // 승패차도 같으면 잔여경기 많은 순 (더 유리)
        return b.remainingGames - a.remainingGames;
    });
    
    // 3. 플레이오프 진출 기준선 결정 (5위가 동률이면 4위 기준)
    let playoffThresholdIndex = 4; // 기본 5위
    let playoffThresholdTeam = teamMaxStats[4];
    let playoffThresholdWinRate = teamMaxStats[4].maxWinRate;
    
    // 5위와 6위가 동률인지 확인
    if (teamMaxStats.length > 5) {
        const fifthWinRate = teamMaxStats[4].maxWinRate;
        const sixthWinRate = teamMaxStats[5].maxWinRate;
        
        // 승률이 같거나 승패차까지 같으면 4위를 기준으로
        if (Math.abs(fifthWinRate - sixthWinRate) < 0.001) {
            const fifthWinLossMargin = teamMaxStats[4].maxWins - teamMaxStats[4].maxLosses;
            const sixthWinLossMargin = teamMaxStats[5].maxWins - teamMaxStats[5].maxLosses;
            
            if (fifthWinLossMargin === sixthWinLossMargin) {
                // 4위를 기준으로 변경
                playoffThresholdIndex = 3;
                playoffThresholdTeam = teamMaxStats[3];
                playoffThresholdWinRate = teamMaxStats[3].maxWinRate;
                console.log(`⚠️ 5위와 6위가 동률이므로 4위 ${playoffThresholdTeam.team}를 기준으로 설정`);
            }
        }
    }
    
    const fifthPlaceMaxWinRate = playoffThresholdWinRate;
    const fifthPlaceTeam = playoffThresholdTeam;
    
    console.log(`🏆 PO 진출 기준선: ${fifthPlaceTeam.team}팀 최대가능 승률 ${(fifthPlaceMaxWinRate * 100).toFixed(1)}% (${fifthPlaceTeam.maxWins}승 ${fifthPlaceTeam.maxLosses}패)`);
    
    console.log('\n📊 팀별 최대가능 승률 순위:');
    teamMaxStats.forEach((team, index) => {
        const playoffStatus = index < 5 ? '🟢 PO권' : '🔴 PO권 밖';
        console.log(`${index + 1}. ${team.team}: ${(team.maxWinRate * 100).toFixed(1)}% (${team.maxWins}승 ${team.maxLosses}패) ${playoffStatus}`);
    });
    
    const results = [];
    
    standings.forEach((team, index) => {
        const rank = index + 1;
        const wins = team.wins;
        const losses = team.losses;
        const gamesRemaining = team.remainingGames;
        const currentWinRate = wins / (wins + losses);
        
        // 4. PO 매직넘버 계산: 5위 팀의 최대가능 승수를 넘는데 필요한 승수
        let magicNumber = null;
        let status = '';
        
        // 5위 팀의 최대가능 승수를 넘으려면 +1 필요
        // 단, 자신이 5위 기준팀이면 자신의 최대승수까지만 필요
        let requiredWins;
        if (team.team === playoffThresholdTeam.team) {
            // 자신이 5위 기준팀이면 자신의 최대가능 승수 달성하면 됨
            requiredWins = playoffThresholdTeam.maxWins;
        } else {
            // 다른 팀은 5위 기준팀을 넘어야 하므로 +1
            requiredWins = playoffThresholdTeam.maxWins + 1;
        }
        
        // 현재 승수와의 차이가 매직넘버
        const winsNeeded = Math.max(0, requiredWins - wins);
        
        // 상태 판정
        if (winsNeeded === 0) {
            if (rank <= 5) {
                status = '✅ 플레이오프 확정';
                magicNumber = 0;
            } else {
                status = '🟢 플레이오프 확정';
                magicNumber = 0;
            }
        } else if (winsNeeded <= gamesRemaining) {
            magicNumber = winsNeeded;
            status = '🟢 플레이오프 가능';
        } else {
            magicNumber = winsNeeded; // 필요한 승수는 표시하되 자력불가 표시
            status = '❌ 자력불가 (승수 부족)';
        }
        
        // 디버깅 정보
        console.log(`\n${team.team}: 현재 ${wins}승 ${losses}패`);
        console.log(`  - 5위 기준선: ${playoffThresholdTeam.maxWins}승 (${playoffThresholdTeam.team}팀)`);
        console.log(`  - 필요한 최종 승수: ${requiredWins}승`);
        console.log(`  - 매직넘버: ${magicNumber}승`);
        console.log(`  - 상태: ${status}`);
        
        const maxPossibleWins = wins + gamesRemaining;
        
        const teamResult = {
            rank,
            team: team.team,
            wins,
            losses,
            winRate: currentWinRate,
            gamesRemaining,
            maxPossibleWins,
            magicNumber,
            status
        };
        
        results.push(teamResult);
        
        // 간단 요약 출력은 제거 (위에서 상세 정보 이미 출력)
    });
    
    // 매직넘버 매트릭스 데이터 파일 생성
    const matrixData = {
        lastUpdated: new Date().toISOString(),
        updateDate: new Date().toLocaleDateString('ko-KR'),
        note: "승수 기준 정확한 플레이오프 진출 매직넘버 계산",
        fifthPlaceMaxWinRate: fifthPlaceMaxWinRate,
        fifthPlaceTeam: fifthPlaceTeam.team,
        teamMaxStatsRanking: teamMaxStats,
        results: results
    };
    
    const outputPath = path.join(DATA_DIR, 'magic-matrix-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(matrixData, null, 2), 'utf8');
    console.log(`✅ 매직넘버 매트릭스 데이터 저장: ${outputPath}`);
    
    console.log('✅ 매직넘버 계산 완료!');
    return matrixData;
}

function main() {
    console.log('📈 순위 변동 매트릭스 생성 중...');
    
    const serviceData = loadServiceData();
    calculateMagicNumbers(serviceData);
}

if (require.main === module) {
    main();
}

module.exports = { calculateMagicNumbers };