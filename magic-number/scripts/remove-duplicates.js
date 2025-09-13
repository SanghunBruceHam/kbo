const fs = require('fs');
const path = require('path');

function removeDuplicates() {
    const dataPath = path.join(__dirname, '../data/2025-season-data-clean.txt');
    const data = fs.readFileSync(dataPath, 'utf-8');
    const lines = data.split('\n');

    const dateMap = new Map(); // 날짜별로 경기 저장
    let currentDate = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // 날짜 패턴
        if (/^\d{4}-\d{2}-\d{2}(\s*\([월화수목금토일]\))?$/.test(trimmed)) {
            currentDate = trimmed;
            if (!dateMap.has(currentDate)) {
                dateMap.set(currentDate, new Set());
            }
        }
        // 경기 데이터
        else if (trimmed && currentDate) {
            // 고유 키 생성: 시간_구장_홈팀_어웨이팀
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 5) {
                const key = `${parts[0]}_${parts[2]}_${parts[3]}_${parts[4]}`;
                const gameData = dateMap.get(currentDate);
                gameData.add(trimmed);
            }
        }
    }

    // 날짜 순서대로 정렬
    const sortedDates = Array.from(dateMap.keys()).sort();

    // 정리된 데이터 생성
    const uniqueLines = [];
    for (const date of sortedDates) {
        const games = Array.from(dateMap.get(date));
        if (games.length > 0) {
            uniqueLines.push(date);

            // 경기를 시간순으로 정렬
            const sortedGames = games.sort((a, b) => {
                const timeA = a.split(/\s+/)[0];
                const timeB = b.split(/\s+/)[0];
                return timeA.localeCompare(timeB);
            });

            uniqueLines.push(...sortedGames);
            uniqueLines.push(''); // 날짜 구분을 위한 빈 줄
        }
    }

    // 백업 생성
    const backupPath = dataPath + '.backup_' + new Date().toISOString().slice(0,10);
    fs.copyFileSync(dataPath, backupPath);
    console.log(`📁 백업 생성: ${backupPath}`);

    // 정리된 데이터 저장
    const cleanedData = uniqueLines.join('\n');
    fs.writeFileSync(dataPath, cleanedData, 'utf-8');

    // 통계 출력
    const originalLines = lines.filter(l => l.trim() && !/^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    const cleanedLines = uniqueLines.filter(l => l.trim() && !/^\d{4}-\d{2}-\d{2}/.test(l.trim()));

    console.log(`\n📊 중복 제거 완료:`);
    console.log(`  원본 경기 수: ${originalLines.length}`);
    console.log(`  정리된 경기 수: ${cleanedLines.length}`);
    console.log(`  제거된 중복: ${originalLines.length - cleanedLines.length}`);

    return cleanedLines.length;
}

// 실행
if (require.main === module) {
    removeDuplicates();
}

module.exports = { removeDuplicates };