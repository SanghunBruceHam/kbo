// KBO 매직넘버 계산기 - JavaScript

// 개발/프로덕션 환경 감지 및 로깅 제어
const DEBUG_MODE = !window.location.hostname || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname.includes('127.0.0.1') ||
                   window.location.search.includes('debug=true');

// 프로덕션 환경에서는 logger.log 비활성화
const logger = {
    log: DEBUG_MODE ? console.log.bind(console) : () => {},
    warn: DEBUG_MODE ? console.warn.bind(console) : () => {},
    error: console.error.bind(console) // 에러는 항상 표시
};

// KBO 팀 데이터 (2025 시즌 기준)
const kboTeams = {
    "한화": { fullName: "한화 이글스", color: "#FF6600", logo: '<img src="images/hanwha.png" class="team-logo" alt="한화">' },
    "LG": { fullName: "LG 트윈스", color: "#C50E2E", logo: '<img src="images/lg.png" class="team-logo" alt="LG">' },
    "두산": { fullName: "두산 베어스", color: "#131230", logo: '<img src="images/doosan.png" class="team-logo" alt="두산">' },
    "삼성": { fullName: "삼성 라이온즈", color: "#1F4E8C", logo: '<img src="images/samsung.png" class="team-logo" alt="삼성">' },
    "KIA": { fullName: "KIA 타이거즈", color: "#EA0029", logo: '<img src="images/kia.png" class="team-logo" alt="KIA">' },
    "SSG": { fullName: "SSG 랜더스", color: "#CE0E2D", logo: '<img src="images/ssg.png" class="team-logo" alt="SSG">' },
    "롯데": { fullName: "롯데 자이언츠", color: "#041E42", logo: '<img src="images/lotte.png" class="team-logo" alt="롯데">' },
    "NC": { fullName: "NC 다이노스", color: "#315288", logo: '<img src="images/nc.png" class="team-logo" alt="NC">' },
    "키움": { fullName: "키움 히어로즈", color: "#570514", logo: '<img src="images/kiwoom.png" class="team-logo" alt="키움">' },
    "KT": { fullName: "KT 위즈", color: "#333333", logo: '<img src="images/kt.png" class="team-logo" alt="KT">' }
};

        // KBO 순위 데이터 (동적 로딩)
        let currentStandings = [];
        let currentKBOData = null;
        
        // 메모리 관리를 위한 이벤트 리스너 관리자
        class EventManager {
            constructor() {
                this.listeners = new Map();
                this.boundCleanup = this.cleanup.bind(this);
                
                // 페이지 언로드 시 정리
                window.addEventListener('beforeunload', this.boundCleanup);
                window.addEventListener('pagehide', this.boundCleanup);
            }
            
            add(element, event, handler, options = {}) {
                const key = `${element.constructor.name}_${event}_${Date.now()}`;
                element.addEventListener(event, handler, options);
                
                this.listeners.set(key, {
                    element,
                    event,
                    handler,
                    options
                });
                
                return key; // 나중에 개별 제거할 때 사용
            }
            
            remove(key) {
                if (this.listeners.has(key)) {
                    const { element, event, handler } = this.listeners.get(key);
                    element.removeEventListener(event, handler);
                    this.listeners.delete(key);
                }
            }
            
            cleanup() {
                // 메모리 정리 (프로덕션에서는 로그 비활성화)
                this.listeners.forEach(({ element, event, handler }) => {
                    try {
                        element.removeEventListener(event, handler);
                    } catch (e) {
                        // 이벤트 리스너 제거 실패 (프로덕션에서는 로그 비활성화)
                    }
                });
                this.listeners.clear();
                
            }
        }
        
        // 전역 이벤트 관리자 인스턴스
        const eventManager = new EventManager();
        
        // 잔여경기 일정 데이터 - 자동 필터링 (현재 날짜 이후만 표시)
        const allScheduleData = [
            { date: '08.21', teams: ['SSG', 'KIA', '한화', 'LG', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.22', teams: ['SSG', 'KIA', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.23', teams: ['SSG', 'KIA', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.24', teams: ['SSG', 'KIA', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.26', teams: ['SSG', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '08.27', teams: ['SSG', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '08.28', teams: ['SSG', '한화', 'KT', 'LG', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '08.29', teams: ['SSG', 'KIA', '한화', 'LG', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.30', teams: ['SSG', 'KIA', '한화', 'LG', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '08.31', teams: ['SSG', 'KIA', '한화', 'LG', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.02', teams: ['한화', 'KIA', 'SSG', 'LG', 'KT', '키움', 'NC', '롯데'] },
            { date: '09.03', teams: ['한화', 'SSG', 'KIA', 'KT', '키움', '삼성', 'NC', '롯데'] },
            { date: '09.04', teams: ['SSG', 'KIA', 'LG', 'KT', '키움', '삼성', '두산', 'NC'] },
            { date: '09.05', teams: ['SSG', 'KT', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '09.06', teams: ['한화', 'KIA', 'SSG', 'LG', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.07', teams: ['한화', 'SSG', 'KIA', 'LG', '삼성', 'NC'] },
            { date: '09.09', teams: ['한화', 'SSG', 'KIA', 'LG', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.10', teams: ['한화', 'SSG', 'KIA', '삼성', 'NC', '롯데'] },
            { date: '09.11', teams: ['SSG', 'KIA', 'KT', 'LG', '키움', '삼성', 'NC', '롯데'] },
            { date: '09.12', teams: ['한화', 'LG', '키움', '두산', 'KIA', 'NC'] },
            { date: '09.13', teams: ['SSG', '한화', 'LG', 'KT', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '09.14', teams: ['한화', 'LG', 'KT', '키움', '삼성', '두산', 'KIA', 'NC'] },
            { date: '09.16', teams: ['한화', 'SSG', 'LG', 'KT', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '09.17', teams: ['한화', 'SSG', 'LG', 'KT', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '09.18', teams: ['한화', 'LG', 'KT', '키움', '삼성', '두산', 'KIA', 'NC'] },
            { date: '09.19', teams: ['한화', 'SSG', 'KT', '두산', 'NC', '롯데'] },
            { date: '09.20', teams: ['한화', 'SSG', 'KT', 'LG', '키움', '삼성', '두산', 'KIA', '롯데', 'NC'] },
            { date: '09.21', teams: ['SSG', 'KT', '삼성', '두산', 'KIA', 'NC'] },
            { date: '09.23', teams: ['SSG', 'KIA', 'KT', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.24', teams: ['한화', 'SSG', 'LG', '키움', 'KIA', 'NC'] },
            { date: '09.25', teams: ['한화', 'SSG', 'KT', 'LG', '두산', '롯데'] },
            { date: '09.26', teams: ['SSG', '한화', 'KT', 'LG', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.27', teams: ['한화', 'SSG', 'LG', '두산', 'KIA', 'NC'] },
            { date: '09.28', teams: ['한화', 'KIA', 'LG', '키움', '삼성', '두산', 'NC', '롯데'] },
            { date: '09.30', teams: ['한화', 'KIA', 'SSG', 'KT', 'LG', '키움', '삼성', '두산', 'NC', '롯데'] }
        ];
        
        // 수집된 경기 데이터를 확인하여 미래 경기만 필터링하는 함수
        function getFilteredRemainingSchedule(serviceData = null) {
            if (!serviceData) {
                // 서비스 데이터가 없으면 현재 날짜 기준으로 fallback
                const today = new Date();
                const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
                const currentDay = String(today.getDate()).padStart(2, '0');
                
                return allScheduleData.filter(game => {
                    const gameMonth = parseInt(game.date.split('.')[0]);
                    const gameDay = parseInt(game.date.split('.')[1]);
                    const currentMonthInt = parseInt(currentMonth);
                    const currentDayInt = parseInt(currentDay);
                    
                    return (gameMonth > currentMonthInt) || 
                           (gameMonth === currentMonthInt && gameDay > currentDayInt);
                });
            }

            // 수집된 경기 데이터에서 최신 경기 날짜 확인
            const latestDataDate = serviceData.dataDate;
            if (!latestDataDate) {
                logger.log('데이터 날짜 정보가 없습니다');
                return allScheduleData;
            }
            
            
            // YYYY-MM-DD 형식을 MM.DD 형식으로 변환
            const [year, month, day] = latestDataDate.split('-');
            const latestDateFormatted = `${month}.${day}`;
            
            
            const filteredGames = allScheduleData.filter(game => {
                // 수집된 최신 날짜 이후의 경기만 포함
                const gameMonth = parseInt(game.date.split('.')[0]);
                const gameDay = parseInt(game.date.split('.')[1]);
                const latestMonth = parseInt(month);
                const latestDay = parseInt(day);
                
                const isFuture = (gameMonth > latestMonth) || 
                               (gameMonth === latestMonth && gameDay > latestDay);
                
                
                
                return isFuture;
            });
            
            return filteredGames;
        }
        
        // 초기 잔여경기 일정 (데이터 로드 전 임시)
        let remainingSchedule = getFilteredRemainingSchedule();
        
        // 우승 확정일 계산 함수
        function calculateClinchDate(teamName, magicNumber) {
            try {
                let gamesPlayed = 0;
                
                for (const gameDay of remainingSchedule) {
                    if (gameDay.teams.includes(teamName)) {
                        gamesPlayed++;
                        
                        if (gamesPlayed >= magicNumber) {
                            // 날짜 포맷팅 (08.19 -> 8월 19일)
                            const [month, day] = gameDay.date.split('.');
                            return `${parseInt(month)}월 ${parseInt(day)}일`;
                        }
                    }
                }
                
                return null; // 시즌 내 확정 불가
            } catch (error) {
                logger.error('우승 확정일 계산 오류:', error);
                return null;
            }
        }
        
        // 공통 유틸리티 함수들
        const Utils = {
            // 팀명과 로고를 조합한 HTML 생성 (테이블 친화적)
            getTeamNameWithLogo(team, includeRank = false) {
                const teamData = kboTeams[team.team || team];
                if (!teamData) return team.team || team;
                
                const teamName = team.team || team;
                const logoAndName = `${teamData.logo}<span style="color: ${teamData.color};">${teamName}</span>`;
                
                if (includeRank && team.displayRank) {
                    return `${logoAndName} <span style="color: #666;">(${team.displayRank}위)</span>`;
                }
                
                return logoAndName;
            },
            
            // 홈/어웨이 기록 표시 HTML 생성
            getHomeAwayDisplay(teamName) {
                // 동적 데이터에서 홈/어웨이 기록 가져오기
                const team = currentStandings.find(t => t.team === teamName);
                
                const teamHomeAway = team ? {
                    home: team.homeRecord || "0-0-0",
                    away: team.awayRecord || "0-0-0"
                } : { home: "0-0-0", away: "0-0-0" };
                
                // 홈/방문 승률 계산
                const parseRecord = (record) => {
                    const [wins, losses, draws] = record.split('-').map(Number);
                    const totalGames = wins + losses; // 무승부 제외한 승률 계산
                    const winRate = totalGames > 0 ? (wins / totalGames) : 0;
                    return { wins, losses, draws, winRate };
                };
                
                const homeStats = parseRecord(teamHomeAway.home);
                const awayStats = parseRecord(teamHomeAway.away);
                
                return `
                    <div style="
                        line-height: 1.3;
                        text-align: center;
                        color: #555;
                    ">
                        <div style="margin-bottom: 3px; ">
                            ${teamHomeAway.home} / ${teamHomeAway.away}
                        </div>
                        <div style="color: #666;">
                            🏠 ${homeStats.winRate.toFixed(3)} / ✈️ ${awayStats.winRate.toFixed(3)}
                        </div>
                    </div>
                `;
            },
            
            // 매직넘버 표시 HTML 생성
            getMagicNumberDisplay(team) {
                const magicNumbers = currentKBOData?.magicNumbers || {};
                
                let magicNumber = 0;
                if (team.rank === 1) {
                    // 1위팀: 우승 매직넘버
                    const firstPlaceMagic = magicNumbers[team.team];
                    magicNumber = firstPlaceMagic ? firstPlaceMagic.championship : 0;
                } else {
                    // 나머지 팀: 5위까지 PO 진출 매직넘버 (최대가능 승수 기준)
                    magicNumber = this.calculatePlayoffMagicNumber(team, currentStandings);
                }
                
                if (magicNumber === 0) {
                    return team.rank === 1 ? 
                        '<span style="color: #FFD700; ">우승확정</span>' :
                        '<span style="color: #4CAF50; ">PO확정</span>';
                }
                
                // 수학적으로 불가능한 경우
                if (magicNumber >= 999) {
                    return '<span style="color: #999; ">-</span>';
                }
                
                // 매직넘버 색상 결정
                let color = '#666';
                if (magicNumber <= 3) color = '#4CAF50';      // 초록
                else if (magicNumber <= 10) color = '#FF9800'; // 주황
                else if (magicNumber <= 20) color = '#FF5722'; // 빨강
                else color = '#9E9E9E';                        // 회색
                
                return `<span style="color: ${color}; ">${magicNumber}</span>`;
            },
            
            // 5위까지 플레이오프 진출을 위한 매직넘버 계산
            // 잔여경기에서 최소 몇승을 해야 5위 팀 승률을 넘을 수 있는지 계산하는 매직넘버
            calculatePlayoffMagicNumber(team, standings) {
                try {
                    // 1. 모든 팀이 잔여경기 전승했을 때의 최종 승률 계산
                    const teamsWithFinalWinRate = standings.map(t => {
                        const remainingGames = 144 - t.games;
                        const finalWins = t.wins + remainingGames;
                        const finalLosses = t.losses; // 잔여경기를 모두 이기므로 패수는 그대로
                        const finalWinRate = finalWins / (finalWins + finalLosses);
                        
                        return {
                            team: t.team,
                            finalWinRate: finalWinRate
                        };
                    });
                    
                    // 2. 최종 승률로 정렬해서 5위 팀 승률 찾기
                    teamsWithFinalWinRate.sort((a, b) => b.finalWinRate - a.finalWinRate);
                    const fifthPlaceWinRate = teamsWithFinalWinRate[4].finalWinRate;
                    
                    // 3. 현재 팀이 잔여경기에서 최소 몇승을 해야 5위 팀 승률을 넘는지 계산
                    const remainingGames = 144 - team.games;
                    
                    for (let winsFromRemaining = 0; winsFromRemaining <= remainingGames; winsFromRemaining++) {
                        const lossesFromRemaining = remainingGames - winsFromRemaining;
                        const finalWins = team.wins + winsFromRemaining;
                        const finalLosses = team.losses + lossesFromRemaining;
                        const finalWinRate = finalWins / (finalWins + finalLosses);
                        
                        if (finalWinRate >= fifthPlaceWinRate) {
                            return winsFromRemaining;
                        }
                    }
                    
                    // 모든 경기를 이겨도 5위 팀 승률에 도달하지 못하면 자력불가
                    return remainingGames + 1;
                } catch (error) {
                    logger.error('플레이오프 매직넘버 계산 중 오류:', error);
                    return Math.max(0, 72 - team.wins); // 폴백으로 기존 로직 사용
                }
            },
            
            // 최대가능 승수 기준 매직넘버 계산 (개선된 플레이오프 매직넘버)
            calculateMaxWinsMagicNumber(team, standings) {
                try {
                    // 개선된 플레이오프 매직넘버 로직 사용
                    return this.calculatePlayoffMagicNumber(team, standings);
                } catch (error) {
                    logger.error('최대승수 기준 매직넘버 계산 중 오류:', error);
                    return Math.max(0, 72 - team.wins); // 폴백으로 기존 로직 사용
                }
            },
            
            // 테이블 행 HTML 생성 (공통 스타일 적용)
            createTableRow(cells, teamColor = null, additionalClasses = '') {
                const row = document.createElement('tr');
                if (teamColor) {
                    row.style.borderLeft = `4px solid ${teamColor}`;
                }
                if (additionalClasses) {
                    row.className = additionalClasses;
                }
                
                row.innerHTML = cells.map(cell => `<td>${cell}</td>`).join('');
                return row;
            }
        };
        
        // 에러 처리 및 사용자 알림 함수들 (비활성화)
        function showNotification(message, type = 'error', duration = 5000) {
            // 알림 표시 비활성화 - 콘솔에만 로그
            logger.log(`[${type.toUpperCase()}] ${message}`);
        }
        
        function handleError(error, context = '알 수 없는 오류') {
            logger.error(`❌ ${context}:`, error);
            
            let userMessage = '';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                userMessage = '네트워크 연결을 확인해주세요. 잠시 후 다시 시도합니다.';
            } else if (error.name === 'SyntaxError') {
                userMessage = '데이터 형식에 문제가 있습니다. 백업 데이터를 사용합니다.';
            } else {
                userMessage = `${context} 발생. 백업 데이터를 사용하여 서비스를 계속 제공합니다.`;
            }
            
            // 팝업 대신 콘솔에만 로그
            logger.warn(`[ERROR] ${userMessage}`);
        }
        
        // 데이터 정보 업데이트 함수
        function updateLoadingTime(data) {
            try {
                // 데이터 날짜 표시 (실제 경기 데이터 날짜)
                const dataDate = data?.dataDate || '날짜 없음';
                const updateDate = data?.updateDate || new Date().toLocaleDateString('ko-KR');
                
                // 실제 크롤링 시간 사용 (lastUpdated 필드에서)
                let crawlTime = '';
                if (data?.lastUpdated) {
                    const lastUpdated = new Date(data.lastUpdated);
                    crawlTime = lastUpdated.toLocaleString('ko-KR', { 
                        year: 'numeric',
                        month: 'numeric', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).replace(/\. /g, '. ').replace(/\.$/, '');
                } else {
                    // 백업: 현재 시간 사용
                    const now = new Date();
                    crawlTime = now.toLocaleString('ko-KR', { 
                        year: 'numeric',
                        month: 'numeric', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).replace(/\. /g, '. ').replace(/\.$/, '');
                }
                
                // 헤더 업데이트 정보 표시 (메인 인덱스와 동일한 형식)
                const updateInfoElement = document.getElementById('updateInfo');
                if (updateInfoElement) {
                    updateInfoElement.textContent = `📅 ${crawlTime} 데이터 사용중`;
                }
                
                // 푸터 업데이트 정보 표시 (헤더와 동일한 형식)
                const dataInfoElement = document.querySelector('.data-info');
                if (dataInfoElement) {
                    dataInfoElement.textContent = `${crawlTime} 데이터 사용중`;
                }
                
                // 표시 텍스트 구성 - 마지막 크롤링 시간 표시
                const displayText = `${crawlTime} KBO 공식`;
                
                // 모든 데이터 정보 표시 업데이트
                const loadTimeElements = document.querySelectorAll('.data-load-time');
                loadTimeElements.forEach(element => {
                    if (element) {
                        element.textContent = displayText;
                    }
                });
                
            } catch (error) {
                logger.error('❌ 데이터 로딩 시간 업데이트 실패:', error);
            }
        }

        // 승률과 상대전적 기준으로 순위 정렬
        async function sortStandingsByWinRateAndHeadToHead(standings) {
            try {
                // 상대전적 데이터 로드
                let recordsData = null;
                try {
                    const response = await fetch(`data/kbo-records.json?v=${Date.now()}`);
                    recordsData = await response.json();
                } catch (error) {
                    logger.warn('⚠️ 상대전적 데이터 로드 실패, 승률만으로 정렬:', error);
                }

                // 승률과 상대전적 기준으로 정렬
                standings.sort((a, b) => {
                    const aWinRate = parseFloat(a.winRate || a.winPct || 0);
                    const bWinRate = parseFloat(b.winRate || b.winPct || 0);
                    
                    // 1차: 승률 비교 (내림차순)
                    if (aWinRate !== bWinRate) {
                        return bWinRate - aWinRate;
                    }
                    
                    // 2차: 승률이 같을 때 상대전적 비교
                    if (recordsData && recordsData.totalData) {
                        const aVsB = recordsData.totalData[a.team]?.[b.team];
                        const bVsA = recordsData.totalData[b.team]?.[a.team];
                        
                        if (aVsB && bVsA) {
                            const aWins = aVsB.wins || 0;
                            const bWins = bVsA.wins || 0;
                            
                            // 상대전적 승수가 다르면 많이 이긴 팀을 앞에
                            if (aWins !== bWins) {
                                return bWins - aWins;
                            }
                        }
                    }
                    
                    // 3차: 팀명 알파벳 순 (일관성을 위해)
                    return (a.team || '').localeCompare(b.team || '');
                });
                
                
            } catch (error) {
                logger.error('❌ 매직넘버 순위 정렬 실패:', error);
            }
        }

        // 데이터 로딩 함수
        async function loadKBOData() {
            try {
                const dataUrl = `data/service-data.json?v=${Date.now()}`;
                // service-data.json 하나만 사용 (중복 제거)
                const response = await fetch(dataUrl, {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // 승률과 상대전적 기준으로 정렬
                    await sortStandingsByWinRateAndHeadToHead(data.standings || []);
                    
                    // JSON 데이터 구조를 JavaScript 코드가 기대하는 형태로 변환
                    // 승률이 같은 팀에게 같은 순위 부여
                    let currentRank = 1;
                    let previousWinRate = null;
                    
                    currentStandings = (data.standings || []).map((team, index) => {
                        const winPct = team.winRate || team.winPct || 0;
                        
                        // 이전 팀과 승률이 다르면 실제 순위로 업데이트
                        if (previousWinRate !== null && winPct !== previousWinRate) {
                            currentRank = index + 1;
                        }
                        
                        const displayRank = currentRank;
                        previousWinRate = winPct;
                        
                        return {
                            ...team,
                            winPct: winPct, // winRate를 winPct로 변환
                            displayRank: displayRank, // 동률 순위 처리
                            recent10: team.recent10 || "5승 0무 5패",
                            streak: team.streak || "1승",
                            homeAway: { 
                                home: team.homeRecord || "0-0-0", 
                                away: team.awayRecord || "0-0-0" 
                            } // 실제 홈/원정 기록 사용
                        };
                    });
                    
                    // currentKBOData에 전체 데이터 저장 (playoffData 포함)
                    currentKBOData = data;
                    
                    // 수집된 데이터를 기반으로 잔여경기 일정 업데이트
                    remainingSchedule = getFilteredRemainingSchedule(data);
                    
                    // 데이터 로딩 시간 업데이트
                    updateLoadingTime(data);
                    
                    return data;
                } else {
                    logger.error('❌ 응답 실패:', response.status, response.statusText);
                    throw new Error(`데이터 로딩 실패: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                logger.error('❌ loadKBOData 에러 상세:', error);
                
                // 에러 모니터링 로깅
                if (window.logDataError) {
                    window.logDataError('service-data', error.message, {
                        url: dataUrl,
                        status: error.status || 'unknown'
                    });
                }
                
                handleError(error, 'KBO 데이터 로딩 실패');
                // 백업 데이터 사용 - 서버에서 데이터를 받지 못했을 때만 사용
                currentStandings = [];
                // 백업 데이터도 JSON 형식으로 반환
                const backupData = {
                    rankings: currentStandings,
                    magicNumbers: {},
                    lastUpdated: new Date().toISOString(),
                    updateDate: new Date().toLocaleDateString('ko-KR')
                };
                
                // 백업 데이터 사용시에도 로딩 시간 업데이트
                updateLoadingTime(backupData);
                
                return backupData;
            }
        }

        // 팀간 상대전적 데이터 (동적 로딩)
        let headToHeadData = {};

        // 상대전적 데이터 로딩 함수
        async function loadHeadToHeadData() {
            try {
                const response = await fetch(`data/kbo-records.json?v=${Date.now()}`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data && data.totalData) {
                        // kbo-records.json 형식을 headToHeadData 형식으로 변환
                        headToHeadData = {};
                        
                        for (const [team1, opponents] of Object.entries(data.totalData)) {
                            headToHeadData[team1] = {};
                            
                            for (const [team2, record] of Object.entries(opponents)) {
                                const wins = record.wins || 0;
                                const losses = record.losses || 0;
                                const draws = record.draws || 0;
                                
                                // 전체 데이터를 보존하여 실제 홈/원정 기록 사용 가능
                                headToHeadData[team1][team2] = record;
                            }
                        }
                        
                        return headToHeadData;
                    } else {
                        throw new Error('상대전적 데이터 형식 오류');
                    }
                } else {
                    throw new Error(`상대전적 데이터 로딩 실패: ${response.status}`);
                }
            } catch (error) {
                logger.error('❌ 상대전적 데이터 로딩 실패:', error);
                
                // 에러 모니터링 로깅
                if (window.logDataError) {
                    window.logDataError('kbo-records', error.message, {
                        status: error.status || 'unknown'
                    });
                }
                
                // 백업 데이터 사용
                headToHeadData = {
                    "LG": { "한화": "5-4-1", "롯데": "6-4-1", "KT": "4-6-0", "KIA": "6-7-0", "삼성": "7-3-0", "SSG": "7-4-0", "NC": "6-5-0", "두산": "7-5-0", "키움": "9-3-1" },
                    "한화": { "LG": "4-5-1", "롯데": "6-6-0", "KT": "8-4-0", "KIA": "8-4-0", "삼성": "6-5-0", "SSG": "6-6-0", "NC": "7-4-1", "두산": "5-7-0", "키움": "8-4-0" },
                    "롯데": { "한화": "6-4-0", "LG": "4-6-1", "KT": "6-4-2", "KIA": "6-6-0", "삼성": "7-3-0", "SSG": "5-6-0", "NC": "4-4-0", "두산": "6-6-0", "키움": "10-4-0" },
                    "KT": { "한화": "3-8-0", "LG": "4-5-0", "롯데": "4-6-2", "KIA": "5-7-0", "삼성": "7-3-0", "SSG": "5-6-0", "NC": "6-5-0", "두산": "7-5-1", "키움": "9-3-0" },
                    "KIA": { "한화": "3-8-0", "LG": "4-7-0", "롯데": "6-6-0", "KT": "7-5-0", "삼성": "3-7-0", "SSG": "5-4-1", "NC": "5-3-0", "두산": "7-2-0", "키움": "6-5-3" },
                    "삼성": { "한화": "4-6-0", "LG": "6-6-0", "롯데": "3-7-0", "KT": "3-7-0", "KIA": "7-3-0", "SSG": "6-5-1", "NC": "6-6-0", "두산": "7-6-0", "키움": "6-3-0" },
                    "SSG": { "한화": "6-6-0", "LG": "4-8-0", "롯데": "6-5-0", "KT": "6-5-0", "KIA": "4-5-1", "삼성": "5-6-1", "NC": "7-2-2", "두산": "5-4-1", "키움": "4-5-0" },
                    "NC": { "한화": "4-7-1", "LG": "5-6-0", "롯데": "4-4-0", "KT": "5-6-0", "KIA": "3-5-0", "삼성": "6-6-0", "SSG": "2-7-2", "두산": "5-3-2", "키움": "10-2-1" },
                    "두산": { "한화": "5-6-1", "LG": "5-6-0", "롯데": "6-6-0", "KT": "5-7-1", "KIA": "2-7-0", "삼성": "6-7-0", "SSG": "4-5-1", "NC": "3-5-2", "키움": "5-3-3" },
                    "키움": { "한화": "1-10-0", "LG": "4-9-0", "롯데": "4-10-0", "KT": "3-9-0", "KIA": "5-6-3", "삼성": "3-6-0", "SSG": "5-4-0", "NC": "2-10-1", "두산": "3-5-3" }
                };
                
                return headToHeadData;
            }
        }


        // 요약 대시보드 업데이트
        function updateSummaryDashboard() {
            const firstPlace = currentStandings[0];
            const secondPlace = currentStandings[1];
            
            // 1위 팀 정보
            const firstTeamData = kboTeams[firstPlace.team];
            document.getElementById('first-place-team').innerHTML = `
                <div style="display: flex; align-items: center; gap: 4px; justify-content: center;">
                    ${firstTeamData.logo}
                    <span style="color: ${firstTeamData.color}; ">${firstPlace.team}</span>
                </div>
            `;
            const magicNumber = calculateMagicNumber(firstPlace, secondPlace);
            document.getElementById('first-place-magic').textContent = `매직넘버: ${magicNumber > 0 ? magicNumber : '확정'}`;

            // 플레이오프 확정 팀 수 (PO 매직넘버 0)
            const confirmedTeamsList = [];
            currentStandings.forEach(team => {
                const poMagicNumber = Utils.calculatePlayoffMagicNumber(team, currentStandings);
                if (poMagicNumber === 0) {
                    confirmedTeamsList.push(team);
                }
            });
            
            const confirmedTeams = confirmedTeamsList.length;
            document.getElementById('playoff-confirmed-teams').textContent = `${confirmedTeams}개 팀`;
            
            // 플레이오프 확정 팀이 있으면 첫 번째 확정 팀 정보 표시
            if (confirmedTeams > 0) {
                const firstConfirmedTeam = confirmedTeamsList[0];
                if (firstConfirmedTeam) {
                    const teamData = kboTeams[firstConfirmedTeam.team];
                    document.getElementById('playoff-confirmed-desc').innerHTML = `<span style="color: ${teamData.color}; ">${firstConfirmedTeam.team}</span> 외 ${confirmedTeams - 1}팀`;
                }
            } else {
                document.getElementById('playoff-confirmed-desc').textContent = 'PO 매직넘버 0 달성';
            }

            // 최고 연승팀 (동점 시 2팀 표기)
            let bestStreakTeams = [];
            let maxWinStreak = 0;
            currentStandings.forEach(team => {
                if (team.streak.includes('승')) {
                    const count = parseInt(team.streak);
                    if (count > maxWinStreak) {
                        maxWinStreak = count;
                        bestStreakTeams = [team.team];
                    } else if (count === maxWinStreak && count > 0) {
                        bestStreakTeams.push(team.team);
                    }
                }
            });
            if (bestStreakTeams.length > 0) {
                const teamsToShow = bestStreakTeams.slice(0, 2); // 최대 2팀까지
                const teamLogos = teamsToShow.map(teamName => {
                    const teamData = kboTeams[teamName];
                    return `<div style="display: flex; align-items: center; gap: 2px;">
                        ${teamData.logo}
                        <span style="color: ${teamData.color};  ">${teamName}</span>
                    </div>`;
                }).join('');
                
                document.getElementById('best-streak-team').innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        ${teamLogos}
                    </div>
                `;
                document.getElementById('best-streak-count').textContent = `${maxWinStreak}연승 중`;
            } else {
                document.getElementById('best-streak-team').textContent = '없음';
                document.getElementById('best-streak-count').textContent = '-';
            }

            // 최고 연패팀 (동점 시 2팀 표기)
            let worstStreakTeams = [];
            let maxLossStreak = 0;
            currentStandings.forEach(team => {
                if (team.streak.includes('패')) {
                    const count = parseInt(team.streak);
                    if (count > maxLossStreak) {
                        maxLossStreak = count;
                        worstStreakTeams = [team.team];
                    } else if (count === maxLossStreak && count > 0) {
                        worstStreakTeams.push(team.team);
                    }
                }
            });
            if (worstStreakTeams.length > 0) {
                const teamsToShow = worstStreakTeams.slice(0, 2); // 최대 2팀까지
                const teamLogos = teamsToShow.map(teamName => {
                    const teamData = kboTeams[teamName];
                    return `<div style="display: flex; align-items: center; gap: 2px;">
                        ${teamData.logo}
                        <span style="color: ${teamData.color};  ">${teamName}</span>
                    </div>`;
                }).join('');
                
                document.getElementById('worst-streak-team').innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        ${teamLogos}
                    </div>
                `;
                document.getElementById('worst-streak-count').textContent = `${maxLossStreak}연패 중`;
            } else {
                document.getElementById('worst-streak-team').textContent = '없음';
                document.getElementById('worst-streak-count').textContent = '-';
            }

            // 최근 10경기 성적이 가장 좋은 팀 찾기 (10경기 승률 기준)
            let bestRecentTeams = [];
            let maxRecentWinRate = -1;
            
            currentStandings.forEach(team => {
                if (team.recent10) {
                    // "7승1무2패" 형태에서 승, 무, 패 추출
                    const winsMatch = team.recent10.match(/(\d+)승/);
                    const drawsMatch = team.recent10.match(/(\d+)무/);
                    const lossesMatch = team.recent10.match(/(\d+)패/);
                    
                    if (winsMatch) {
                        const wins = parseInt(winsMatch[1]);
                        const draws = drawsMatch ? parseInt(drawsMatch[1]) : 0;
                        const losses = lossesMatch ? parseInt(lossesMatch[1]) : 0;
                        
                        // 최근 10경기 승률 계산 (무승부 제외)
                        const recentWinRate = (wins + losses) > 0 ? wins / (wins + losses) : 0;
                        
                        // 팀 정보에 10경기 승률 추가
                        team.recent10WinRate = recentWinRate;
                        
                        if (recentWinRate > maxRecentWinRate) {
                            maxRecentWinRate = recentWinRate;
                            bestRecentTeams = [team];
                        } else if (recentWinRate === maxRecentWinRate && recentWinRate > 0) {
                            bestRecentTeams.push(team);
                        }
                    }
                }
            });
            
            if (bestRecentTeams.length > 0 && maxRecentWinRate >= 0) {
                const teamsToShow = bestRecentTeams.slice(0, 3); // 최대 3팀까지
                const teamLogos = teamsToShow.map(team => {
                    const teamData = kboTeams[team.team];
                    const winRate = (team.recent10WinRate * 100).toFixed(1);
                    return `<div style="display: flex; align-items: center; gap: 2px;">
                        ${teamData.logo}
                        <span style="color: ${teamData.color};">${team.team}</span>
                    </div>`;
                }).join(' ');
                
                document.getElementById('recent-best-team').innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        ${teamLogos}
                    </div>
                `;
                
                // 성적 표시 (10경기 승률 포함)
                const winRateText = bestRecentTeams[0].recent10WinRate.toFixed(3);
                document.getElementById('recent-best-record').textContent = `${bestRecentTeams[0].recent10} (승률 ${winRateText})`;
            } else {
                document.getElementById('recent-best-team').textContent = '-';
                document.getElementById('recent-best-record').textContent = '-';
            }

        }

        // 테이블 정렬 상태
        let sortState = {
            standings: { column: '', direction: '' },
            playoff: { column: '', direction: '' }
        };

        // 테이블 정렬 함수
        function sortTable(tableType, column) {
            const currentSort = sortState[tableType];
            
            // 정렬 방향 결정
            let direction = 'asc';
            if (currentSort.column === column) {
                direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            }
            
            // 이전 헤더의 정렬 표시 제거
            document.querySelectorAll(`#${tableType}-table .sortable-header`).forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
                const arrow = header.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = '↕';
            });
            
            // 현재 헤더에 정렬 표시 추가
            const currentHeader = document.querySelector(`#${tableType}-table .sortable-header[data-sort="${column}"]`);
            if (currentHeader) {
                currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
                const arrow = currentHeader.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = direction === 'asc' ? '↑' : '↓';
            }
            
            // 정렬 상태 업데이트
            sortState[tableType] = { column, direction };
            
            // 테이블 정렬 실행
            if (tableType === 'standings') {
                sortStandingsTable(column, direction);
            } else if (tableType === 'playoff') {
                sortPlayoffTable(column, direction);
            }
        }

        // 순위표 정렬
        function sortStandingsTable(column, direction) {
            const table = document.getElementById('standings-table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            // 테이블에 정렬 중 표시
            table.classList.add('sorting');
            
            rows.sort((a, b) => {
                let aValue, bValue;
                
                switch(column) {
                    case 'rank':
                        aValue = parseInt(a.cells[0].textContent);
                        bValue = parseInt(b.cells[0].textContent);
                        break;
                    case 'games':
                        aValue = parseInt(a.cells[2].textContent);
                        bValue = parseInt(b.cells[2].textContent);
                        break;
                    case 'wins':
                        aValue = parseInt(a.cells[3].textContent);
                        bValue = parseInt(b.cells[3].textContent);
                        break;
                    case 'losses':
                        aValue = parseInt(a.cells[4].textContent);
                        bValue = parseInt(b.cells[4].textContent);
                        break;
                    case 'draws':
                        aValue = parseInt(a.cells[5].textContent);
                        bValue = parseInt(b.cells[5].textContent);
                        break;
                    case 'winLossMargin':
                        aValue = parseInt(a.cells[6].textContent.replace('+', ''));
                        bValue = parseInt(b.cells[6].textContent.replace('+', ''));
                        break;
                    case 'winPct':
                        aValue = parseFloat(a.cells[7].textContent);
                        bValue = parseFloat(b.cells[7].textContent);
                        break;
                    case 'gamesBehind':
                        aValue = a.cells[8].textContent === '-' ? 0 : parseFloat(a.cells[8].textContent);
                        bValue = b.cells[8].textContent === '-' ? 0 : parseFloat(b.cells[8].textContent);
                        break;
                    case 'remainingGames':
                        aValue = parseInt(a.cells[9].textContent);
                        bValue = parseInt(b.cells[9].textContent);
                        break;
                    case 'recent10':
                        // "7승1무2패" 형태에서 승률 계산
                        const aRecord = a.cells[10].textContent;
                        const bRecord = b.cells[10].textContent;
                        
                        const aWins = parseInt(aRecord.match(/(\d+)승/)?.[1] || 0);
                        const aLosses = parseInt(aRecord.match(/(\d+)패/)?.[1] || 0);
                        const bWins = parseInt(bRecord.match(/(\d+)승/)?.[1] || 0);
                        const bLosses = parseInt(bRecord.match(/(\d+)패/)?.[1] || 0);
                        
                        // 승률 계산 (무승부 제외)
                        aValue = (aWins + aLosses) > 0 ? aWins / (aWins + aLosses) : 0;
                        bValue = (bWins + bLosses) > 0 ? bWins / (bWins + bLosses) : 0;
                        break;
                    case 'streak':
                        const aStreak = a.cells[11].textContent;
                        const bStreak = b.cells[11].textContent;
                        // 연속 승리는 양수, 연속 패배는 음수로 처리
                        aValue = aStreak.includes('승') ? parseInt(aStreak.match(/\d+/)?.[0] || 0) : -parseInt(aStreak.match(/\d+/)?.[0] || 0);
                        bValue = bStreak.includes('승') ? parseInt(bStreak.match(/\d+/)?.[0] || 0) : -parseInt(bStreak.match(/\d+/)?.[0] || 0);
                        break;
                    case 'home':
                        // 홈 성적에서 승률 계산
                        const aHome = a.cells[12].textContent;
                        const bHome = b.cells[12].textContent;
                        const aHomeWins = parseInt(aHome.match(/(\d+)-/)?.[1] || 0);
                        const aHomeLosses = parseInt(aHome.match(/-(\d+)/)?.[1] || 0);
                        const bHomeWins = parseInt(bHome.match(/(\d+)-/)?.[1] || 0);
                        const bHomeLosses = parseInt(bHome.match(/-(\d+)/)?.[1] || 0);
                        aValue = (aHomeWins + aHomeLosses) > 0 ? aHomeWins / (aHomeWins + aHomeLosses) : 0;
                        bValue = (bHomeWins + bHomeLosses) > 0 ? bHomeWins / (bHomeWins + bHomeLosses) : 0;
                        break;
                    case 'away':
                        // 방문 성적에서 승률 계산
                        const aAway = a.cells[13].textContent;
                        const bAway = b.cells[13].textContent;
                        const aAwayWins = parseInt(aAway.match(/(\d+)-/)?.[1] || 0);
                        const aAwayLosses = parseInt(aAway.match(/-(\d+)/)?.[1] || 0);
                        const bAwayWins = parseInt(bAway.match(/(\d+)-/)?.[1] || 0);
                        const bAwayLosses = parseInt(bAway.match(/-(\d+)/)?.[1] || 0);
                        aValue = (aAwayWins + aAwayLosses) > 0 ? aAwayWins / (aAwayWins + aAwayLosses) : 0;
                        bValue = (bAwayWins + bAwayLosses) > 0 ? bAwayWins / (bAwayWins + bAwayLosses) : 0;
                        break;
                    case 'maxRank':
                        aValue = parseInt(a.cells[14].textContent);
                        bValue = parseInt(b.cells[14].textContent);
                        break;
                    case 'minRank':
                        aValue = parseInt(a.cells[15].textContent);
                        bValue = parseInt(b.cells[15].textContent);
                        break;
                    default:
                        return 0;
                }
                
                if (direction === 'asc') {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
            
            // 정렬된 행들을 다시 추가
            tbody.innerHTML = '';
            rows.forEach((row, index) => {
                row.style.animationDelay = `${index * 0.05}s`;
                tbody.appendChild(row);
            });
            
            // 정렬 완료 후 표시 제거
            setTimeout(() => {
                table.classList.remove('sorting');
            }, 300);
        }

        // 플레이오프 테이블 정렬
        function sortPlayoffTable(column, direction) {
            const table = document.getElementById('playoff-table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            table.classList.add('sorting');
            
            rows.sort((a, b) => {
                let aValue, bValue;
                
                switch(column) {
                    case 'rank':
                        aValue = parseInt(a.cells[0].textContent);
                        bValue = parseInt(b.cells[0].textContent);
                        break;
                    case 'wins':
                        aValue = parseInt(a.cells[2].textContent);
                        bValue = parseInt(b.cells[2].textContent);
                        break;
                    case 'remaining':
                        aValue = parseInt(a.cells[3].textContent);
                        bValue = parseInt(b.cells[3].textContent);
                        break;
                    case 'maxWins':
                        aValue = parseInt(a.cells[4].textContent);
                        bValue = parseInt(b.cells[4].textContent);
                        break;
                    case 'poMagic':
                        const aPoMagic = a.cells[5].textContent;
                        const bPoMagic = b.cells[5].textContent;
                        aValue = getMagicNumberSortValue(aPoMagic);
                        bValue = getMagicNumberSortValue(bPoMagic);
                        break;
                    case 'poTragic':
                        const aPoTragic = a.cells[6].textContent;
                        const bPoTragic = b.cells[6].textContent;
                        aValue = getMagicNumberSortValue(aPoTragic);
                        bValue = getMagicNumberSortValue(bPoTragic);
                        break;
                    case 'poRequiredWinPct':
                        const aPoReq = a.cells[7].textContent;
                        const bPoReq = b.cells[7].textContent;
                        aValue = aPoReq === '-' || aPoReq === '확정' || aPoReq === '탈락' || aPoReq === '자력불가' ? -1 : parseFloat(aPoReq);
                        bValue = bPoReq === '-' || bPoReq === '확정' || bPoReq === '탈락' || bPoReq === '자력불가' ? -1 : parseFloat(bPoReq);
                        break;
                    case 'magic':
                        const aMagic = a.cells[9].textContent;
                        const bMagic = b.cells[9].textContent;
                        aValue = getMagicNumberSortValue(aMagic);
                        bValue = getMagicNumberSortValue(bMagic);
                        break;
                    case 'tragic':
                        const aTragic = a.cells[10].textContent;
                        const bTragic = b.cells[10].textContent;
                        aValue = getMagicNumberSortValue(aTragic);
                        bValue = getMagicNumberSortValue(bTragic);
                        break;
                    case 'requiredWinPct':
                        const aReq = a.cells[11].textContent;
                        const bReq = b.cells[11].textContent;
                        aValue = aReq === '-' || aReq === '달성' ? -1 : parseFloat(aReq);
                        bValue = bReq === '-' || bReq === '달성' ? -1 : parseFloat(bReq);
                        break;
                    default:
                        return 0;
                }
                
                if (direction === 'asc') {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
            
            tbody.innerHTML = '';
            rows.forEach((row, index) => {
                row.style.animationDelay = `${index * 0.05}s`;
                tbody.appendChild(row);
            });
            
            setTimeout(() => {
                table.classList.remove('sorting');
            }, 300);
        }

        // 매직넘버 정렬 값 변환
        function getMagicNumberSortValue(magic) {
            if (magic === '확정' || magic === 'PO확정') return -1;
            if (magic === '불가능' || magic === '탈락') return 9999;
            return parseInt(magic) || 0;
        }

        function renderStandingsTable() {
            try {
                // 성능 모니터링 시작
                const startTime = performance.now();
                
                
                const tbody = document.querySelector('#standings-table tbody');
                
                if (!tbody) {
                    throw new Error('순위표 테이블을 찾을 수 없습니다');
                }
                tbody.innerHTML = '';

                if (!currentStandings || currentStandings.length === 0) {
                    throw new Error('순위 데이터가 없습니다');
                }

                // 모든 추격팀의 최대가능승수 중 최고값 찾기
                const maxPossibleWinsByChaser = Math.max(...currentStandings.slice(1).map(team => 
                    team.wins + (144 - team.games)
                ));

                // 승률이 같은 팀에게 같은 순위 부여
                let currentRank = 1;
                let previousWinRate = null;
                
                currentStandings.forEach((team, index) => {
                // 이전 팀과 승률이 다르면 실제 순위로 업데이트
                if (previousWinRate !== null && team.winPct !== previousWinRate) {
                    currentRank = index + 1;
                }
                // 동률일 경우 같은 순위 유지
                team.displayRank = currentRank;
                previousWinRate = team.winPct;
                const row = document.createElement('tr');
                const totalGames = 144;
                const remainingGames = totalGames - team.games;
                const teamData = kboTeams[team.team];
                
                // 데이터 검증
                if (!teamData) {
                    logger.error('❌ 팀 데이터 없음:', team.team);
                    return;
                }
                
                let rankClass = '';
                if (team.displayRank === 1) rankClass = 'rank-1';
                else if (team.displayRank === 2) rankClass = 'rank-2';
                else if (team.displayRank === 3) rankClass = 'rank-3';
                else if (team.displayRank >= 4 && team.displayRank <= 5) rankClass = 'playoff';
                
                row.className = rankClass;
                row.style.borderLeft = `4px solid ${teamData.color}`;

                // 가능한 순위 계산
                const maxPossibleWins = team.wins + remainingGames; // 전승시
                const minPossibleWins = team.wins; // 전패시
                
                // 최대 가능 순위 (가장 좋은 순위, 숫자가 작음) - 전승했을 때
                let maxRank = 1;
                const myMaxLosses = team.losses; // 내 전승시 패수는 그대로
                const myMaxWinRate = maxPossibleWins / (maxPossibleWins + myMaxLosses); // 내 최고 승률 (무승부 제외)
                
                for (let i = 0; i < currentStandings.length; i++) {
                    const otherTeam = currentStandings[i];
                    if (otherTeam.team === team.team) continue;
                    
                    const otherMinWins = otherTeam.wins; // 상대팀 전패시
                    const otherMinLosses = otherTeam.losses + (144 - otherTeam.games); // 상대팀 전패시 패수
                    const otherMinWinRate = otherMinWins / (otherMinWins + otherMinLosses); // 상대팀 최저 승률 (무승부 제외)
                    
                    // KBO 동률 처리 규칙 적용 (승률 → 승패차 → 상대전적)
                    if (myMaxWinRate < otherMinWinRate) {
                        maxRank++;
                    } else if (Math.abs(myMaxWinRate - otherMinWinRate) < 0.0001) {
                        // 승률이 같을 때 승패차 비교
                        const myMaxMargin = maxPossibleWins - team.losses; // 내 전승시 승패차
                        const otherMinMargin = otherTeam.wins - (otherTeam.losses + (144 - otherTeam.games)); // 상대 전패시 승패차
                        
                        if (myMaxMargin < otherMinMargin) {
                            maxRank++;
                        }
                        // 승률과 승패차가 모두 같을 경우는 상대전적 고려 필요하지만 복잡하므로 보수적으로 동순위 처리
                    }
                }
                
                // 최소 가능 순위 (가장 나쁜 순위, 숫자가 큼) - 전패했을 때
                let minRank = 1;
                const myMinLosses = team.losses + (144 - team.games); // 내 전패시 패수
                const myMinWinRate = minPossibleWins / (minPossibleWins + myMinLosses); // 내 최저 승률 (무승부 제외)
                
                for (let i = 0; i < currentStandings.length; i++) {
                    const otherTeam = currentStandings[i];
                    if (otherTeam.team === team.team) continue;
                    
                    const otherMaxWins = otherTeam.wins + (144 - otherTeam.games); // 상대팀 전승시
                    const otherMaxLosses = otherTeam.losses; // 상대팀 전승시 패수는 그대로
                    const otherMaxWinRate = otherMaxWins / (otherMaxWins + otherMaxLosses); // 상대팀 최고 승률 (무승부 제외)
                    
                    // KBO 동률 처리 규칙 적용 (승률 → 승패차 → 상대전적)
                    if (myMinWinRate < otherMaxWinRate) {
                        minRank++;
                    } else if (Math.abs(myMinWinRate - otherMaxWinRate) < 0.0001) {
                        // 승률이 같을 때 승패차 비교
                        const myMinMargin = minPossibleWins - (team.losses + (144 - team.games)); // 내 전패시 승패차
                        const otherMaxMargin = otherMaxWins - otherTeam.losses; // 상대 전승시 승패차
                        
                        if (myMinMargin < otherMaxMargin) {
                            minRank++;
                        } else if (Math.abs(myMinMargin - otherMaxMargin) < 0.0001) {
                            // 승률과 승패차가 모두 같을 경우, 상대전적으로 결정되므로 최악의 경우 가정
                            minRank++; // 보수적으로 상대방이 위에 있다고 가정 (최소순위는 가장 나쁜 경우)
                        }
                    }
                }
                
                // 순위는 10위를 넘을 수 없음
                maxRank = Math.min(maxRank, 10);
                minRank = Math.min(minRank, 10);

                // 연속 기록 강조
                const streakFormatted = formatStreak(team.streak);
                
                // 최근 10경기 강조
                const recent10Formatted = formatRecent10(team.recent10);
                
                // 팀명 로고 추가
                const teamNameWithLogo = Utils.getTeamNameWithLogo(team);

                // 홈/방문 성적 - JSON 데이터에서 실제 값 사용 (분리)
                const homeRecord = team.homeRecord || "0-0-0";
                const awayRecord = team.awayRecord || "0-0-0";
                const homeDisplay = `<span style="color: #2563eb;">${homeRecord}</span>`;
                const awayDisplay = `<span style="color: #dc2626;">${awayRecord}</span>`;

                const winLossMargin = team.wins - team.losses;
                const marginColor = winLossMargin > 0 ? '#27ae60' : winLossMargin < 0 ? '#e74c3c' : '#666';
                const marginDisplay = winLossMargin > 0 ? `+${winLossMargin}` : winLossMargin.toString();
                
                row.innerHTML = `
                    <td style="color: ${teamData.color};">${team.displayRank}</td>
                    <td class="team-name">${teamNameWithLogo}</td>
                    <td>${team.games}</td>
                    <td>${team.wins}</td>
                    <td>${team.losses}</td>
                    <td>${team.draws}</td>
                    <td style="color: ${marginColor};">${marginDisplay}</td>
                    <td>${team.winPct.toFixed(3)}</td>
                    <td>${team.gamesBehind === 0 ? '-' : team.gamesBehind}</td>
                    <td>${remainingGames}</td>
                    <td>${recent10Formatted}</td>
                    <td>${streakFormatted}</td>
                    <td>${homeDisplay}</td>
                    <td>${awayDisplay}</td>
                    <td>${maxRank}</td>
                    <td>${minRank}</td>
                `;

                tbody.appendChild(row);
            });
            
            // 성능 모니터링 완료
            const renderTime = performance.now() - startTime;
            if (renderTime > 100 && window.logPerformanceIssue) {
                window.logPerformanceIssue({
                    function: 'renderStandingsTable',
                    duration: renderTime,
                    message: `순위표 렌더링이 ${renderTime.toFixed(2)}ms 소요되었습니다`
                });
            }
            
            } catch (error) {
                // 에러 모니터링 로깅
                if (window.logUserError) {
                    window.logUserError('standings_render', error.message);
                }
                handleError(error, '순위표 렌더링 실패');
                // 에러가 발생하면 기본 메시지 표시
                const tbody = document.querySelector('#standings-table tbody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="16" style="text-align: center; color: #999; padding: 20px;">데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</td></tr>';
                }
            }
        }

        function formatStreak(streak) {
            if (streak.includes('승')) {
                const winCount = parseInt(streak);
                if (winCount >= 5) {
                    return `<span style="color: var(--success-color); ">${streak}</span>`;
                }
                return `<span style="color: var(--success-color);">${streak}</span>`;
            } else if (streak.includes('패')) {
                const lossCount = parseInt(streak);
                if (lossCount >= 5) {
                    return `<span style="color: var(--danger-color); ">${streak}</span>`;
                }
                return `<span style="color: var(--danger-color);">${streak}</span>`;
            }
            return streak;
        }

        function formatRecent10(recent10) {
            // "6승1무3패" 형태 파싱
            const winMatch = recent10.match(/(\d+)승/);
            const lossMatch = recent10.match(/(\d+)패/);
            const drawMatch = recent10.match(/(\d+)무/);
            
            const wins = winMatch ? parseInt(winMatch[1]) : 0;
            const losses = lossMatch ? parseInt(lossMatch[1]) : 0;
            const draws = drawMatch ? parseInt(drawMatch[1]) : 0;
            
            // 승 패 무 형태로 변환 (띄어쓰기 포함)
            const formattedRecord = `${wins}승 ${losses}패 ${draws}무`;
            
            // 색상 기준: 승수에 따른 색상 적용
            if (wins >= 8) {
                // 8승 이상 - 매우 뜨거운 상승세
                return `<span style="color: var(--success-color); font-weight: 600;">${formattedRecord}</span>`;
            } else if (wins >= 6) {
                // 6-7승 - 상승세
                return `<span style="color: var(--success-color);">${formattedRecord}</span>`;
            } else if (wins >= 4) {
                // 4-5승 - 보통
                return `<span style="color: var(--warning-color);">${formattedRecord}</span>`;
            } else {
                // 3승 이하 - 부진
                return `<span style="color: var(--danger-color);">${formattedRecord}</span>`;
            }
        }

        function getStatusIndicator(team) {
            if (team.displayRank === 1 && team.magicNumber <= 10) {
                return '<span class="status-indicator clinched">우승권</span>';
            } else if (team.displayRank <= 5) {
                return '<span class="status-indicator contending">PO권</span>';
            }
            return '';
        }

        function calculateMagicNumber(firstPlace, secondPlace) {
            // service-data.json의 매직넘버 사용
            const magicNumbers = currentKBOData?.magicNumbers || {};
            const teamMagicData = magicNumbers[firstPlace.team];
            return teamMagicData ? teamMagicData.championship : 0;
        }


        // 1위팀 컬러로 우승 조건 섹션 꾸미기
        function applyChampionshipTeamColors(teamData) {
            const championshipSection = document.querySelector('.championship-section');
            const bgAccent = document.querySelector('.championship-bg-accent');
            const mainDisplay = document.querySelector('.championship-main-display');
            const title = championshipSection?.querySelector('h2');
            
            if (!teamData || !championshipSection) return;
            
            // 팀 컬러를 CSS 변수로 설정
            const teamColor = teamData.color || '#1a237e';
            const teamColorRgb = hexToRgb(teamColor);
            const secondaryColor = lightenColor(teamColor, 20);
            
            championshipSection.style.setProperty('--team-color', teamColor);
            championshipSection.style.setProperty('--team-secondary-color', secondaryColor);
            championshipSection.style.setProperty('--team-color-rgb', teamColorRgb);
            
            // 상단 액센트 바 색상
            if (bgAccent) {
                bgAccent.style.background = `linear-gradient(90deg, ${teamColor}, ${secondaryColor})`;
            }
            
            // 메인 디스플레이 영역 색상
            if (mainDisplay) {
                mainDisplay.style.background = `linear-gradient(135deg, 
                    ${teamColor}08 0%, 
                    ${teamColor}15 50%, 
                    ${teamColor}08 100%)`;
                mainDisplay.style.borderColor = `${teamColor}40`;
                mainDisplay.style.boxShadow = `0 4px 12px ${teamColor}20, inset 0 1px 3px rgba(255, 255, 255, 0.5)`;
            }
            
            // 제목 색상
            if (title) {
                title.style.color = teamColor;
                title.style.textShadow = `0 1px 2px ${teamColor}20`;
            }
            
            // 통계 카드들 색상
            const statCards = championshipSection.querySelectorAll('.stat-card');
            statCards.forEach(card => {
                card.style.background = `linear-gradient(135deg, ${teamColor}04 0%, ${teamColor}10 100%)`;
                card.style.borderColor = `${teamColor}25`;
                card.style.borderTopColor = `${teamColor}60`;
                
                const statValue = card.querySelector('.stat-value');
                if (statValue) {
                    statValue.style.color = teamColor;
                    statValue.style.textShadow = `0 1px 2px ${teamColor}15`;
                }
            });
            
            // 우승확정일 박스 색상
            const clinchDateBox = championshipSection.querySelector('.clinch-date-box');
            const clinchDateValue = document.getElementById('clinch-date');
            if (clinchDateBox) {
                clinchDateBox.style.background = `linear-gradient(135deg, ${teamColor}08 0%, ${teamColor}15 100%)`;
                clinchDateBox.style.borderColor = `${teamColor}35`;
                clinchDateBox.style.boxShadow = `0 4px 12px ${teamColor}20`;
                
                // 상단 액센트 라인
                const topAccent = clinchDateBox.querySelector('div[style*="position: absolute"]');
                if (topAccent) {
                    topAccent.style.background = `linear-gradient(90deg, ${teamColor}, ${secondaryColor})`;
                }
            }
            
            if (clinchDateValue) {
                clinchDateValue.style.color = teamColor;
                clinchDateValue.style.textShadow = `0 1px 2px ${teamColor}20`;
            }
        }
        
        // 색상 유틸리티 함수들
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? 
                `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
                '26, 35, 126';
        }
        
        function lightenColor(hex, percent) {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        }

        function renderChampionshipCondition() {
            
            if (!currentStandings || currentStandings.length === 0) {
                logger.error('❌ currentStandings 데이터가 없습니다');
                return;
            }
            
            const firstPlace = currentStandings[0];
            const secondPlace = currentStandings[1];
            const teamData = kboTeams[firstPlace.team];
            
            
            const totalGames = 144;
            const remainingGames = totalGames - firstPlace.games;
            const maxPossibleWins = firstPlace.wins + remainingGames;
            const magicNumber = calculateMagicNumber(firstPlace, secondPlace);
            
            // 우승 가능 최소 승수 계산 (service-data.json의 정확한 계산 사용)
            const magicNumbers = currentKBOData?.magicNumbers || {};
            const teamMagicData = magicNumbers[firstPlace.team];
            const minWinsNeeded = firstPlace.wins + (teamMagicData ? teamMagicData.championship : 0);
            
            // 우승 가능 최소 승수를 달성하기 위한 필요 승률 계산
            const neededWinsForMinWins = teamMagicData ? teamMagicData.championship : 0;
            const requiredWinPct = remainingGames > 0 ? (neededWinsForMinWins / remainingGames) : 0;
            
            // 144경기 체제 역대 1위 평균 기준 필요 승률 계산 (2015-2024: 86.9승)
            const historicalFirstPlaceWins = 87; // 2015-2024년 1위팀 평균 승수
            const neededWinsForHistorical = Math.max(0, historicalFirstPlaceWins - firstPlace.wins);
            const historicalRequiredWinPct = remainingGames > 0 ? (neededWinsForHistorical / remainingGames) : 0;
            
            // 예상 우승확정일 계산
            let clinchDateText = '';
            
            if (magicNumber > 0) {
                const targetGameNumber = firstPlace.games + magicNumber;
                
                if (targetGameNumber <= totalGames) {
                    // 잔여경기 일정에서 날짜 계산
                    const expectedDate = calculateClinchDate(firstPlace.team, magicNumber);
                    if (expectedDate) {
                        clinchDateText = `${expectedDate} (${targetGameNumber}번째 경기)`;
                    } else {
                        clinchDateText = `${targetGameNumber}번째 경기에서 확정 가능`;
                    }
                } else {
                    clinchDateText = `시즌 종료 후 (${targetGameNumber}번째 경기 필요)`;
                }
            } else {
                clinchDateText = '이미 우승 확정';
            }
            
            // 팀 로고와 이름 업데이트
            document.getElementById('first-place-logo').innerHTML = teamData.logo;
            document.getElementById('first-place-team-name').textContent = `${firstPlace.team} 1위`;
            document.getElementById('first-place-team-name').style.color = teamData.color;
            
            // 1위팀 컬러로 우승 조건 섹션 꾸미기
            applyChampionshipTeamColors(teamData);
            
            // 매직넘버 라인 옆 정보 업데이트
            document.getElementById('remaining-games-top-display').textContent = `${remainingGames}경기`;
            document.getElementById('min-wins-top-display').textContent = `${minWinsNeeded}승`;
            
            // 각 카드 정보 업데이트
            document.getElementById('first-place-record').textContent = `${firstPlace.wins}승 ${firstPlace.losses}패 ${firstPlace.draws}무`;
            document.getElementById('first-place-winpct').textContent = `${(firstPlace.winPct || firstPlace.winRate).toFixed(3)}`;
            document.getElementById('first-place-max-wins').textContent = `${maxPossibleWins}승`;
            const championshipMagicElement = document.getElementById('championship-magic');
            championshipMagicElement.textContent = `매직넘버: ${magicNumber > 0 ? magicNumber : '우승확정'}`;
            
            // 1위 팀의 색상으로 매직넘버 스타일 설정
            const teamColor = teamData?.color || '#FF6B35';
            championshipMagicElement.style.color = teamColor;
            championshipMagicElement.style.textShadow = `0 2px 8px ${teamColor}40`;
            document.getElementById('required-winpct').textContent = neededWinsForMinWins > 0 ? `${requiredWinPct.toFixed(3)}` : '달성';
            document.getElementById('historical-required-winpct').textContent = neededWinsForHistorical > 0 ? `${historicalRequiredWinPct.toFixed(3)}` : '달성';
            // 모바일에서 줄바꿈을 위해 개행문자 추가 (한 줄만)
            let formattedClinchDate = clinchDateText;
            
            // 각 패턴별로 줄바꿈 처리 - 한 곳에서만 줄바꿈
            if (clinchDateText.includes('번째 경기에서 확정 가능')) {
                formattedClinchDate = clinchDateText.replace('확정 가능 (일정', '확정 가능\n(일정');
            } else if (clinchDateText.includes('시즌 종료 후')) {
                formattedClinchDate = clinchDateText.replace('시즌 종료 후', '\n시즌 종료 후');
            } else if (clinchDateText === '이미 우승 확정') {
                formattedClinchDate = '이미\n우승 확정';
            }
            
            document.getElementById('clinch-date').textContent = formattedClinchDate;
            
            // ===========================================
            // 새로운 확률 정보 및 역사적 비교 계산
            // ===========================================
            
            // 1. 현재 승률 유지시 우승 확률 계산
            const currentWinRate = firstPlace.winPct || firstPlace.winRate;
            const projectedTotalWins = Math.round(currentWinRate * totalGames);
            const secondPlaceMaxWins = (secondPlace?.wins || 0) + (totalGames - (secondPlace?.games || 0));
            
            let championshipProbability = 0;
            let probabilityDetail = '';
            
            if (projectedTotalWins > secondPlaceMaxWins) {
                championshipProbability = 98; // 거의 확실
                probabilityDetail = `예상 ${projectedTotalWins}승으로 2위 최대가능승수(${secondPlaceMaxWins}승) 초과`;
            } else if (projectedTotalWins === secondPlaceMaxWins) {
                championshipProbability = 75; // 높은 확률
                probabilityDetail = `예상 ${projectedTotalWins}승으로 2위와 동일 (직접대결 등 변수)`;
            } else {
                const gap = secondPlaceMaxWins - projectedTotalWins;
                if (gap <= 2) {
                    championshipProbability = 60;
                    probabilityDetail = `예상 ${projectedTotalWins}승 (2위보다 ${gap}승 적음, 변수 존재)`;
                } else if (gap <= 5) {
                    championshipProbability = 35;
                    probabilityDetail = `예상 ${projectedTotalWins}승 (2위보다 ${gap}승 적음, 어려움)`;
                } else {
                    championshipProbability = 10;
                    probabilityDetail = `예상 ${projectedTotalWins}승 (2위보다 ${gap}승 적음, 매우 어려움)`;
                }
            }
            
            // 2. 최악 시나리오 계산 (연패 가능 경기수)
            const safeWins = secondPlaceMaxWins + 1; // 안전한 승수
            const maxConsecutiveLosses = Math.max(0, maxPossibleWins - safeWins);
            
            let worstScenario = '';
            let worstScenarioDetail = '';
            
            if (firstPlace.wins >= safeWins) {
                worstScenario = '이미 안전권';
                worstScenarioDetail = `${safeWins}승 달성으로 우승 확정`;
            } else if (maxConsecutiveLosses >= remainingGames) {
                worstScenario = '모든 경기 패배 가능';
                worstScenarioDetail = `${remainingGames}경기 모두 져도 우승 가능`;
            } else if (maxConsecutiveLosses > 0) {
                worstScenario = `최대 ${maxConsecutiveLosses}연패 가능`;
                worstScenarioDetail = `${maxConsecutiveLosses + 1}연패시 우승 위험`;
            } else {
                worstScenario = '모든 경기 승리 필요';
                worstScenarioDetail = '한 경기라도 지면 우승 어려움';
            }
            
            // 3. 역사적 비교 계산
            const currentDate = new Date();
            const isAugustMid = currentDate.getMonth() === 7 && currentDate.getDate() >= 15; // 8월 중순
            
            // 8월 중순 기준 역대 1위팀 평균 (대략적 계산)
            const gamesPlayedByAugust = Math.min(firstPlace.games, 100); // 8월 중순까지 대략 100경기
            const historicalAugustWins = Math.round(gamesPlayedByAugust * 0.620); // 역대 1위팀 평균 승률
            const historicalAugustWinRate = 0.620;
            
            // 현재 팀과 역대 평균 비교
            const currentVsHistorical = firstPlace.wins - historicalAugustWins;
            let historicalComparison = '';
            if (currentVsHistorical > 0) {
                historicalComparison = `${currentVsHistorical}승 앞서는 중`;
            } else if (currentVsHistorical < 0) {
                historicalComparison = `${Math.abs(currentVsHistorical)}승 뒤처진 상황`;
            } else {
                historicalComparison = '역대 평균과 동일';
            }
            
            // 현재 페이스로 시즌 종료시 예상 승수
            const currentPaceWins = Math.round(currentWinRate * totalGames);
            let championComparison = '';
            if (currentPaceWins >= 87) {
                championComparison = `역대 평균(86.9승)보다 ${currentPaceWins - 87}승 많음`;
            } else {
                championComparison = `역대 평균(86.9승)보다 ${87 - currentPaceWins}승 적음`;
            }
            
        }

        function renderChaseAnalysis() {
            try {
                const tbody = document.querySelector('#chase-table tbody');
                if (!tbody) {
                    throw new Error('1위 탈환 가능성 테이블을 찾을 수 없습니다');
                }
                tbody.innerHTML = '';

                if (!currentStandings || currentStandings.length === 0) {
                    throw new Error('순위 데이터가 없습니다');
                }

                const firstPlace = currentStandings[0];
                
                // 144경기 체제 역대 1위 평균 승수 (2015-2024: 86.9승)
                const historicalFirstPlaceWins = 87; // 2015-2024년 1위팀 평균 승수

                currentStandings.forEach((team, index) => {
                const teamData = kboTeams[team.team];
                const remainingGames = 144 - team.games;
                const maxPossibleWins = team.wins + remainingGames;
                const firstPlaceRemaining = 144 - firstPlace.games;
                
                // 1위 탈환 트래직넘버 계산
                const firstPlaceTragic = calculateFirstPlaceTragicNumber(team, currentStandings, index);
                
                // 1위팀과 2위 이하 팀별로 다른 로직 적용
                let requiredFirstPlaceWins, canCatch, winPctColor, winPctDisplay, canReachHistoricalAverage;
                
                if (team.displayRank === 1) {
                    // 1위팀: 현재 우승 상황 표시
                    requiredFirstPlaceWins = '-';
                    canCatch = '현재 1위';
                    
                    // 역대 1위 평균 달성 가능성
                    canReachHistoricalAverage = maxPossibleWins >= historicalFirstPlaceWins;
                    
                    // 87승까지 필요한 승률
                    const neededWinsForHistoricalAverage = Math.max(0, historicalFirstPlaceWins - team.wins);
                    const requiredWinPctForAverage = remainingGames > 0 ? 
                        neededWinsForHistoricalAverage / remainingGames : 0;
                    
                    // 역대 1위 기준 필요 승률 표시 로직 (1위팀용)
                    if (maxPossibleWins < historicalFirstPlaceWins || requiredWinPctForAverage > 1.0) {
                        // 최대가능 승수가 87 미만이거나 필요 승률이 1.0 초과하면 불가능
                        winPctColor = '#c0392b';
                        winPctDisplay = '불가능';
                    } else if (neededWinsForHistoricalAverage === 0) {
                        winPctColor = '#27ae60';
                        winPctDisplay = '달성';
                    } else {
                        winPctColor = '#3498db';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    }
                } else {
                    // 2위 이하팀: 기존 로직
                    requiredFirstPlaceWins = maxPossibleWins - 1;
                    // canCatch는 나중에 트래직넘버 기준으로 결정
                    
                    // 역대 1위 평균 기준으로 필요 승률 계산
                    const neededWinsForHistoricalAverage = Math.max(0, historicalFirstPlaceWins - team.wins);
                    const requiredWinPctForAverage = remainingGames > 0 ? 
                        neededWinsForHistoricalAverage / remainingGames : 0;
                    
                    // 144경기 체제 역대 1위 성적 달성 가능성 (87승 달성 가능한지)
                    canReachHistoricalAverage = maxPossibleWins >= historicalFirstPlaceWins;
                    
                    // 역대 1위 기준 필요 승률 표시 로직
                    if (maxPossibleWins < historicalFirstPlaceWins || requiredWinPctForAverage > 1.0) {
                        // 최대가능 승수가 87 미만이거나 필요 승률이 1.0 초과하면 불가능
                        winPctColor = '#c0392b';
                        winPctDisplay = '불가능';
                    } else if (neededWinsForHistoricalAverage === 0) {
                        winPctColor = '#27ae60';
                        winPctDisplay = '달성';
                    } else if (requiredWinPctForAverage > 0.700) {
                        winPctColor = '#2c3e50';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    } else if (requiredWinPctForAverage > 0.650) {
                        winPctColor = '#e74c3c';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    } else if (requiredWinPctForAverage > 0.550) {
                        winPctColor = '#e67e22';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    } else if (requiredWinPctForAverage > 0.450) {
                        winPctColor = '#f1c40f';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    } else {
                        winPctColor = '#27ae60';
                        winPctDisplay = requiredWinPctForAverage.toFixed(3);
                    }
                }
                
                const row = document.createElement('tr');
                row.style.borderLeft = `4px solid ${teamData.color}`;
                
                // 순위별 클래스 적용
                let rankClass = '';
                if (team.displayRank === 1) {
                    rankClass = 'rank-1 first-place-row';
                    // 1위팀에 팀 컬러 테두리와 배경 적용
                    row.style.border = `3px solid ${teamData.color}`;
                    row.style.boxShadow = `0 0 12px ${teamData.color}30`;
                    row.style.background = `linear-gradient(135deg, ${teamData.color}08 0%, ${teamData.color}15 100%)`;
                    row.style.borderRadius = '8px';
                } else if (team.displayRank === 2) rankClass = 'rank-2';
                else if (team.displayRank === 3) rankClass = 'rank-3';
                else if (team.displayRank >= 4 && team.displayRank <= 5) rankClass = 'playoff';
                row.className = rankClass;
                
                // 팀명에 로고 추가
                const teamNameWithLogo = Utils.getTeamNameWithLogo(team);
                
                // 1위팀인 경우 특별 스타일링
                const isFirstPlace = team.displayRank === 1;
                const textColor = isFirstPlace ? teamData.color : '#666';
                
                // 1위 탈환 트래직넘버 표시 텍스트 생성
                let tragicDisplay, tragicColor;
                if (team.displayRank === 1) {
                    tragicDisplay = '-';
                    tragicColor = teamData.color;
                } else if (firstPlaceTragic === 999) {
                    tragicDisplay = '불가능';
                    tragicColor = '#e74c3c';
                    // 트래직넘버가 불가능이면 탈환도 불가능
                    canCatch = '불가능';
                } else if (firstPlaceTragic === 0) {
                    tragicDisplay = '0';
                    tragicColor = '#f39c12'; // 주황색 - 임계점
                    // 트래직넘버가 0이면 아직 탈환 가능하지만 임계 상황
                    canCatch = '가능';
                } else {
                    tragicDisplay = firstPlaceTragic;
                    tragicColor = textColor; // 기본 텍스트 색상 사용
                    // 트래직넘버가 양수면 아직 탈환 가능
                    canCatch = '가능';
                }
                
                // 탈환 가능 여부에 따른 색상 결정 (canCatch 값 결정 후)
                const catchColor = isFirstPlace ? teamData.color : 
                    (canCatch === '가능' ? '#27ae60' : 
                     canCatch === '불가능' ? '#e74c3c' : '#3498db');
                
                row.innerHTML = `
                    <td style="color: ${teamData.color}; font-weight: ${isFirstPlace ? '700' : '600'};">${team.displayRank}</td>
                    <td class="team-name" style="font-weight: ${isFirstPlace ? '600' : 'normal'};">${teamNameWithLogo}</td>
                    <td style="color: ${textColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${team.wins}</td>
                    <td style="color: ${textColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${team.gamesBehind === 0 ? '-' : team.gamesBehind}</td>
                    <td style="color: ${textColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${remainingGames}</td>
                    <td style="color: ${textColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${maxPossibleWins}</td>
                    <td style="color: ${textColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${typeof requiredFirstPlaceWins === 'string' ? requiredFirstPlaceWins : requiredFirstPlaceWins + '승 이하'}</td>
                    <td style="color: ${tragicColor}; font-weight: ${isFirstPlace ? '700' : '600'}; text-shadow: ${isFirstPlace ? `0 1px 2px ${teamData.color}20` : 'none'};">
                        ${tragicDisplay}
                    </td>
                    <td style="color: ${catchColor}; font-weight: ${isFirstPlace ? '700' : '600'}; text-shadow: ${isFirstPlace ? `0 1px 2px ${teamData.color}20` : 'none'};">
                        ${typeof canCatch === 'string' ? canCatch : (canCatch ? '가능' : '불가능')}
                    </td>
                    <td style="color: ${isFirstPlace ? teamData.color : winPctColor}; font-weight: ${isFirstPlace ? '600' : 'normal'};">${winPctDisplay}</td>
                    <td style="color: ${canReachHistoricalAverage ? '#27ae60' : '#e74c3c'}; font-weight: ${isFirstPlace ? '600' : 'normal'};">
                        ${canReachHistoricalAverage ? '가능' : '불가능'}
                    </td>
                `;
                tbody.appendChild(row);
            });
            } catch (error) {
                handleError(error, '1위 탈환 가능성 렌더링 실패');
                const tbody = document.querySelector('#chase-table tbody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #999; padding: 20px;">데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</td></tr>';
                }
            }
        }

        
        // 🏟️ 플레이오프 진출 조건 테이블 렌더링 함수
        // HTML의 #playoff-table에 데이터를 표시하는 함수
        function renderPlayoffCondition() {
            try {
                const tbody = document.querySelector('#playoff-table tbody');
                if (!tbody) {
                    throw new Error('플레이오프 진출 조건 테이블을 찾을 수 없습니다');
                }
                tbody.innerHTML = '';

                // currentStandings로 직접 계산
                if (!currentStandings || currentStandings.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="11">데이터 로딩 중...</td></tr>';
                    return;
                }
                
                // 플레이오프 확정 팀 찾기 및 표시
                const confirmedTeams = [];
                currentStandings.forEach(team => {
                    const poMagicNumber = Utils.calculatePlayoffMagicNumber(team, currentStandings);
                    if (poMagicNumber === 0) {
                        confirmedTeams.push({
                            name: team.team,
                            rank: team.rank || team.displayRank
                        });
                    }
                });
                
                // 플레이오프 확정 팀 배너 업데이트
                const banner = document.getElementById('playoff-confirmed-banner');
                const teamsContainer = document.getElementById('playoff-confirmed-teams');
                
                if (confirmedTeams.length > 0) {
                    banner.style.display = 'block';
                    teamsContainer.innerHTML = confirmedTeams
                        .sort((a, b) => a.rank - b.rank)
                        .map(team => {
                            const teamData = kboTeams[team.name];
                            const bgColor = teamData ? teamData.bg : '#f0f0f0';
                            const textColor = teamData ? teamData.color : '#333';
                            return `
                                <div style="padding: 8px 12px; background: ${bgColor}; color: ${textColor}; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    ${team.rank}위 ${team.name}
                                </div>
                            `;
                        }).join('');
                } else {
                    banner.style.display = 'none';
                }
                
                currentStandings.forEach((team, index) => {
                const teamData = kboTeams[team.team];
                
                // displayRank 설정
                if (!team.displayRank && !team.rank) {
                    team.displayRank = index + 1;
                } else {
                    team.displayRank = team.displayRank || team.rank;
                }
                
                const remainingGames = 144 - team.games;
                const maxPossibleWins = team.wins + remainingGames;
                
                // 최대가능승수 기준으로 순위를 매겨서 5위 팀 찾기
                const teamsWithMaxWins = currentStandings.map(t => ({
                    ...t,
                    maxPossibleWins: t.wins + (144 - t.games)
                })).sort((a, b) => b.maxPossibleWins - a.maxPossibleWins);
                
                // 최대가능승수 기준 5위 팀의 최대가능승수가 "최종 5위 예상 승수"
                const fifthPlaceMaxWins = teamsWithMaxWins[4] ? teamsWithMaxWins[4].maxPossibleWins : 72;
                
                // Utils.calculatePlayoffMagicNumber 사용하여 통일된 로직 적용
                const poMagicNumber = Utils.calculatePlayoffMagicNumber(team, currentStandings);
                
                // 탈락 여부 먼저 확인 (현재 5위 팀 승률 vs 내 최대 가능 승률)
                const currentFifthPlace = currentStandings.find(t => t.rank === 5) || currentStandings.find(t => t.rank === 4);
                const currentFifthWinRate = currentFifthPlace ? currentFifthPlace.wins / (currentFifthPlace.wins + currentFifthPlace.losses) : 0;
                const myMaxWinRate = maxPossibleWins / (maxPossibleWins + team.losses);
                
                // PO 트래직넘버 미리 계산하여 탈락 여부 확인
                let tragicFifthPlace = null;
                if (currentStandings.length >= 5) {
                    tragicFifthPlace = currentStandings[4]; // 5위 팀
                } else if (currentStandings.length >= 4) {
                    tragicFifthPlace = currentStandings[3]; // 4위 팀
                }
                
                let poTragicNumber = 0;
                if (tragicFifthPlace) {
                    poTragicNumber = maxPossibleWins - (tragicFifthPlace.wins - 1);
                }
                
                // 표시 형식 결정
                let maxWinsMagicDisplay = '';
                if (currentFifthWinRate > myMaxWinRate || poTragicNumber <= 0) {
                    // 현재 5위 팀 승률보다 내 최대 가능 승률이 낮거나 트래직넘버가 0 이하면 탈락
                    maxWinsMagicDisplay = '<span style="color: #c0392b;">탈락</span>';
                } else if (poMagicNumber === 0) {
                    maxWinsMagicDisplay = '0';
                } else if (poMagicNumber > remainingGames) {
                    maxWinsMagicDisplay = `${poMagicNumber} <span style="color: #c0392b;">(자력불가)</span>`;
                } else {
                    maxWinsMagicDisplay = poMagicNumber;
                }
                
                // PO 진출 상황 결정
                let poStatus = '';
                
                // 5개 팀이 진출 확정되었는지 확인 (매직넘버 0인 팀 수)
                const confirmedTeams = currentStandings.filter(t => {
                    const teamPoMagicNumber = Utils.calculatePlayoffMagicNumber(t, currentStandings);
                    return teamPoMagicNumber === 0;
                }).length;
                
                if (currentFifthWinRate > myMaxWinRate || poTragicNumber <= 0) {
                    // 현재 5위 팀 승률보다 최대 가능 승률이 낮거나 트래직넘버가 0 이하면 탈락
                    poStatus = '<span style="color: #c0392b;">탈락</span>';
                } else if (poMagicNumber === 0) {
                    // 매직넘버가 0이면 진출 확정
                    poStatus = '<span style="color: #2ecc71;">진출</span>';
                } else if (confirmedTeams >= 5 && poMagicNumber > 0) {
                    // 5개팀이 이미 확정되고 본인은 확정이 아니면 탈락
                    poStatus = '<span style="color: #c0392b;">탈락</span>';
                } else {
                    // 그 외의 경우는 -
                    poStatus = '-';
                }
                
                // PO 트래직넘버 표시 (이미 위에서 계산됨)
                let poTragicDisplay = '';
                
                if (!tragicFifthPlace) {
                    poTragicDisplay = '0';
                } else {
                    if (poTragicNumber <= 0) {
                        poTragicDisplay = '<span style="color: #c0392b;">탈락</span>';
                    } else {
                        poTragicDisplay = poTragicNumber;
                    }
                }
                
                // 역대 기준 매직넘버 계산 (72승 기준)
                const playoffThreshold = 72;
                const historicMagic = Math.max(0, playoffThreshold - team.wins);
                let magicDisplay = '';
                
                if (historicMagic === 0) {
                    magicDisplay = '<span style="color: #2ecc71; font-weight: bold;">달성</span>';
                } else if (historicMagic > remainingGames) {
                    // 잔여경기를 모두 이겨도 72승 불가능
                    magicDisplay = '<span style="color: #c0392b; font-weight: bold;">탈락</span>';
                } else if (historicMagic <= 3) {
                    magicDisplay = `<span style="color: #2ecc71; font-weight: bold;">${historicMagic}</span>`;
                } else if (historicMagic <= 6) {
                    magicDisplay = `<span style="color: #27ae60;">${historicMagic}</span>`;
                } else if (historicMagic <= 10) {
                    magicDisplay = `<span style="color: #f39c12;">${historicMagic}</span>`;
                } else if (historicMagic <= 15) {
                    magicDisplay = `<span style="color: #e67e22;">${historicMagic}</span>`;
                } else if (historicMagic <= 25) {
                    magicDisplay = `<span style="color: #e74c3c;">${historicMagic}</span>`;
                } else {
                    magicDisplay = `<span style="color: #c0392b;">${historicMagic}</span>`;
                }
                
                // 진출상황을 72승 기준으로 명확하게 정의
                let displayStatus = '';
                let statusColor = '';
                
                // 72승 기준으로 진출/탈락 확정 여부 판단
                if (team.wins >= 72) {
                    // 이미 72승 달성
                    displayStatus = '진출 확정';
                    statusColor = '#2ecc71'; // 밝은 녹색
                } else if (maxPossibleWins < 72) {
                    // 전승해도 72승 불가능
                    displayStatus = '탈락 확정';
                    statusColor = '#95a5a6'; // 회색
                } else {
                    // 72승 가능하지만 미달성 - 필요 승률에 따라 구분
                    const neededWins = 72 - team.wins;
                    const actualRequiredRate = neededWins / remainingGames;
                    
                    if (actualRequiredRate > 0.9) {
                        displayStatus = '극히 어려움';
                        statusColor = '#c0392b'; // 진한 빨간색
                    } else if (actualRequiredRate > 0.75) {
                        displayStatus = '매우 어려움';
                        statusColor = '#e74c3c'; // 빨간색
                    } else if (actualRequiredRate > 0.6) {
                        displayStatus = '어려움';
                        statusColor = '#e67e22'; // 진한 주황색
                    } else if (actualRequiredRate > 0.45) {
                        displayStatus = '경합중';
                        statusColor = '#f39c12'; // 주황색
                    } else if (actualRequiredRate > 0.3) {
                        displayStatus = '유력';
                        statusColor = '#f1c40f'; // 노란색
                    } else {
                        displayStatus = '매우 유력';
                        statusColor = '#27ae60'; // 녹색
                    }
                }
                
                // 필요 승률 색상 (그라데이션 구분)
                let requiredWinPctColor = '#666';
                if (team.requiredWinRate > 0) {
                    if (team.requiredWinRate <= 0.3) {
                        requiredWinPctColor = '#2ecc71'; // 밝은 녹색 (매우 쉬움)
                    } else if (team.requiredWinRate <= 0.5) {
                        requiredWinPctColor = '#f39c12'; // 주황색 (보통)
                    } else if (team.requiredWinRate <= 0.7) {
                        requiredWinPctColor = '#e67e22'; // 진한 주황색 (어려움)
                    } else if (team.requiredWinRate <= 0.85) {
                        requiredWinPctColor = '#e74c3c'; // 빨간색 (매우 어려움)
                    } else {
                        requiredWinPctColor = '#c0392b'; // 진한 빨간색 (거의 불가능)
                    }
                }

                const row = document.createElement('tr');
                
                // 팀명에 로고 추가
                const teamNameWithLogo = Utils.getTeamNameWithLogo(team);
                
                // 역대 기준 트래직넘버 계산 (71승 기준)
                const tragicThreshold = 71;
                const historicTragicNumber = maxPossibleWins < tragicThreshold ? 0 : tragicThreshold - maxPossibleWins;
                let historicTragicDisplay = '';
                
                if (historicTragicNumber === 0) {
                    if (maxPossibleWins < tragicThreshold) {
                        historicTragicDisplay = '<span style="color: #c0392b; font-weight: bold;">탈락</span>';
                    } else {
                        historicTragicDisplay = '<span style="color: #2ecc71; font-weight: bold;">안전</span>';
                    }
                } else {
                    const absNumber = Math.abs(historicTragicNumber);
                    if (absNumber <= 3) {
                        historicTragicDisplay = `<span style="color: #c0392b; font-weight: bold;">-${absNumber}</span>`;
                    } else if (absNumber <= 6) {
                        historicTragicDisplay = `<span style="color: #e74c3c;">-${absNumber}</span>`;
                    } else if (absNumber <= 10) {
                        historicTragicDisplay = `<span style="color: #e67e22;">-${absNumber}</span>`;
                    } else if (absNumber <= 15) {
                        historicTragicDisplay = `<span style="color: #f39c12;">-${absNumber}</span>`;
                    } else if (absNumber <= 25) {
                        historicTragicDisplay = `<span style="color: #27ae60;">-${absNumber}</span>`;
                    } else {
                        historicTragicDisplay = `<span style="color: #2ecc71;">-${absNumber}</span>`;
                    }
                }
                
                // PO 진출을 위한 필요 승률 계산
                let poRequiredWinPct = '';
                if (currentFifthWinRate > myMaxWinRate || poTragicNumber <= 0) {
                    poRequiredWinPct = '<span style="color: #c0392b;">탈락</span>';
                } else if (poMagicNumber === 0) {
                    poRequiredWinPct = '<span style="color: #2ecc71;">확정</span>';
                } else if (remainingGames > 0) {
                    const poRequiredRate = poMagicNumber / remainingGames;
                    if (poRequiredRate > 1.0) {
                        poRequiredWinPct = '<span style="color: #c0392b;">자력불가</span>';
                    } else {
                        poRequiredWinPct = poRequiredRate.toFixed(3);
                    }
                } else {
                    poRequiredWinPct = '-';
                }
                
                // 역대 기준 필요 승률 계산 및 표시 (72승 기준)
                let requiredWinPct = '';
                const requiredRate = remainingGames > 0 ? historicMagic / remainingGames : 0;
                
                if (requiredRate === 0) {
                    requiredWinPct = '<span style="color: #2ecc71;">달성</span>';
                } else if (requiredRate > 1.0) {
                    requiredWinPct = '<span style="color: #c0392b;">탈락</span>';
                } else {
                    requiredWinPct = requiredRate.toFixed(3);
                }
                
                row.innerHTML = `
                    <td>${team.displayRank}위</td>
                    <td class="team-name">${teamNameWithLogo}</td>
                    <td>${team.wins}</td>
                    <td>${remainingGames}</td>
                    <td>${maxPossibleWins}</td>
                    <td class="po-magic" style="text-align: center;">${maxWinsMagicDisplay}</td>
                    <td class="po-tragic" style="text-align: center;">${poTragicDisplay}</td>
                    <td class="po-required-winpct" style="text-align: center;">${poRequiredWinPct}</td>
                    <td class="po-status" style="text-align: center;">${poStatus}</td>
                    <td class="historic-magic" style="text-align: center;">${magicDisplay}</td>
                    <td class="historic-tragic" style="text-align: center;">${historicTragicDisplay}</td>
                    <td class="required-rate">${requiredWinPct}</td>
                    <td class="status-text">${displayStatus}</td>
                `;
                tbody.appendChild(row);
            });
            
            
            } catch (error) {
                logger.error('❌ 플레이오프 진출 조건 렌더링 실패:', error);
            }
        }


        function determineCellData(team, rankPosition, championshipMagic, playoffMagic, tragicNumber, teamIndex) {
            // 나무위키 스타일 매직넘버 차트 색상 결정 로직
            const currentRank = teamIndex + 1; // 1-based rank
            
            // 1위 열: 우승 매직넘버
            if (rankPosition === 1) {
                if (championshipMagic > 0 && championshipMagic <= 50) {
                    // 확정 상황 체크
                    if (championshipMagic === 0 || (currentRank === 1 && championshipMagic <= 3)) {
                        return { display: '우승확정', cssClass: 'namu-clinched-blue' };
                    }
                    
                    // 나무위키 스타일 색상 결정
                    const cssClass = getColorByNamuWikiLogic(currentRank, rankPosition, championshipMagic);
                    return { display: championshipMagic.toString(), cssClass: cssClass };
                }
                return { display: '', cssClass: '' };
            }
            
            // 2-5위 열: 해당 순위 달성 매직넘버
            if (rankPosition >= 2 && rankPosition <= 5) {
                const targetMagic = calculateRankMagic(team, currentStandings, rankPosition - 1);
                if (targetMagic > 0 && targetMagic <= 50) {
                    // 확정 상황 체크
                    if (targetMagic === 0 || (currentRank <= rankPosition && targetMagic <= 3)) {
                        const confirmText = rankPosition === 2 ? '2위확정' : 
                                          rankPosition === 3 ? '3위확정' : 
                                          rankPosition === 4 ? '4위확정' : '5위확정';
                        return { display: confirmText, cssClass: 'namu-clinched-blue' };
                    }
                    
                    // 나무위키 스타일 색상 결정
                    const cssClass = getColorByNamuWikiLogic(currentRank, rankPosition, targetMagic);
                    return { display: targetMagic.toString(), cssClass: cssClass };
                }
            }
            
            // 6-9위 열: 해당 순위까지 떨어질 트래직넘버
            if (rankPosition >= 6 && rankPosition <= 9) {
                const dropMagic = calculateDropRankMagic(team, currentStandings, rankPosition - 1);
                if (dropMagic > 0 && dropMagic <= 50) {
                    // 탈락 확정 상황 체크
                    if (dropMagic === 0 || (currentRank >= rankPosition && dropMagic <= 3)) {
                        return { display: '탈락확정', cssClass: 'namu-eliminated' };
                    }
                    
                    // 나무위키 스타일 색상 결정
                    const cssClass = getColorByNamuWikiLogic(currentRank, rankPosition, dropMagic);
                    return { display: dropMagic.toString(), cssClass: cssClass };
                }
            }

            // 빈 셀 (최소화)
            return { display: '', cssClass: '' };
        }

        // 나무위키 스타일 색상 결정 로직
        function getColorByNamuWikiLogic(currentRank, targetRank, magicNumber) {
            // 40 이상이면 대부분 경합(노란색)
            if (magicNumber >= 40) {
                return 'namu-competitive';
            }
            
            // 현재 순위와 목표 순위 비교
            if (currentRank >= targetRank) {
                // 현재 순위 >= 목표 순위: 매직넘버 가능성 (초록색)
                // 단, 매직넘버가 너무 크면 경합(노란색)
                if (magicNumber >= 25) {
                    return 'namu-competitive';
                } else {
                    return 'namu-magic';
                }
            } else {
                // 현재 순위 < 목표 순위: 트래직넘버 가능성 (빨간색)
                // 단, 매직넘버가 크면 경합(노란색)으로 완화
                if (magicNumber >= 30) {
                    return 'namu-competitive';
                } else {
                    return 'namu-tragic';
                }
            }
        }

        // 특정 순위 도달을 위한 매직넘버 계산
        function calculateRankMagic(team, standings, targetRank) {
            const totalGames = 144;
            const remainingGames = totalGames - team.games;
            
            if (targetRank >= 0 && targetRank < standings.length) {
                const targetTeam = standings[targetRank];
                const targetMaxWins = targetTeam.wins + (totalGames - targetTeam.games);
                const magicNumber = Math.max(0, targetMaxWins - team.wins + 1);
                
                // 이미 목표 달성했거나 불가능한 경우 처리
                if (team.wins > targetMaxWins) return 0;
                if (team.wins + remainingGames < targetTeam.wins) return 999;
                
                return Math.min(magicNumber, remainingGames);
            }
            return 0;
        }

        // 현재 순위 유지를 위한 매직넘버 계산  
        function calculateMaintainRankMagic(team, standings, currentIndex) {
            const totalGames = 144;
            
            if (currentIndex + 1 < standings.length) {
                const nextTeam = standings[currentIndex + 1];
                const nextMaxWins = nextTeam.wins + (totalGames - nextTeam.games);
                return Math.max(0, nextMaxWins - team.wins + 1);
            }
            return 0;
        }

        // 특정 순위로 떨어질 위험을 나타내는 트래직넘버 계산
        function calculateDropRankMagic(team, standings, dropToRank) {
            const totalGames = 144;
            const remainingGames = totalGames - team.games;
            
            if (dropToRank >= 0 && dropToRank < standings.length) {
                const dropToTeam = standings[dropToRank];
                const dropToMaxWins = dropToTeam.wins + (totalGames - dropToTeam.games);
                
                // 우리가 모든 경기를 져도 해당 순위로 떨어지지 않으면
                if (team.wins > dropToMaxWins) return 999;
                
                // 해당 순위까지 떨어지려면 몇 경기를 더 져야 하는가
                const magicNumber = Math.max(0, dropToMaxWins - team.wins + 1);
                return Math.min(magicNumber, remainingGames);
            }
            return 0;
        }

        function calculateChampionshipMagic(team, rankings, index) {
            const totalGames = 144;
            const remainingGames = totalGames - team.games;
            
            if (index === 0) {
                // 현재 1위 - 우승 확정까지
                const secondPlace = rankings[1];
                if (!secondPlace) return 0;
                const secondMaxWins = secondPlace.wins + (totalGames - secondPlace.games);
                return Math.max(0, secondMaxWins - team.wins + 1);
            } else {
                // 1위가 아님 - 1위 추월까지
                const firstPlace = rankings[0];
                const maxPossibleWins = team.wins + remainingGames;
                if (maxPossibleWins <= firstPlace.wins) return 999;
                return Math.max(0, firstPlace.wins - team.wins + 1);
            }
        }

        function calculatePlayoffMagic(team, rankings, index) {
            const totalGames = 144;
            const playoffSpots = 5;
            const remainingGames = totalGames - team.games;
            
            if (index < playoffSpots) {
                // 현재 플레이오프 권 내
                const sixthPlace = rankings[playoffSpots];
                if (!sixthPlace) return 0;
                const sixthMaxWins = sixthPlace.wins + (totalGames - sixthPlace.games);
                return Math.max(0, sixthMaxWins - team.wins + 1);
            } else {
                // 플레이오프 권 밖
                const fifthPlace = rankings[playoffSpots - 1];
                const maxPossibleWins = team.wins + remainingGames;
                if (maxPossibleWins <= fifthPlace.wins) return 999;
                return Math.max(0, fifthPlace.wins - team.wins + 1);
            }
        }

        function calculateTragicNumber(team, rankings, index) {
            const totalGames = 144;
            const remainingGames = totalGames - team.games;
            const playoffSpots = 5;
            
            if (index < playoffSpots) {
                // 플레이오프 권 내 - 탈락까지
                const sixthPlace = rankings[playoffSpots];
                if (!sixthPlace) return 999;
                const minPossibleWins = team.wins;
                const sixthMinWins = sixthPlace.wins;
                if (minPossibleWins > sixthMinWins) return 999;
                return Math.max(0, remainingGames - (team.wins - sixthPlace.wins) + 1);
            } else {
                // 플레이오프 권 밖
                const baselineWins = 71; // 플레이오프 진출 기준선
                const maxPossibleWins = team.wins + remainingGames;
                if (maxPossibleWins >= baselineWins) {
                    return Math.max(0, maxPossibleWins - baselineWins + 1);
                }
                return 0; // 이미 탈락
            }
        }

        // 1위 탈환을 위한 트래직넘버 계산 (승률 기준, 승수 표시)
        function calculateFirstPlaceTragicNumber(team, rankings, index) {
            const totalGames = 144;
            const remainingGames = totalGames - team.games;
            
            // 1위팀 정보
            const firstPlace = rankings[0];
            if (!firstPlace || team.team === firstPlace.team) {
                return 0; // 이미 1위이거나 1위팀 정보가 없음
            }
            
            // 현재 팀의 최대 가능 승률 계산
            const teamMaxPossibleWins = team.wins + remainingGames;
            const teamMaxPossibleWinRate = teamMaxPossibleWins / (teamMaxPossibleWins + team.losses);
            
            // 1위팀 잔여 경기 계산
            const firstRemainingGames = totalGames - firstPlace.games;
            
            // 1위팀의 최저 가능 승률과 현재 팀의 최대 승률 비교
            const firstMinWins = firstPlace.wins; // 1위팀이 전패할 때의 승수
            const firstMinWinRate = firstMinWins / (firstMinWins + firstPlace.losses + firstRemainingGames);
            
            // 현재 팀이 전승해도 1위팀이 전패했을 때의 승률을 못 넘으면 1위 탈환 불가능
            if (teamMaxPossibleWinRate <= firstMinWinRate) {
                return 999; // 1위 탈환 불가능
            }
            
            // 1위팀이 몇 승을 더 해야 현재 팀의 최대 승률을 넘는지 계산
            
            for (let additionalWins = 0; additionalWins <= firstRemainingGames; additionalWins++) {
                const firstFinalWins = firstPlace.wins + additionalWins;
                const firstFinalLosses = firstPlace.losses + (firstRemainingGames - additionalWins);
                const firstFinalWinRate = firstFinalWins / (firstFinalWins + firstFinalLosses);
                
                // 1위팀의 최종 승률이 현재 팀의 최대 승률을 넘는지 확인
                if (firstFinalWinRate > teamMaxPossibleWinRate) {
                    return additionalWins; // 1위팀이 이만큼 승리하면 현재 팀이 1위 탈환 불가
                }
            }
            
            // 1위팀이 전패해도 현재 팀의 최대 승률을 넘지 못함 (1위 탈환 가능)
            return 0;
        }

        function determineTeamStatus(team, championshipMagic, playoffMagic, tragicNumber, index) {
            // 우승 확정
            if (championshipMagic === 0 || (index === 0 && championshipMagic <= 3)) {
                return {
                    label: '우승확정',
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff'
                };
            }
            
            // 플레이오프 확정
            if (playoffMagic === 0 || playoffMagic <= 3) {
                return {
                    label: 'PO확정',
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff'
                };
            }
            
            // 매직넘버 (유력)
            if (playoffMagic <= 10) {
                return {
                    label: 'PO유력',
                    backgroundColor: '#16a34a',
                    textColor: '#ffffff'
                };
            }
            
            // 경합
            if (playoffMagic <= 20 && tragicNumber > 10) {
                return {
                    label: '경합',
                    backgroundColor: '#eab308',
                    textColor: '#000000'
                };
            }
            
            // 탈락 위험
            if (tragicNumber <= 5) {
                return {
                    label: '탈락위험',
                    backgroundColor: '#dc2626',
                    textColor: '#ffffff'
                };
            }
            
            // 탈락
            if (tragicNumber === 0) {
                return {
                    label: '탈락',
                    backgroundColor: '#991b1b',
                    textColor: '#ffffff'
                };
            }
            
            // 기본 (경합)
            return {
                label: '경합',
                backgroundColor: '#eab308',
                textColor: '#000000'
            };
        }

        function renderHeadToHead() {
            const grid = document.getElementById('h2h-grid');
            grid.innerHTML = '';

            // 현재 순위대로 팀 배열 (동적)
            const teamOrder = currentStandings
                .sort((a, b) => a.rank - b.rank)
                .map(team => team.team);

            // Header row - 로고만 표시
            grid.appendChild(createGridCell('vs', 'vs-header'));
            teamOrder.forEach(team => {
                const teamData = kboTeams[team];
                const cell = createGridCell('', 'vs-header');
                cell.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center;" title="${team}">
                        ${teamData.logo}
                    </div>
                `;
                grid.appendChild(cell);
            });

            // Data rows
            teamOrder.forEach(homeTeam => {
                const teamData = kboTeams[homeTeam];
                const teamCell = createGridCell('', 'vs-team');
                teamCell.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center;" title="${homeTeam}">
                        ${teamData.logo}
                    </div>
                `;
                teamCell.style.color = teamData.color;
                grid.appendChild(teamCell);
                
                teamOrder.forEach(awayTeam => {
                    if (homeTeam === awayTeam) {
                        const cell = createGridCell('', 'vs-record');
                        cell.innerHTML = '<div style="color: #666;">■</div>';
                        cell.style.background = 'white';
                        grid.appendChild(cell);
                    } else {
                        const record = headToHeadData[homeTeam][awayTeam];
                        
                        // 새로운 JSON 형식 지원 (전체 객체) 및 기존 문자열 형식 호환
                        let wins, losses, draws, homeWins, homeLosses, homeDraws, awayWins, awayLosses, awayDraws;
                        
                        if (typeof record === 'string') {
                            // 기존 문자열 형식 지원 (백업용)
                            [wins, losses, draws] = record.split('-').map(Number);
                            // 추정치 사용 (기존 로직)
                            homeWins = Math.ceil(wins * 0.55);
                            homeLosses = Math.floor(losses * 0.45);
                            homeDraws = Math.floor(draws * 0.5);
                            awayWins = wins - homeWins;
                            awayLosses = losses - homeLosses;
                            awayDraws = draws - homeDraws;
                        } else {
                            // 새로운 객체 형식 - 실제 데이터 사용
                            wins = record.wins || 0;
                            losses = record.losses || 0;
                            draws = record.draws || 0;
                            homeWins = record.homeWins || 0;
                            homeLosses = record.homeLosses || 0;
                            homeDraws = record.homeDraws || 0;
                            awayWins = record.awayWins || 0;
                            awayLosses = record.awayLosses || 0;
                            awayDraws = record.awayDraws || 0;
                        }
                        
                        const totalGames = wins + losses + draws;
                        const winPct = totalGames > 0 ? (wins / (wins + losses)) : 0.5; // 무승부 제외한 승률
                        const winPctDisplay = totalGames > 0 ? winPct.toFixed(3) : '-';
                        
                        // 승률 강도에 따른 그라데이션 색상
                        let backgroundColor;
                        let textColor = '#333'; // 모든 셀 통일된 텍스트 색상
                        
                        if (winPct === 0.5) {
                            // 정확히 50% 동률인 경우만 - 노란색 배경
                            backgroundColor = 'rgba(255, 193, 7, 0.3)';
                        } else if (winPct > 0.5) {
                            // 50% 이상 - 승률이 높을수록 진한 초록색
                            const intensity = (winPct - 0.5) / 0.5; // 0.5-1.0을 0-1로 변환
                            const opacity = 0.15 + (intensity * 0.75); // 0.15-0.9 범위로 확장
                            backgroundColor = `rgba(22, 163, 74, ${opacity})`; // 더 진한 초록색 사용
                        } else {
                            // 50% 미만 - 패율이 높을수록 진한 빨간색
                            const intensity = (0.5 - winPct) / 0.5; // 0-0.5를 1-0으로 변환
                            const opacity = 0.15 + (intensity * 0.75); // 0.15-0.9 범위로 확장
                            backgroundColor = `rgba(220, 38, 38, ${opacity})`; // 더 진한 빨간색 사용
                        }
                        
                        // 실제 홈/원정 전적 사용
                        const homeRecord = `${homeWins}-${homeLosses}-${homeDraws}`;
                        const awayRecord = `${awayWins}-${awayLosses}-${awayDraws}`;
                        
                        const homeWinRate = homeWins + homeLosses > 0 ? (homeWins / (homeWins + homeLosses)).toFixed(3) : '-';
                        const awayWinRate = awayWins + awayLosses > 0 ? (awayWins / (awayWins + awayLosses)).toFixed(3) : '-';

                        // 전체 전적 문자열 생성
                        const totalRecord = `${wins}-${losses}-${draws}`;

                        const cell = createGridCell('', 'vs-record');
                        cell.innerHTML = `
                            <div style="line-height: 1.3; text-align: center;">
                                <div style=" margin-bottom: 2px;">${totalRecord} (${winPctDisplay})</div>
                                <div style="color: #555; margin-bottom: 1px; font-size: 0.7rem;">🏠 ${homeRecord} (${homeWinRate})</div>
                                <div style="color: #555; font-size: 0.7rem;">✈️ ${awayRecord} (${awayWinRate})</div>
                            </div>
                        `;
                        cell.style.background = backgroundColor;
                        cell.style.color = textColor;
                        grid.appendChild(cell);
                    }
                });
            });
        }

        function renderRemainingGames() {
            const grid = document.getElementById('remaining-grid');
            grid.innerHTML = '';

            // 현재 순위대로 팀 배열 (동적)
            const teamOrder = currentStandings
                .sort((a, b) => a.rank - b.rank)
                .map(team => team.team);

            // 팀간 남은 경기수 계산 함수
            function calculateRemainingGamesBetweenTeams(team1, team2) {
                if (team1 === team2) return '-';
                
                // 현재 상대전적에서 이미 치른 경기수 계산
                const record = headToHeadData[team1][team2];
                let wins, losses, draws;
                
                if (typeof record === 'string') {
                    [wins, losses, draws] = record.split('-').map(Number);
                } else {
                    wins = record.wins || 0;
                    losses = record.losses || 0;
                    draws = record.draws || 0;
                }
                
                const playedGames = wins + losses + draws;
                
                // KBO 정규시즌에서 각 팀은 다른 팀과 총 16경기씩 치름
                const totalGamesPerOpponent = 16;
                const remainingGames = Math.max(0, totalGamesPerOpponent - playedGames);
                
                return remainingGames;
            }

            // Header row
            grid.appendChild(createGridCell('vs', 'vs-header'));
            teamOrder.forEach(team => {
                const teamData = kboTeams[team];
                const cell = createGridCell('', 'vs-header');
                cell.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 3px; justify-content: center;">
                        ${teamData.logo}
                        <span style="color: ${teamData.color}; ">${team}</span>
                    </div>
                `;
                grid.appendChild(cell);
            });

            // Data rows
            teamOrder.forEach(homeTeam => {
                const teamData = kboTeams[homeTeam];
                const teamCell = createGridCell('', 'vs-team');
                teamCell.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center;" title="${homeTeam}">
                        ${teamData.logo}
                    </div>
                `;
                teamCell.style.color = teamData.color;
                grid.appendChild(teamCell);
                
                teamOrder.forEach(awayTeam => {
                    const remainingGames = calculateRemainingGamesBetweenTeams(homeTeam, awayTeam);
                    
                    let backgroundColor;
                    let textColor = '#333'; // 모든 셀 통일된 텍스트 색상
                    
                    if (remainingGames === '-') {
                        backgroundColor = 'white';
                        textColor = '#666';
                    } else if (remainingGames === 0) {
                        backgroundColor = 'rgba(156, 163, 175, 0.6)'; // 회색 - 경기 종료
                        textColor = '#666';
                    } else if (remainingGames <= 3) {
                        backgroundColor = 'rgba(249, 115, 22, 0.6)'; // 주황색 - 적은 경기 남음
                    } else if (remainingGames <= 6) {
                        backgroundColor = 'rgba(234, 179, 8, 0.6)'; // 노란색 - 보통
                    } else {
                        backgroundColor = 'rgba(34, 197, 94, 0.6)'; // 초록색 - 많은 경기 남음
                    }
                    
                    const cell = createGridCell(remainingGames === '-' ? '■' : remainingGames.toString(), 'vs-record');
                    cell.style.background = backgroundColor;
                    cell.style.color = textColor;
                        cell.style.textAlign = 'center';
                    grid.appendChild(cell);
                });
            });
        }

        function createGridCell(text, className) {
            const cell = document.createElement('div');
            cell.textContent = text;
            cell.className = className;
            return cell;
        }

        function adjustTooltipPositions() {
            const tooltips = document.querySelectorAll('.tooltip');
            tooltips.forEach(tooltip => {
                const tooltiptext = tooltip.querySelector('.tooltiptext');
                if (tooltiptext) {
                    const rect = tooltip.getBoundingClientRect();
                    const windowWidth = window.innerWidth;
                    
                    // 테이블 셀이나 카드 내부인지 확인
                    const parentCard = tooltip.closest('.card, .table-container');
                    let containerRight = windowWidth;
                    
                    if (parentCard) {
                        const cardRect = parentCard.getBoundingClientRect();
                        containerRight = cardRect.right;
                    }
                    
                    // 툴팁이 컨테이너 경계를 넘을 경우 왼쪽 정렬
                    if (rect.left + 150 > containerRight - 20) {
                        tooltiptext.classList.add('tooltip-left');
                    } else {
                        tooltiptext.classList.remove('tooltip-left');
                    }
                }
            });
        }

        async function initializeApp() {
            try {
                
                // 현재 날짜 표시
                const today = new Date().toLocaleDateString('ko-KR');
                
                // 1. 모든 데이터를 병렬로 로딩 (성능 최적화)
                const [kboData, headToHeadData] = await Promise.all([
                    loadKBOData(),
                    loadHeadToHeadData()
                ]);
                
                // 로드된 데이터 날짜 확인
                if (kboData?.dataDate) {
                }
                
                // 2. UI 업데이트
                try {
                    updateSummaryDashboard();
                } catch (error) {
                    logger.error('❌ 대시보드 업데이트 오류:', error);
                }
                
                try {
                    renderStandingsTable();
                } catch (error) {
                    logger.error('❌ 순위표 렌더링 오류:', error);
                }
                
                try {
                    renderChampionshipCondition();
                } catch (error) {
                    logger.error('❌ 우승 조건 렌더링 오류:', error);
                }
                
                try {
                    renderChaseAnalysis();
                } catch (error) {
                    logger.error('❌ 1위 탈환 가능성 렌더링 오류:', error);
                }
                
                
                try {
                    renderPlayoffCondition();
                } catch (error) {
                    logger.error('❌ 플레이오프 조건 렌더링 오류:', error);
                }
                
                
                try {
                    renderHeadToHead();
                } catch (error) {
                    logger.error('❌ 팀간 상대전적 렌더링 오류:', error);
                }
                
                try {
                    renderRemainingGames();
                } catch (error) {
                    logger.error('❌ 잔여 경기수 렌더링 오류:', error);
                }
                
                // 3. UI 구성요소 초기화
                try {
                    initializeTooltips();
                } catch (error) {
                    logger.error('❌ 툴팁 초기화 오류:', error);
                }
                
                try {
                    initDesktopToggle();
                } catch (error) {
                    logger.error('❌ 데스크톱 토글 초기화 오류:', error);
                }

                // 네비게이션 드래그 스크롤 초기화
                try {
                    initNavDragScroll();
                } catch (error) {
                    logger.error('❌ 네비게이션 드래그 스크롤 초기화 오류:', error);
                }
                
                // 주차별 분석 초기화
                try {
                    if (typeof weeklyAnalysisDisplay !== 'undefined') {
                        weeklyAnalysisDisplay.init();
                    }
                } catch (error) {
                    logger.error('❌ 주차별 분석 초기화 오류:', error);
                }
                
                // 4. 툴팁 위치 조정
                setTimeout(adjustTooltipPositions, 100);
                
                // 5. 창 크기 변경 시 툴팁 위치 재조정
                eventManager.add(window, 'resize', () => {
                    setTimeout(adjustTooltipPositions, 100);
                });
                
                // 5. 탑으로 가기 버튼 기능 초기화
                const scrollToTopButton = document.getElementById('scrollToTop');
                
                if (scrollToTopButton) {
                    const handleScroll = () => {
                        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                        
                        if (scrollPosition > 300) {
                            scrollToTopButton.classList.add('show');
                        } else {
                            scrollToTopButton.classList.remove('show');
                        }
                    };
                    
                    eventManager.add(window, 'scroll', handleScroll);
                    handleScroll();

                    scrollToTopButton.addEventListener('click', () => {
                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                        });
                    });
                }
                
                
            } catch (error) {
                handleError(error, '앱 초기화 실패');
            }
        }

        // 초기화 (비동기)
        // 초기화 플래그
        let isInitialized = false;
        
        async function runInitialization() {
            if (isInitialized) {
                return;
            }
            isInitialized = true;
            await initializeApp();
        }
        
        // DOMContentLoaded 이벤트
        if (document.readyState === 'loading') {
            eventManager.add(document, 'DOMContentLoaded', runInitialization);
        } else {
            // 이미 DOM이 로드된 경우
            runInitialization();
        }

        // 탑으로 가기 버튼 별도 초기화 (더 안전한 방법)
        setTimeout(() => {
            const btn = document.getElementById('scrollToTop');
            
            if (btn) {
                // 스크롤 이벤트
                const btnScrollHandler = function() {
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    if (scrollTop > 300) {
                        btn.style.opacity = '1';
                        btn.style.visibility = 'visible';
                        btn.style.transform = 'translateY(0)';
                    } else {
                        btn.style.opacity = '0';
                        btn.style.visibility = 'hidden';
                        btn.style.transform = 'translateY(20px)';
                    }
                };
                eventManager.add(window, 'scroll', btnScrollHandler);
                
                // 클릭 이벤트
                const btnClickHandler = function() {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };
                eventManager.add(btn, 'click', btnClickHandler);
                
            } else {
                logger.error('버튼을 찾을 수 없습니다!');
            }
        }, 200);

        // KBO 데이터 업데이트 체크 (하루 3번: 18시, 22시, 24시)
        function checkForDataUpdate() {
            const now = new Date();
            const currentTime = now.getHours() * 100 + now.getMinutes();
            
            // 업데이트 시간: 18:00, 22:00, 00:00 (± 5분 오차 허용)
            const updateTimes = [1800, 2200, 0]; // 18:00, 22:00, 00:00
            const tolerance = 5; // 5분 오차 허용
            
            for (let updateTime of updateTimes) {
                if (Math.abs(currentTime - updateTime) <= tolerance) {
                    // 실제 데이터 업데이트는 서버에서 JSON 파일을 업데이트하면 자동으로 반영됨
                    return true;
                }
            }
            return false;
        }
        
        // 1시간마다 업데이트 시간 체크
        setInterval(checkForDataUpdate, 3600000); // 1시간마다 체크

        // 툴팁 클릭 이벤트 초기화 함수
        function initializeTooltips() {
            const tooltips = document.querySelectorAll('.tooltip');
            
            tooltips.forEach(tooltip => {
                // 중복 이벤트 방지
                if (!tooltip.hasAttribute('data-tooltip-initialized')) {
                    tooltip.setAttribute('data-tooltip-initialized', 'true');
                    eventManager.add(tooltip, 'click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // 다른 모든 툴팁 비활성화
                        tooltips.forEach(t => t.classList.remove('active'));
                        
                        // 현재 툴팁 활성화
                        this.classList.add('active');
                    });
                }
            });
            
            // 다른 곳 클릭시 툴팁 닫기 (한 번만 등록)
            if (!document.documentElement.hasAttribute('data-tooltip-global-initialized')) {
                document.documentElement.setAttribute('data-tooltip-global-initialized', 'true');
                eventManager.add(document, 'click', function() {
                    tooltips.forEach(tooltip => tooltip.classList.remove('active'));
                });
            }
        }

        // PC 버전 보기 기능
        function initDesktopToggle() {
            try {
                const toggleBtn = document.getElementById('toggle-desktop-view');
                const mobileControls = document.getElementById('mobile-controls');
                
                // 요소가 없으면 함수 종료
                if (!toggleBtn && !mobileControls) {
                    return;
                }
                
                // 화면 크기 확인 함수
                function isMobileDevice() {
                    return window.innerWidth <= 768;
                }
                
                // 모바일 컨트롤 표시/숨김
                function updateMobileControlsVisibility() {
                    if (mobileControls) {
                        mobileControls.style.display = isMobileDevice() ? 'block' : 'none';
                    }
                }
            
            // 초기 설정
            updateMobileControlsVisibility();
            
            // 화면 크기 변경 시 업데이트
            eventManager.add(window, 'resize', updateMobileControlsVisibility);
            
            // 버튼 클릭 이벤트
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    const viewportMeta = document.querySelector('meta[name="viewport"]');
                    const isDesktopMode = toggleBtn.textContent.includes('모바일');
                    
                    if (isDesktopMode) {
                        // 모바일 버전으로 되돌리기
                        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
                        toggleBtn.innerHTML = '🖥️ PC 버전으로 보기';
                        toggleBtn.nextElementSibling.textContent = '더 원활한 사용이 가능합니다';
                    } else {
                        // PC 버전으로 전환
                        viewportMeta.setAttribute('content', 'width=1200, initial-scale=0.5, user-scalable=yes');
                        toggleBtn.innerHTML = '📱 모바일 버전으로 돌아가기';
                        toggleBtn.nextElementSibling.textContent = '원래 크기로 돌아갑니다';
                    }
                });
                
                // 버튼 hover 효과
                toggleBtn.addEventListener('mouseenter', function() {
                    this.style.background = 'rgba(255,255,255,0.2)';
                    this.style.borderColor = 'rgba(255,255,255,0.4)';
                });
                
                toggleBtn.addEventListener('mouseleave', function() {
                    this.style.background = 'rgba(255,255,255,0.1)';
                    this.style.borderColor = 'rgba(255,255,255,0.2)';
                });
            }
            } catch (error) {
                logger.error('❌ initDesktopToggle 오류:', error);
                // 이 함수의 오류는 치명적이지 않으므로 계속 진행
            }
        }
        
        // 초기화는 runInitialization에서 처리됨
        
        // 네비게이션 드래그 스크롤 기능
        function initNavDragScroll() {
            const navMenu = document.querySelector('.nav-menu');
            if (!navMenu) return;

            let isDown = false;
            let startX;
            let scrollLeft;
            let hasMoved = false;

            // 마우스 이벤트
            navMenu.addEventListener('mousedown', (e) => {
                isDown = true;
                hasMoved = false;
                navMenu.classList.add('dragging');
                startX = e.pageX - navMenu.offsetLeft;
                scrollLeft = navMenu.scrollLeft;
                e.preventDefault();
            });

            navMenu.addEventListener('mouseleave', () => {
                isDown = false;
                navMenu.classList.remove('dragging');
            });

            navMenu.addEventListener('mouseup', (e) => {
                isDown = false;
                navMenu.classList.remove('dragging');
                
                // 클릭인지 드래그인지 구분
                if (!hasMoved && e.target.tagName === 'A') {
                    // 실제 클릭이므로 링크 동작을 허용
                    return;
                }
                
                // 드래그였으므로 링크 클릭 방지
                if (hasMoved) {
                    e.preventDefault();
                }
            });

            navMenu.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                
                const x = e.pageX - navMenu.offsetLeft;
                const walk = (x - startX) * 1.5; // 스크롤 속도 조절
                
                if (Math.abs(walk) > 3) {
                    hasMoved = true;
                }
                
                navMenu.scrollLeft = scrollLeft - walk;
            });

            // 터치 이벤트 (모바일)
            let touchHasMoved = false;
            
            navMenu.addEventListener('touchstart', (e) => {
                isDown = true;
                touchHasMoved = false;
                navMenu.classList.add('dragging');
                startX = e.touches[0].pageX - navMenu.offsetLeft;
                scrollLeft = navMenu.scrollLeft;
            }, { passive: true });

            navMenu.addEventListener('touchmove', (e) => {
                if (!isDown) return;
                
                const x = e.touches[0].pageX - navMenu.offsetLeft;
                const walk = (x - startX) * 1.5;
                
                if (Math.abs(walk) > 5) {
                    touchHasMoved = true;
                    e.preventDefault(); // 스크롤 방지
                }
                
                navMenu.scrollLeft = scrollLeft - walk;
            });

            navMenu.addEventListener('touchend', (e) => {
                isDown = false;
                navMenu.classList.remove('dragging');
                
                // 터치 드래그였으면 클릭 방지
                if (touchHasMoved && e.target.tagName === 'A') {
                    e.preventDefault();
                }
            });

            // 링크 클릭 이벤트 처리
            navMenu.addEventListener('click', (e) => {
                if (hasMoved || touchHasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }

        // 네비게이션 함수들 (CSS scroll-margin-top 활용)
        function scrollToSection(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // CSS scroll-margin-top을 활용한 간단한 스크롤
            element.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            
            updateActiveNav(elementId);
            
            // 모바일 메뉴 닫기
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.remove('active');
        }
        
        
        function scrollToWeeklyAnalysis() {
            scrollToSection('weekly-analysis');
        }

        
        

        
        

        
        
        // 모바일 메뉴 토글
        function toggleMobileMenu() {
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.toggle('active');
        }
        
        
        // 모바일에서 메뉴 항목 클릭 시 메뉴 닫기
        document.addEventListener('click', function(e) {
            const navMenu = document.querySelector('.nav-menu');
            const navToggle = document.querySelector('.nav-toggle');
            
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                navMenu.classList.remove('active');
            }
        });

        // 단순한 데이터 그라데이션 적용
        function applyDataGradients() {
            // 매직넘버는 작을수록 좋음 (초록)
            document.querySelectorAll('.magic-number').forEach(cell => {
                const value = cell.textContent.trim();
                if (value.includes('확정')) {
                    cell.classList.add('data-excellent');
                } else if (!isNaN(value) && value !== '-') {
                    const num = parseInt(value);
                    if (num <= 5) cell.classList.add('data-good');
                    else if (num <= 15) cell.classList.add('data-warning');
                    else cell.classList.add('data-bad');
                }
            });
            
            // 트래직넘버는 클수록 안전함 (초록)
            document.querySelectorAll('.tragic-number').forEach(cell => {
                const value = cell.textContent.trim();
                if (value.includes('안전')) {
                    cell.classList.add('data-excellent');
                } else if (value.includes('탈락')) {
                    cell.classList.add('data-bad');
                } else if (value.startsWith('-')) {
                    const num = parseInt(value.substring(1));
                    if (num >= 20) cell.classList.add('data-good');
                    else if (num >= 10) cell.classList.add('data-warning');
                    else cell.classList.add('data-bad');
                }
            });
            
            // 승률은 높을수록 좋음
            document.querySelectorAll('#standings-table td:nth-child(8)').forEach(cell => {
                const value = parseFloat(cell.textContent.trim());
                if (!isNaN(value)) {
                    if (value >= 0.600) cell.classList.add('data-excellent');
                    else if (value >= 0.550) cell.classList.add('data-good');
                    else if (value >= 0.450) cell.classList.add('data-warning');
                    else cell.classList.add('data-bad');
                }
            });
            
            // 진출상황은 상태에 따라 색상 구분
            document.querySelectorAll('.status-text').forEach(cell => {
                const value = cell.textContent.trim();
                if (value.includes('확정') || value.includes('진출') || value === '가능') {
                    cell.classList.add('data-excellent');
                } else if (value.includes('유력') || value.includes('매우 유력')) {
                    cell.classList.add('data-good');
                } else if (value.includes('경합') || value.includes('어려움')) {
                    cell.classList.add('data-warning');
                } else if (value.includes('탈락') || value.includes('불가능') || value.includes('매우 어려움') || value.includes('극히 어려움')) {
                    cell.classList.add('data-bad');
                }
            });
            
            // 필요 승률은 낮을수록 좋음 (달성하기 쉬움)
            document.querySelectorAll('.required-rate').forEach(cell => {
                const value = cell.textContent.trim();
                if (value === '-' || value === '달성') {
                    cell.classList.add('data-excellent');
                } else {
                    const rate = parseFloat(value);
                    if (!isNaN(rate)) {
                        if (rate <= 0.300) cell.classList.add('data-excellent');  // 30% 이하: 매우 쉬움
                        else if (rate <= 0.500) cell.classList.add('data-good');  // 50% 이하: 쉬움
                        else if (rate <= 0.700) cell.classList.add('data-warning'); // 70% 이하: 어려움
                        else cell.classList.add('data-bad');  // 70% 초과: 매우 어려움
                    }
                }
            });
        }

        // 데이터 렌더링 후 그라데이션 적용
        function applyGradientsAfterRender() {
            setTimeout(applyDataGradients, 500);
        }
        
        // 페이지 로드 완료 후 그라데이션 적용
        window.addEventListener('load', applyGradientsAfterRender);

        // ===========================================
        // 네비게이션 관련 함수들
        // ===========================================

        // 부드러운 스크롤 함수
        function smoothScrollTo(targetId) {
            const target = document.getElementById(targetId);
            if (target) {
                const targetPosition = target.offsetTop - 80; // 네비게이션 높이 고려
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // active 상태 업데이트
                updateActiveNav(targetId);
            }
        }

        // 네비게이션 active 상태 업데이트
        function updateActiveNav(activeId) {
            const navItems = document.querySelectorAll('.nav-item');
            let activeNavItem = null;
            
            navItems.forEach(item => {
                item.classList.remove('active');
                const onclick = item.getAttribute('onclick');
                
                if (onclick && onclick.includes(`smoothScrollTo('${activeId}')`)) {
                    item.classList.add('active');
                    activeNavItem = item;
                }
            });
            
            // 모바일에서 활성화된 네비게이션 아이템이 화면에 보이도록 스크롤
            if (activeNavItem && window.innerWidth <= 768) {
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu) {
                    // 네비게이션 메뉴의 스크롤 위치 계산
                    const navMenuRect = navMenu.getBoundingClientRect();
                    const activeItemRect = activeNavItem.getBoundingClientRect();
                    
                    // 활성 아이템이 보이는 영역에 없다면 스크롤
                    if (activeItemRect.left < navMenuRect.left || activeItemRect.right > navMenuRect.right) {
                        activeNavItem.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'center'
                        });
                    }
                }
            }
        }


        // 모바일 메뉴 토글
        function toggleMobileMenu() {
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.toggle('show');
        }

        // 스크롤 위치에 따른 자동 active 상태 업데이트
        function updateActiveOnScroll() {
            const sections = ['championship', 'scenarios', 'chase', 'playoff', 'standings', 'rank-chart-section', 'vs-records', 'remaining'];
            const scrollPosition = window.scrollY + 100;

            for (let i = sections.length - 1; i >= 0; i--) {
                const section = document.getElementById(sections[i]);
                if (section && section.offsetTop <= scrollPosition) {
                    updateActiveNav(sections[i]);
                    break;
                }
            }
        }

        // 스크롤 이벤트 리스너
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(updateActiveOnScroll, 50);
        });

        // 페이지 로드시 초기 액티브 상태 설정
        document.addEventListener('DOMContentLoaded', () => {
            // 초기 액티브 상태를 championship으로 설정
            updateActiveNav('championship');
            
            // 스크롤 위치에 따른 초기 액티브 상태 업데이트
            setTimeout(() => {
                updateActiveOnScroll();
            }, 100);
            
            // Sticky 네비게이션 구현
            const navigation = document.querySelector('.navigation');
            const header = document.querySelector('.header');
            let navigationOffset = 0;
            
            function updateNavigationOffset() {
                if (navigation) {
                    navigationOffset = navigation.offsetTop;
                }
            }
            
            function handleScroll() {
                if (!navigation) return;
                
                const currentScroll = window.pageYOffset;
                
                if (currentScroll > navigationOffset) {
                    navigation.classList.add('sticky');
                    // sticky 상태일 때 body에 패딩 추가하여 점프 방지
                    document.body.style.paddingTop = navigation.offsetHeight + 'px';
                } else {
                    navigation.classList.remove('sticky');
                    document.body.style.paddingTop = '0px';
                }
            }
            
            // 초기 오프셋 계산
            updateNavigationOffset();
            
            // 스크롤 이벤트 리스너
            window.addEventListener('scroll', handleScroll, { passive: true });
            
            // 윈도우 리사이즈 시 오프셋 재계산
            window.addEventListener('resize', updateNavigationOffset);
        });

        // 시나리오 분석 관련 함수들
        function initializeScenarioAnalysis() {
            // 시나리오 분석 데이터 업데이트
            updateScenarioStats();
            
            // 버튼 이벤트 리스너 추가
            const matrixBtn = document.getElementById('showScenarioMatrix');
            const detailedBtn = document.getElementById('showDetailedScenarios');
            const hideBtn = document.getElementById('hideScenarioResults');
            
            if (matrixBtn) {
                matrixBtn.addEventListener('click', function() {
                    showScenarioMatrix();
                });
            }
            
            if (detailedBtn) {
                detailedBtn.addEventListener('click', function() {
                    showDetailedScenarios();
                });
            }
            
            if (hideBtn) {
                hideBtn.addEventListener('click', function() {
                    hideScenarioResults();
                });
            }
        }

        function updateScenarioStats() {
            try {
                if (!currentStandings || currentStandings.length === 0) {
                    return;
                }
                
                // 상위 9팀 분석 (10위는 제외)
                const topTeams = currentStandings.slice(0, 9);
                
                // 최대 시나리오 수 계산 (최대 잔여경기수 + 1)
                const maxRemainingGames = Math.max(...topTeams.map(team => team.remainingGames || 0));
                const maxScenarios = maxRemainingGames + 1;
                
                // 플레이오프 경쟁팀 계산 (현실적으로 5위 안에 들 가능성이 있는 팀)
                let playoffContenders = 0;
                const fifthPlaceWinRate = topTeams[4]?.winRate || 0.5;
                
                topTeams.forEach(team => {
                    // 전승 시 승률이 현재 5위 승률보다 높으면 경쟁 가능
                    const maxPossibleWins = team.wins + (team.remainingGames || 0);
                    const maxPossibleGames = maxPossibleWins + team.losses + (team.draws || 0);
                    const maxWinRate = maxPossibleWins / maxPossibleGames;
                    
                    if (maxWinRate >= fifthPlaceWinRate * 0.95) { // 95% 기준으로 여유
                        playoffContenders++;
                    }
                });
                
                // 우승 가능팀 계산
                let championshipContenders = 0;
                const firstPlaceWinRate = topTeams[0]?.winRate || 0.6;
                
                topTeams.forEach(team => {
                    const maxPossibleWins = team.wins + (team.remainingGames || 0);
                    const maxPossibleGames = maxPossibleWins + team.losses + (team.draws || 0);
                    const maxWinRate = maxPossibleWins / maxPossibleGames;
                    
                    if (maxWinRate >= firstPlaceWinRate * 0.92) { // 92% 기준으로 여유
                        championshipContenders++;
                    }
                });
                
                // UI 업데이트
                updateElementText('max-scenarios', maxScenarios + '개');
                updateElementText('playoff-contenders', playoffContenders + '팀');
                updateElementText('championship-contenders', championshipContenders + '팀');
                
                // 시나리오 미리보기 업데이트
                updateScenarioPreview(topTeams);
                
            } catch (error) {
                logger.error('시나리오 통계 업데이트 중 오류:', error);
            }
        }

        function updateScenarioPreview(topTeams) {
            try {
                // 1위 경쟁 분석
                const firstPlaceRace = analyzeFirstPlaceRace(topTeams);
                updateElementText('first-place-race', firstPlaceRace);
                
                // 플레이오프 경쟁 분석
                const playoffRace = analyzePlayoffRace(topTeams);
                updateElementText('playoff-race', playoffRace);
                
                // 최대 승률 변동 분석
                const maxWinRateChange = analyzeMaxWinRateChange(topTeams);
                updateElementText('max-winrate-change', maxWinRateChange);
                
                // 최대 순위 변동 분석
                const maxRankChange = analyzeMaxRankChange(topTeams);
                updateElementText('max-rank-change', maxRankChange);
                
            } catch (error) {
                logger.error('시나리오 미리보기 업데이트 중 오류:', error);
            }
        }

        function analyzeFirstPlaceRace(topTeams) {
            if (topTeams.length === 0) return '데이터 없음';
            
            const firstPlace = topTeams[0];
            let contenders = [];
            
            topTeams.forEach(team => {
                const maxPossibleWins = team.wins + (team.remainingGames || 0);
                const maxPossibleGames = maxPossibleWins + team.losses + (team.draws || 0);
                const maxWinRate = maxPossibleWins / maxPossibleGames;
                
                // 1위팀의 최저 가능 승률
                const firstPlaceMinWins = firstPlace.wins;
                const firstPlaceMinGames = firstPlaceMinWins + firstPlace.losses + (firstPlace.draws || 0) + (firstPlace.remainingGames || 0);
                const firstPlaceMinWinRate = firstPlaceMinWins / firstPlaceMinGames;
                
                if (team.team !== firstPlace.team && maxWinRate > firstPlaceMinWinRate) {
                    contenders.push(team.team);
                }
            });
            
            if (contenders.length === 0) {
                return `${firstPlace.team} 독주 체제`;
            } else {
                return `${contenders.slice(0, 3).join(', ')} 등 ${contenders.length}팀 경쟁`;
            }
        }

        function analyzePlayoffRace(topTeams) {
            if (topTeams.length < 5) return '데이터 부족';
            
            const fifthPlace = topTeams[4];
            let contenders = [];
            
            topTeams.forEach((team, index) => {
                if (index >= 4) { // 5위 이하 팀들
                    const maxPossibleWins = team.wins + (team.remainingGames || 0);
                    const maxPossibleGames = maxPossibleWins + team.losses + (team.draws || 0);
                    const maxWinRate = maxPossibleWins / maxPossibleGames;
                    
                    // 5위팀의 최저 가능 승률
                    const fifthPlaceMinWins = fifthPlace.wins;
                    const fifthPlaceMinGames = fifthPlaceMinWins + fifthPlace.losses + (fifthPlace.draws || 0) + (fifthPlace.remainingGames || 0);
                    const fifthPlaceMinWinRate = fifthPlaceMinWins / fifthPlaceMinGames;
                    
                    if (maxWinRate > fifthPlaceMinWinRate) {
                        contenders.push(team.team);
                    }
                }
            });
            
            return contenders.length > 0 ? 
                   `${contenders.slice(0, 3).join(', ')} 등 ${contenders.length}팀 추격` : 
                   '상위 5팀 고정';
        }

        function analyzeMaxWinRateChange(topTeams) {
            let maxIncrease = 0;
            let maxDecrease = 0;
            
            topTeams.forEach(team => {
                const currentWinRate = team.winRate;
                
                // 최대 가능 승률 (전승)
                const maxPossibleWins = team.wins + (team.remainingGames || 0);
                const maxPossibleGames = maxPossibleWins + team.losses + (team.draws || 0);
                const maxWinRate = maxPossibleWins / maxPossibleGames;
                
                // 최저 가능 승률 (전패)
                const minPossibleWins = team.wins;
                const minPossibleGames = minPossibleWins + team.losses + (team.draws || 0) + (team.remainingGames || 0);
                const minWinRate = minPossibleWins / minPossibleGames;
                
                const increase = (maxWinRate - currentWinRate) * 100;
                const decrease = (currentWinRate - minWinRate) * 100;
                
                maxIncrease = Math.max(maxIncrease, increase);
                maxDecrease = Math.max(maxDecrease, decrease);
            });
            
            return `+${maxIncrease.toFixed(1)}%p ~ -${maxDecrease.toFixed(1)}%p`;
        }

        function analyzeMaxRankChange(topTeams) {
            // 간단한 순위 변동 범위 계산
            const totalTeams = topTeams.length;
            
            // 현실적인 최대 순위 변동 (잔여경기 기준)
            const avgRemainingGames = topTeams.reduce((sum, team) => sum + (team.remainingGames || 0), 0) / totalTeams;
            
            if (avgRemainingGames >= 20) {
                return '최대 ±4위 변동';
            } else if (avgRemainingGames >= 10) {
                return '최대 ±3위 변동';
            } else if (avgRemainingGames >= 5) {
                return '최대 ±2위 변동';
            } else {
                return '최대 ±1위 변동';
            }
        }

        function updateElementText(elementId, text) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = text;
            }
        }

        // 시나리오 매트릭스 표시
        function showScenarioMatrix(autoScroll = true) {
            try {
                if (!currentStandings || currentStandings.length === 0) {
                    alert('순위 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
                    return;
                }
                
                const topTeams = currentStandings.slice(0, 10);
                const matrixHTML = generateScenarioMatrix(topTeams);
                
                const scenarioContent = document.getElementById('scenario-content');
                
                if (scenarioContent) {
                    scenarioContent.innerHTML = matrixHTML;
                    scenarioContent.style.display = 'block';
                    
                    // 사용자가 버튼을 클릭했을 때만 스크롤
                    if (autoScroll) {
                        scenarioContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } else {
                    logger.error('scenario-content 요소를 찾을 수 없습니다.');
                }
                
            } catch (error) {
                logger.error('매트릭스 시나리오 표시 중 오류:', error);
                alert('시나리오 분석 중 오류가 발생했습니다.');
            }
        }

        // 상세 시나리오 표시
        function showDetailedScenarios() {
            try {
                if (!currentStandings || currentStandings.length === 0) {
                    alert('순위 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
                    return;
                }
                
                const topTeams = currentStandings.slice(0, 5); // 상위 5팀만
                const detailedHTML = generateDetailedScenarios(topTeams);
                
                const scenarioContent = document.getElementById('scenario-content');
                const scenarioResults = document.getElementById('scenario-results');
                
                if (scenarioContent && scenarioResults) {
                    scenarioContent.innerHTML = detailedHTML;
                    scenarioResults.style.display = 'block';
                    
                    // 스크롤하여 결과 영역으로 이동
                    scenarioResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                
            } catch (error) {
                logger.error('상세 시나리오 표시 중 오류:', error);
                alert('시나리오 분석 중 오류가 발생했습니다.');
            }
        }

        // 시나리오 결과 숨기기
        function hideScenarioResults() {
            const scenarioResults = document.getElementById('scenario-results');
            if (scenarioResults) {
                scenarioResults.style.display = 'none';
            }
        }

        // 매트릭스 시나리오 HTML 생성
        function generateScenarioMatrix(topTeams, skipFiltering = false) {
            // 완전한 시나리오 기반 5위 진출 가능성 검사
            function canReachTop5(targetTeam, allTeams) {
                // 모든 팀의 가능한 최종 성적 범위 계산
                const teamScenarios = allTeams.map(team => {
                    const remaining = team.remainingGames || 0;
                    const scenarios = [];
                    
                    // 0승부터 전승까지 모든 경우
                    for (let wins = 0; wins <= remaining; wins++) {
                        const finalWins = team.wins + wins;
                        const finalLosses = team.losses + (remaining - wins);
                        const finalGames = finalWins + finalLosses + (team.draws || 0);
                        const finalWinRate = finalWins / (finalWins + finalLosses); // 무승부 제외한 승률
                        
                        scenarios.push({
                            team: team.team,
                            wins: finalWins,
                            losses: finalLosses,
                            games: finalGames,
                            winRate: finalWinRate,
                            winLossMargin: finalWins - finalLosses
                        });
                    }
                    return scenarios;
                });
                
                // 현실적으로 플레이오프 경쟁 가능한 팀들만 체크
                const competingTeams = teamScenarios.slice(0, Math.min(10, teamScenarios.length));
                
                // 더 많은 시나리오 샘플링 (더 정확한 검사)
                const sampleSize = Math.min(100, Math.max(20, competingTeams[0].length));
                const stepSize = Math.max(1, Math.floor(competingTeams[0].length / sampleSize));
                
                for (let i = 0; i < competingTeams[0].length; i += stepSize) {
                    // 각 팀의 i번째 시나리오 조합
                    const scenarioResults = competingTeams.map(scenarios => scenarios[Math.min(i, scenarios.length - 1)]);
                    
                    // 승률 기준으로 정렬
                    scenarioResults.sort((a, b) => {
                        if (Math.abs(a.winRate - b.winRate) < 0.001) {
                            return b.winLossMargin - a.winLossMargin; // 승률 같으면 승패차
                        }
                        return b.winRate - a.winRate;
                    });
                    
                    // 타겟 팀이 5위 안에 있는지 확인
                    const targetTeamRank = scenarioResults.findIndex(team => team.team === targetTeam.team) + 1;
                    if (targetTeamRank <= 5 && targetTeamRank > 0) {
                        return true; // 5위 안에 들 수 있는 시나리오 발견
                    }
                }
                
                // 극한 시나리오도 체크 (타겟팀 전승, 다른팀들 전패)
                const extremeScenario = competingTeams.map((scenarios, index) => {
                    if (scenarios[0].team === targetTeam.team) {
                        return scenarios[scenarios.length - 1]; // 타겟팀 전승 (최고 성적)
                    } else {
                        return scenarios[0]; // 다른 팀들 전패 (최저 성적)
                    }
                });
                
                // KBO 규정에 따른 정렬 (승률 → 승패차)
                extremeScenario.sort((a, b) => {
                    if (Math.abs(a.winRate - b.winRate) < 0.001) {
                        return b.winLossMargin - a.winLossMargin;
                    }
                    return b.winRate - a.winRate;
                });
                
                const extremeRank = extremeScenario.findIndex(team => team.team === targetTeam.team) + 1;
                
                // 디버깅: 극한 시나리오 결과 출력
                if (targetTeam.team === '두산') {
                    extremeScenario.forEach((team, index) => {
                        const marker = team.team === '두산' ? '👈' : '';
                    });
                }
                
                return extremeRank <= 5 && extremeRank > 0;
            }
            
            // 필터링: 새창에서는 모든 팀, 메인에서는 경쟁 가능한 팀만
            const playoffContenders = skipFiltering ? topTeams : topTeams.filter(team => {
                // 상위 8팀은 무조건 포함 (더 관대하게)
                const currentRank = topTeams.findIndex(t => t.team === team.team) + 1;
                if (currentRank <= 8) {
                    return true;
                }
                
                // 9위, 10위는 기본적인 수학적 가능성 체크
                const maxPossibleWins = team.wins + (team.remainingGames || 0);
                
                // 현재 5위팀의 현재 승수보다 최대가능승수가 높으면 포함
                const fifthPlaceWins = topTeams[4]?.wins || 0;
                if (maxPossibleWins > fifthPlaceWins) {
                    return true;
                }
                
                // 매우 관대한 기준: 50승 이상 가능하면 포함
                if (maxPossibleWins >= 50) {
                    return true;
                }
                
                return false;
            });
            
            // 실제 경쟁 가능한 팀만 선별 (새창: 전체 10팀, 메인: 최대 9팀)
            const eligibleTeams = skipFiltering ? playoffContenders : playoffContenders.slice(0, 9);
            
            // 두산 특별 체크
            const doosan = topTeams.find(t => t.team === '두산');
            if (doosan) {
            }
            
            // 팀이 너무 적으면 최소 상위 팀 보장 (새창: 10팀, 메인: 8팀)
            const minTeamCount = skipFiltering ? 10 : 8;
            const maxTeamCount = skipFiltering ? 10 : 9;
            if (eligibleTeams.length < minTeamCount) {
                const minTeams = topTeams.slice(0, Math.min(maxTeamCount, topTeams.length));
                eligibleTeams.splice(0, eligibleTeams.length, ...minTeams);
            }
            let html = `
                
                <div class="scenario-matrix-container" style="
                    overflow-x: auto; 
                    overflow-y: auto;
                    border-radius: 12px; 
                    border: 1px solid #e0e0e0; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-height: 80vh;
                    width: 100%;
                    position: relative;
                ">
                    <table class="scenario-matrix-table" style="
                        width: 100%; 
                        border-collapse: collapse; 
                        font-size: 0.75rem; 
                        background: white; 
                        min-width: ${window.innerWidth <= 768 ? '800px' : Math.max(1100, 6 * (75 + 95) + 70 + 140) + 'px'};
                    ">
                        <thead style="position: sticky; top: 0; z-index: 100;">
                            <!-- 1행: 순위 -->
                            <tr style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); color: white;">
                                <th style="
                                    min-width: 70px; 
                                    width: 70px;
                                    padding: 4px 6px; 
                                    text-align: center; 
                                    font-weight: 600; 
                                    border-right: 2px solid rgba(255,255,255,0.4); 
                                    position: sticky; 
                                    left: 0; 
                                    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); 
                                    z-index: 101; 
                                    font-size: 0.7rem;
                                ">순위</th>
            `;
            
            // 첫 번째 헤더 행 - 팀 정보 통합 (순위 + 팀명 + 현재성적)
            eligibleTeams.forEach((team, index) => {
                const isLast = index === eligibleTeams.length - 1;
                const teamData = kboTeams[team.team];
                const teamColor = teamData?.color || '#333';
                const columnWidth = index < 6 ? '160px' : '120px';
                
                const totalColumnWidth = index < 6 ? '170px' : '140px'; // 75+95 또는 60+80
                html += `<th colspan="2" style="
                    min-width: ${totalColumnWidth}; 
                    width: ${totalColumnWidth};
                    padding: 6px 4px 3px 4px; 
                    text-align: center; 
                    font-weight: 700; 
                    background: linear-gradient(135deg, rgba(233, 236, 239, 0.9) 0%, rgba(248, 249, 250, 0.9) 100%); 
                    color: ${teamColor}; 
                    ${index === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid rgba(255,255,255,0.5);' : '')} 
                    font-size: 0.8rem;
                    white-space: nowrap;
                    line-height: 1.2;
                ">
                    <div style="font-size: 0.85rem; font-weight: 800; color: ${teamColor};">${team.displayRank || team.rank}위 ${teamData?.logo || ''} ${teamData?.shortName || team.team}</div>
                </th>`;
            });
            
            // 2행: 성적
            html += `</tr><tr style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); color: white;">
                <th style="
                    min-width: 70px; 
                    width: 70px;
                    padding: 4px 6px; 
                    text-align: center; 
                    font-weight: 600; 
                    border-right: 2px solid rgba(255,255,255,0.4); 
                    position: sticky; 
                    left: 0; 
                    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); 
                    z-index: 101; 
                    font-size: 0.7rem;
                ">성적</th>`;
                
            eligibleTeams.forEach((team, index) => {
                const isLast = index === eligibleTeams.length - 1;
                const totalColumnWidth = '170px';
                html += `<th colspan="2" style="
                    min-width: ${totalColumnWidth}; 
                    width: ${totalColumnWidth};
                    padding: 4px; 
                    text-align: center; 
                    font-weight: 600; 
                    background: rgba(255,255,255,0.9); 
                    color: #333;
                    ${index === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid rgba(255,255,255,0.5);' : '')} 
                    font-size: 0.7rem;
                ">${team.wins}승 ${team.losses}패 ${team.draws || 0}무 (${team.winRate?.toFixed(3) || 'N/A'})</th>`;
            });
                
            // 3행: 잔여경기
            html += `</tr><tr style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); color: white;">
                <th style="
                    min-width: 70px; 
                    width: 70px;
                    padding: 4px 6px; 
                    text-align: center; 
                    font-weight: 600; 
                    border-right: 2px solid rgba(255,255,255,0.4); 
                    position: sticky; 
                    left: 0; 
                    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); 
                    z-index: 101; 
                    font-size: 0.7rem;
                ">잔여경기</th>`;
                
            eligibleTeams.forEach((team, index) => {
                const isLast = index === eligibleTeams.length - 1;
                const totalColumnWidth = '170px';
                html += `<th colspan="2" style="
                    min-width: ${totalColumnWidth}; 
                    width: ${totalColumnWidth};
                    padding: 4px; 
                    text-align: center; 
                    font-weight: 600; 
                    background: rgba(255,255,255,0.9); 
                    color: #333;
                    ${index === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid rgba(255,255,255,0.5);' : '')} 
                    font-size: 0.7rem;
                ">잔여: ${team.remainingGames}경기</th>`;
            });
                
            // 4행: 승률 + 컬럼 구분
            html += `</tr><tr style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); color: white;">
                <th style="
                    min-width: 70px; 
                    width: 70px;
                    padding: 4px 6px; 
                    text-align: center; 
                    font-weight: 600; 
                    border-right: 2px solid rgba(255,255,255,0.4); 
                    position: sticky; 
                    left: 0; 
                    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); 
                    z-index: 101; 
                    font-size: 0.7rem;
                ">승률</th>`;
            
            // 네 번째 헤더 행 - 컬럼 구분 (잔여경기 vs 최종성적)
            eligibleTeams.forEach((team, index) => {
                const isLast = index === eligibleTeams.length - 1;
                const cellWidth = '75px';
                const finalCellWidth = '95px';
                html += `
                    <th style="
                        width: ${cellWidth}; 
                        min-width: ${cellWidth}; 
                        font-size: 0.7rem; 
                        padding: 4px 2px; 
                        background: rgba(255,255,255,0.1); 
                        border-right: 1px solid rgba(255,255,255,0.3);
                        text-align: center;
                        font-weight: 600;
                    ">잔여 성적<br><span style="font-size: 0.6rem;">(승-패/승률)</span></th>
                    <th style="
                        width: ${finalCellWidth}; 
                        min-width: ${finalCellWidth}; 
                        font-size: 0.7rem; 
                        padding: 4px 2px; 
                        background: rgba(255,255,255,0.1); 
                        ${index === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid rgba(255,255,255,0.5);' : '')}
                        text-align: center;
                        font-weight: 600;
                    ">최종 성적<br><span style="font-size: 0.6rem;">(승-패-무/승률)</span></th>`;
            });
            
            html += `</tr></thead><tbody>`;
            
            // 모든 팀의 시나리오 수집 및 승률순 정렬
            const allScenarios = [];
            eligibleTeams.forEach(team => {
                for (let wins = team.remainingGames; wins >= 0; wins--) {
                    const losses = team.remainingGames - wins;
                    const finalWins = team.wins + wins;
                    const finalLosses = team.losses + losses;
                    const finalGames = finalWins + finalLosses + (team.draws || 0);
                    const finalWinRate = finalWins / (finalWins + finalLosses); // 무승부 제외한 승률
                    
                    allScenarios.push({
                        team: team.team,
                        wins,
                        losses,
                        finalWinRate,
                        remainingWinRate: wins / (wins + losses) || 0
                    });
                }
            });
            
            // 승률별 그룹화
            const winRateGroups = {};
            allScenarios.forEach(scenario => {
                const rateKey = scenario.finalWinRate.toFixed(3);
                if (!winRateGroups[rateKey]) {
                    winRateGroups[rateKey] = [];
                }
                winRateGroups[rateKey].push(scenario);
            });
            
            // 승률 높은순으로 정렬하여 표시
            const sortedRates = Object.keys(winRateGroups).sort((a, b) => parseFloat(b) - parseFloat(a));
            
            Object.keys(winRateGroups)
                .sort((a, b) => parseFloat(b) - parseFloat(a))
                .forEach(rateKey => {
                    const scenarios = winRateGroups[rateKey];
                    const winRate = parseFloat(rateKey);
                    
                    html += `<tr class="scenario-row">
                        <td style="font-size: 0.8rem; padding: 3px 2px; font-weight: 700; background: white; color: #2E7D32; border: 1px solid #dee2e6; text-align: center; position: sticky; left: 0; z-index: 5; width: 60px; box-shadow: 2px 0 4px rgba(0,0,0,0.1); line-height: 1.2;">
                            ${winRate.toFixed(3)}
                        </td>`;
                    
                    eligibleTeams.forEach((team, teamIndex) => {
                        const isLast = teamIndex === eligibleTeams.length - 1;
                        const teamScenario = scenarios.find(s => s.team === team.team);
                        
                        if (teamScenario) {
                            const remainingWinRate = teamScenario.losses === 0 && teamScenario.wins > 0 ? 1.00 :
                                                   teamScenario.wins === 0 && teamScenario.losses > 0 ? 0.00 :
                                                   teamScenario.wins / (teamScenario.wins + teamScenario.losses);
                            
                            const teamData = eligibleTeams.find(t => t.team === teamScenario.team);
                            const finalWins = teamData.wins + teamScenario.wins;
                            const finalLosses = teamData.losses + teamScenario.losses;
                            const finalDraws = teamData.draws || 0;
                            
                            const finalWinRateBg = getWinRateBackgroundColor(teamScenario.finalWinRate);
                            const finalWinRateTextColor = getWinRateTextColor(teamScenario.finalWinRate);
                            const remainingWinRateBg = getWinRateBackgroundColor(remainingWinRate);
                            const remainingWinRateTextColor = getWinRateTextColor(remainingWinRate);
                            
                            // 잔여경기 컬럼
                            const cellWidth = '75px';
                            html += `<td style="
                                padding: 4px 1px; 
                                text-align: center; 
                                border: 1px solid #dee2e6; 
                                width: ${cellWidth};
                                min-width: ${cellWidth};
                                line-height: 1.1;
                                background: ${remainingWinRateBg};
                                color: ${remainingWinRateTextColor};
                            ">
                                <div style="font-size: 0.8rem; font-weight: 600;">${teamScenario.wins}승 ${teamScenario.losses}패</div>
                                <div style="font-size: 0.7rem;">${remainingWinRate.toFixed(3)}</div>
                            </td>`;
                            
                            // 최종성적 컬럼 (더 넓게)
                            const finalCellWidth = '95px';
                            
                            // 현재 승률과 일치하는지 확인 (오차범위 0.001)
                            const isCurrentWinRate = Math.abs(teamScenario.finalWinRate - teamData.winRate) < 0.001;
                            const currentRateClass = isCurrentWinRate ? ' current-win-rate' : '';
                            
                            html += `<td class="final-record${currentRateClass}" style="
                                padding: 4px 2px; 
                                text-align: center; 
                                border: 1px solid #dee2e6; 
                                width: ${finalCellWidth};
                                min-width: ${finalCellWidth};
                                line-height: 1.1;
                                white-space: nowrap;
                                background: ${finalWinRateBg};
                                color: ${finalWinRateTextColor};
                                ${teamIndex === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid #dee2e6;' : '')}
                            ">
                                <div style="font-size: 0.8rem; font-weight: 600;">${finalWins}승 ${finalLosses}패 ${finalDraws}무</div>
                                <div style="font-size: 0.7rem;">${teamScenario.finalWinRate.toFixed(3)}</div>
                            </td>`;
                        } else {
                            html += `<td style="background: #f8f9fa; border: 1px solid #dee2e6;"></td><td style="background: #f8f9fa; border: 1px solid #dee2e6; ${teamIndex === 4 ? 'border-right: 4px solid #FF6B35;' : (!isLast ? 'border-right: 2px solid #dee2e6;' : '')}"></td>`;
                        }
                    });
                    
                    html += `</tr>`;
                });
            
            html += `</tbody></table></div>`;
            
            return html;
        }

        // 상세 시나리오 HTML 생성
        function generateDetailedScenarios(topTeams) {
            let html = `
                <div style="margin-bottom: 15px;">
                    <h5 style="color: #2E7D32; margin-bottom: 10px;">🏆 상위 5팀 상세 시나리오</h5>
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px;">
                        상위 5팀의 모든 잔여경기 승패 조합과 최종 승률을 표시합니다.
                    </p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
            `;
            
            topTeams.forEach((team, index) => {
                const colors = ['#e3f2fd', '#e8f5e8', '#fff3e0', '#f3e5f5', '#fce4ec'];
                const bgColor = colors[index] || '#f8f9fa';
                
                html += `
                    <div style="background: ${bgColor}; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px;">
                        <h6 style="margin: 0 0 10px 0; color: #333; text-align: center;">
                            ${team.rank}위 ${kboTeams[team.team]?.fullName || team.team}
                        </h6>
                        <div style="text-align: center; margin-bottom: 10px; font-size: 0.9rem; color: #666;">
                            현재: ${team.wins}승 ${team.losses}패 ${team.draws || 0}무 ${team.winRate.toFixed(3)}<br>
                            잔여: ${team.remainingGames}경기
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                            <thead>
                                <tr style="background: rgba(0,0,0,0.05);">
                                    <th style="padding: 4px; border: 1px solid #ccc;">승</th>
                                    <th style="padding: 4px; border: 1px solid #ccc;">패</th>
                                    <th style="padding: 4px; border: 1px solid #ccc;">최종승률</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                for (let wins = team.remainingGames; wins >= 0; wins--) {
                    const losses = team.remainingGames - wins;
                    const finalWins = team.wins + wins;
                    const finalLosses = team.losses + losses;
                    const finalGames = finalWins + finalLosses + (team.draws || 0);
                    const finalWinRate = finalWins / finalGames;
                    
                    const rowBgColor = getWinRateColor(finalWinRate);
                    
                    html += `
                        <tr style="background: ${rowBgColor};">
                            <td style="padding: 4px; border: 1px solid #ccc; text-align: center;">${wins}</td>
                            <td style="padding: 4px; border: 1px solid #ccc; text-align: center;">${losses}</td>
                            <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: 600;">
                                ${(finalWinRate * 100).toFixed(1)}%
                            </td>
                        </tr>
                    `;
                }
                
                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
            
            html += `</div>`;
            
            return html;
        }


        // 승률에 따른 배경색 반환
        function getWinRateColor(winRate) {
            if (winRate >= 0.700) return '#c8e6c9';      // 진한 녹색
            if (winRate >= 0.650) return '#dcedc8';      // 연한 녹색
            if (winRate >= 0.600) return '#f0f4c3';      // 연한 황녹색
            if (winRate >= 0.550) return '#fff9c4';      // 연한 노란색
            if (winRate >= 0.500) return '#fff3e0';      // 연한 주황색
            if (winRate >= 0.450) return '#ffccbc';      // 연한 주황색
            if (winRate >= 0.400) return '#ffcdd2';      // 연한 빨간색
            return '#ffebee';                             // 매우 연한 빨간색
        }

        // 0.5 기준 승률 색상 반환 함수
        function getWinRateBackgroundColor(winRate) {
            if (winRate > 0.5) {
                // 0.5 초과: 녹색 계열 (진하게)
                const intensity = Math.min((winRate - 0.5) * 2, 1); // 0.5-1.0을 0-1로 변환
                const greenValue = Math.floor(200 - intensity * 80); // 200에서 120으로
                return `linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)`;
            } else if (winRate < 0.5) {
                // 0.5 미만: 빨간색 계열
                const intensity = Math.min((0.5 - winRate) * 2, 1); // 0.5-0을 0-1로 변환
                return `linear-gradient(135deg, #f44336 0%, #e57373 100%)`;
            } else {
                // 정확히 0.5: 노란색 계열
                return `linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)`;
            }
        }

        // 0.5 기준 승률 텍스트 색상 반환 함수
        function getWinRateTextColor(winRate) {
            return 'white'; // 모든 배경이 진한 색이므로 흰색 텍스트
        }

        // 승률에 따른 CSS 클래스 반환
        function getWinRateClass(winRate) {
            if (winRate >= 0.700) return 'rate-excellent';
            if (winRate >= 0.650) return 'rate-very-good';  
            if (winRate >= 0.600) return 'rate-good';
            if (winRate >= 0.550) return 'rate-decent';
            if (winRate >= 0.500) return 'rate-average';
            if (winRate >= 0.450) return 'rate-below';
            if (winRate >= 0.400) return 'rate-poor';
            return 'rate-very-poor';
        }

        // 기존 초기화 함수에 시나리오 분석 초기화 추가
        document.addEventListener('DOMContentLoaded', function() {
            // 데이터 로딩 후 시나리오 분석 초기화
            setTimeout(() => {
                initializeScenarioAnalysis();
                // 페이지 로드 시 바로 매트릭스 표시
                setTimeout(() => {
                    if (currentStandings && currentStandings.length > 0) {
                        showScenarioMatrix(false); // 페이지 로드 시에는 스크롤하지 않음
                    } else {
                    }
                }, 500); // 추가 딜레이
            }, 3000); // 기존 데이터 로딩 후 실행 (3초로 늘림)
            
            // 플로팅 공유 버튼 초기화
            initializeFloatingShare();
            
            // 탑으로 가기 버튼 초기화 (딜레이 없이 바로 실행)
            initializeScrollToTop();
        });

        // 플로팅 공유 버튼 기능
        function initializeFloatingShare() {
            const shareToggle = document.getElementById('shareToggle');
            const shareOptions = document.getElementById('shareOptions');
            const shareButtons = document.querySelectorAll('.share-btn');

            if (!shareToggle || !shareOptions) return;

            // 공유 옵션 토글
            shareToggle.addEventListener('click', function() {
                shareOptions.classList.toggle('show');
            });

            // 외부 클릭 시 공유 옵션 닫기
            document.addEventListener('click', function(e) {
                if (!shareToggle.contains(e.target) && !shareOptions.contains(e.target)) {
                    shareOptions.classList.remove('show');
                }
            });

            // 각 공유 버튼 이벤트
            shareButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    const url = window.location.href;
                    const title = 'KBO 2025 우승 매직넘버 계산기';
                    const text = 'KBO 2025 매직넘버 계산기! 10개 구단의 플레이오프 진출 조건, 우승 가능성, 팀별 순위표와 상대전적을 실시간으로 확인하세요.';

                    switch(type) {
                        case 'copy':
                            copyToClipboard(url);
                            break;
                        case 'threads':
                            window.open(`https://threads.net/intent/post?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                            break;
                        case 'twitter':
                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                            break;
                        case 'facebook':
                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank');
                            break;
                    }
                    
                    // 공유 후 옵션 닫기
                    shareOptions.classList.remove('show');
                });
            });
        }

        // URL 복사 기능
        function copyToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    showCopySuccess();
                }).catch(() => {
                    fallbackCopyTextToClipboard(text);
                });
            } else {
                fallbackCopyTextToClipboard(text);
            }
        }

        // 구형 브라우저 대응 복사 기능
        function fallbackCopyTextToClipboard(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showCopySuccess();
            } catch (err) {
                logger.error('복사 실패:', err);
            }
            
            document.body.removeChild(textArea);
        }

        // 복사 성공 메시지
        function showCopySuccess() {
            const shareButtons = document.querySelectorAll('.share-btn');
            const copyButton = shareButtons[0];
            if (copyButton) {
                const originalText = copyButton.querySelector('span').textContent;
                copyButton.querySelector('span').textContent = '복사됨!';
                copyButton.style.color = '#4caf50';
                
                setTimeout(() => {
                    copyButton.querySelector('span').textContent = originalText;
                    copyButton.style.color = '';
                }, 2000);
            }
        }

        // 탑으로 가기 버튼 기능
        function initializeScrollToTop() {
            const scrollToTopButton = document.getElementById('scrollToTop');
            
            if (!scrollToTopButton) {
                logger.warn('탑으로 가기 버튼을 찾을 수 없습니다.');
                return;
            }
            
            // 스크롤 상태 확인 및 버튼 표시/숨김 함수
            function updateScrollButtonVisibility() {
                if (window.pageYOffset > 300) {
                    scrollToTopButton.classList.add('show');
                } else {
                    scrollToTopButton.classList.remove('show');
                }
            }
            
            // 페이지 로드 시 즉시 스크롤 상태 확인
            updateScrollButtonVisibility();
            
            // 스크롤 이벤트 리스너
            window.addEventListener('scroll', updateScrollButtonVisibility);
            
            // 버튼 클릭 이벤트
            scrollToTopButton.addEventListener('click', function() {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
            
            logger.log('탑으로 가기 버튼 초기화 완료');
        }

        // 전체 팀 경우의수 새창에서 보기 함수
        function showAllTeamsScenario() {
            if (!currentStandings || currentStandings.length === 0) {
                alert('데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
                return;
            }
            
            // 전체 10팀의 승률 기준 시나리오 매트릭스 생성 (필터링 없음)
            const allTeams = currentStandings.slice(0, 10);
            const fullScenarioMatrix = generateScenarioMatrix(allTeams, true);
            
            // 새 창 열기
            const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>KBO 전체 팀 경우의수 분석</title>
                        <style>
                            body { 
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                                margin: 20px; 
                                background: #f5f5f5; 
                                line-height: 1.6;
                            }
                            .header { 
                                background: white; 
                                padding: 20px; 
                                border-radius: 12px; 
                                margin-bottom: 20px; 
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            }
                            .header h1 { 
                                color: #2E7D32; 
                                margin: 0 0 10px 0; 
                                font-size: 28px;
                            }
                            .header p { 
                                color: #666; 
                                margin: 5px 0; 
                                font-size: 14px;
                            }
                            .magic-table-container { 
                                background: white; 
                                border-radius: 12px; 
                                padding: 20px; 
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                overflow-x: auto;
                            }
                            .magic-number-table {
                                width: 100%;
                                border-collapse: collapse;
                                margin: 0 auto;
                                font-size: 0.85rem;
                                background: white;
                            }
                            .magic-number-table th {
                                background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
                                color: white;
                                padding: 12px 8px;
                                text-align: center;
                                font-weight: 600;
                                border: 1px solid #ddd;
                                font-size: 0.8rem;
                            }
                            .magic-number-table td {
                                padding: 10px 8px;
                                text-align: center;
                                border: 1px solid #ddd;
                                font-size: 0.8rem;
                            }
                            .magic-number-table tr:nth-child(even) {
                                background-color: #f8f9fa;
                            }
                            .magic-number-table tr:hover {
                                background-color: #e8f5e9;
                            }
                            .team-name {
                                text-align: left !important;
                                font-weight: 600;
                            }
                            .team-logo {
                                width: 20px; 
                                height: 20px; 
                                object-fit: contain; 
                                margin-right: 5px;
                            }
                            .team-logo { width: 24px; height: 24px; object-fit: contain; }
                            
                            /* 현재 승률 플래싱 애니메이션 */
                            .current-win-rate {
                                animation: flashCurrentRate 2s ease-in-out infinite;
                                border: 2px solid #FF6B35 !important;
                                font-weight: bold !important;
                            }
                            
                            @keyframes flashCurrentRate {
                                0%, 100% { 
                                    background-color: #fff3cd !important;
                                    box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
                                }
                                50% { 
                                    background-color: #ffc107 !important;
                                    box-shadow: 0 0 20px rgba(255, 193, 7, 0.8);
                                }
                            }
                            
                            @media print {
                                body { margin: 10px; background: white; }
                                .header, .matrix-container { box-shadow: none; }
                                .current-win-rate { 
                                    animation: none !important;
                                    background-color: #fff3cd !important;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>🎲 KBO 2025 전체 팀 경우의수 분석</h1>
                            <p>📅 업데이트: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
                            <p>📊 KBO 리그 전체 10개 팀의 모든 승패 시나리오와 최종 순위 경우의수를 분석합니다.</p>
                            <p>🏆 상단 5개 팀: 플레이오프 진출 가능 | 하단 5개 팀: 일반 순위</p>
                        </div>
                        <div class="magic-table-container">
                            ${fullScenarioMatrix}
                        </div>
                    </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.');
            }
        }
        

        // 전역 함수로 등록
        window.showAllTeamsScenario = showAllTeamsScenario;

