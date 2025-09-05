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
    
    console.log('📊 KBO 매직넘버 계산 시작...');
    
    standings.forEach((team, index) => {
        const rank = index + 1;
        const wins = team.wins;
        const losses = team.losses;
        const gamesPlayed = wins + losses;
        const gamesRemaining = totalGames - gamesPlayed;
        
        // 플레이오프 진출 매직넘버 (5위까지)
        let magicNumber = null;
        if (rank <= 5) {
            const playoffThreshold = standings[4] ? standings[4].wins : 0;
            magicNumber = Math.max(0, playoffThreshold + 1 - wins);
        }
        
        console.log(`${rank}위 ${team.team}: ${wins}승 ${losses}패 (${gamesRemaining}경기 남음) - 매직넘버: ${magicNumber || 'N/A'}`);
    });
    
    console.log('✅ 매직넘버 계산 완료!');
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