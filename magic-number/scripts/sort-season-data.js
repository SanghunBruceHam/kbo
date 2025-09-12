#!/usr/bin/env node

/**
 * 2025-season-data-clean.txt 파일을 날짜순으로 정렬
 * 완료 경기와 취소 경기를 날짜별로 통합
 */

const fs = require('fs');
const path = require('path');

function sortSeasonData() {
    const dataPath = path.join(__dirname, '../data/2025-season-data-clean.txt');
    const backupPath = path.join(__dirname, '../data/2025-season-data-clean.txt.backup');
    
    // 백업 생성
    const data = fs.readFileSync(dataPath, 'utf-8');
    fs.writeFileSync(backupPath, data, 'utf-8');
    console.log('📁 백업 파일 생성: 2025-season-data-clean.txt.backup');
    
    const lines = data.split('\n');
    const gamesByDate = {};
    let currentDate = null;
    
    // 날짜별로 경기 그룹화
    for (const line of lines) {
        const trimmed = line.trim();
        
        // 날짜 패턴: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            currentDate = trimmed;
            if (!gamesByDate[currentDate]) {
                gamesByDate[currentDate] = [];
            }
        }
        // 경기 결과 또는 취소 경기
        else if (trimmed && currentDate) {
            // 완료 경기 (점수 포함) 또는 취소 경기 ([취소사유] 포함)
            if (trimmed.includes(':') || (trimmed.includes('[') && trimmed.includes(']'))) {
                gamesByDate[currentDate].push(trimmed);
            }
        }
    }
    
    // 날짜순 정렬
    const sortedDates = Object.keys(gamesByDate).sort();
    
    // 새로운 파일 내용 생성
    let newContent = '';
    for (const date of sortedDates) {
        const games = gamesByDate[date];
        if (games.length > 0) {
            // 날짜별로 완료 경기와 취소 경기 분리
            const completedGames = games.filter(g => g.includes(':') && !g.includes('['));
            const cancelledGames = games.filter(g => g.includes('[') && g.includes(']'));
            
            // 날짜 추가
            newContent += `${date}\n`;
            
            // 완료 경기 먼저 추가
            for (const game of completedGames) {
                newContent += `${game}\n`;
            }
            
            // 취소 경기 추가
            for (const game of cancelledGames) {
                newContent += `${game}\n`;
            }
            
            // 날짜 사이 빈 줄 추가
            newContent += '\n\n';
        }
    }
    
    // 마지막 불필요한 빈 줄 제거
    newContent = newContent.trimEnd();
    
    // 파일 저장
    fs.writeFileSync(dataPath, newContent, 'utf-8');
    
    // 통계 출력
    const totalDates = sortedDates.length;
    let totalCompleted = 0;
    let totalCancelled = 0;
    
    for (const date of sortedDates) {
        const games = gamesByDate[date];
        totalCompleted += games.filter(g => g.includes(':') && !g.includes('[')).length;
        totalCancelled += games.filter(g => g.includes('[') && g.includes(']')).length;
    }
    
    console.log(`\n✅ 정렬 완료!`);
    console.log(`📅 총 ${totalDates}개 날짜`);
    console.log(`⚾ 완료 경기: ${totalCompleted}개`);
    console.log(`❌ 취소 경기: ${totalCancelled}개`);
    console.log(`📁 파일 업데이트: ${dataPath}`);
    
    // 취소 경기가 있는 날짜 표시
    console.log('\n📌 취소 경기가 있는 날짜:');
    for (const date of sortedDates) {
        const cancelledGames = gamesByDate[date].filter(g => g.includes('[') && g.includes(']'));
        if (cancelledGames.length > 0) {
            console.log(`  ${date}: ${cancelledGames.length}개 취소`);
            for (const game of cancelledGames) {
                console.log(`    - ${game}`);
            }
        }
    }
}

// 실행
sortSeasonData();