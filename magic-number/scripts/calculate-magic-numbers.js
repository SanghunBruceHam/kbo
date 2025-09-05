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
    
    console.log('📊 KBO 매직넘버 계산 시작 (승률 기준)...');
    
    const results = [];
    
    standings.forEach((team, index) => {
        const rank = index + 1;
        const wins = team.wins;
        const losses = team.losses;
        const gamesPlayed = wins + losses;
        const gamesRemaining = totalGames - gamesPlayed;
        const currentWinRate = wins / gamesPlayed;
        
        // 플레이오프 진출 매직넘버 (모든 팀)
        let magicNumber = null;
        let status = '';
        
        // 현재 5위 팀이 남은 경기를 모두 이겨도 달성할 수 없는 승률을 목표로 설정
        const fifthPlace = standings[4];
        if (fifthPlace) {
            const fifthMaxWins = fifthPlace.wins + fifthPlace.remainingGames;
            const fifthMaxGames = fifthPlace.games + fifthPlace.remainingGames;
            const fifthMaxWinRate = fifthMaxWins / fifthMaxGames;
            
            // 현재 팀이 달성해야 할 최소 승률 (5위 최대 승률보다 높아야 함)
            let winsNeeded = 0;
            for (let additionalWins = 0; additionalWins <= gamesRemaining; additionalWins++) {
                const projectedWins = wins + additionalWins;
                const projectedGames = gamesPlayed + gamesRemaining;
                const projectedWinRate = projectedWins / projectedGames;
                
                if (projectedWinRate > fifthMaxWinRate) {
                    winsNeeded = additionalWins;
                    break;
                }
            }
            
            if (winsNeeded === 0 && currentWinRate > fifthMaxWinRate) {
                status = '✅ 플레이오프 확정';
                magicNumber = 0;
            } else if (winsNeeded > gamesRemaining) {
                // 잔여 경기로 달성 불가능
                magicNumber = winsNeeded;
                status = '❌ 자력불가';
            } else {
                magicNumber = winsNeeded;
            }
            
            // 6위 이하 추가 탈락 확정 체크
            if (rank > 5) {
                const maxPossibleWins = wins + gamesRemaining;
                const maxPossibleGames = gamesPlayed + gamesRemaining;
                const maxPossibleWinRate = maxPossibleWins / maxPossibleGames;
                
                const fifthCurrentWinRate = fifthPlace.wins / fifthPlace.games;
                
                if (maxPossibleWinRate < fifthCurrentWinRate) {
                    status = '❌ 플레이오프 탈락 확정';
                }
            }
        }
        
        const teamResult = {
            rank,
            team: team.team,
            wins,
            losses,
            winRate: currentWinRate,
            gamesRemaining,
            magicNumber,
            status
        };
        
        results.push(teamResult);
        
        const magicDisplay = magicNumber === 0 ? '확정' : (magicNumber || 'N/A');
        const statusDisplay = status ? ` ${status}` : '';
        console.log(`${rank}위 ${team.team}: ${wins}승 ${losses}패 (승률 ${currentWinRate.toFixed(3)}, ${gamesRemaining}경기 남음) - 매직넘버: ${magicDisplay}${statusDisplay}`);
    });
    
    // 매직넘버 매트릭스 데이터 파일 생성
    const matrixData = {
        lastUpdated: new Date().toISOString(),
        updateDate: new Date().toLocaleDateString('ko-KR'),
        note: "승률 기준 정확한 매직넘버 계산",
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