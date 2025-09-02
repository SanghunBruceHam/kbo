#!/usr/bin/env python3
"""
KBO 데이터 크롤링 시스템 - 실제 작동 버전
다음 스포츠 실제 HTML 구조에 맞춘 정확한 파싱
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import json
import time
import re
from datetime import datetime
import os
import sys
from pathlib import Path

# PathManager 추가 - config 디렉토리를 Python path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'config'))
from paths import get_path_manager

class KBOWorkingCrawler:
    def __init__(self):
        self.base_url = 'https://sports.daum.net/schedule/kbo'
        
        # PathManager 사용
        self.paths = get_path_manager()
        self.paths.setup_python_path()  # Python 모듈 import 경로 설정
        
        print(f"🏟️ KBO 실제 작동 크롤러 초기화 완료 - 데이터 경로: {self.paths.data_dir}")
        
        # 필요한 디렉토리들 생성
        self.paths.ensure_dir(Path(self.paths.data_dir))
        self.paths.ensure_dir(Path(self.paths.history_dir))
        self.paths.ensure_dir(Path(self.paths.daily_history_dir))
        self.paths.ensure_dir(Path(self.paths.monthly_history_dir))
        
        self.team_mapping = {
            'KIA': 'KIA', 'KT': 'KT', 'LG': 'LG', 'NC': 'NC', 'SSG': 'SSG',
            '두산': '두산', '롯데': '롯데', '삼성': '삼성', '키움': '키움', '한화': '한화',
            'SK': 'SSG', '기아': 'KIA'
        }
        
        print(f"🏟️ KBO 실제 작동 크롤러 초기화 완료 - 데이터 경로: {self.paths.data_dir}")

    def setup_driver(self, headless=False):
        """Chrome WebDriver 설정"""
        print("🚀 Chrome WebDriver 설정 중...")
        
        options = Options()
        if headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        
        try:
            driver = webdriver.Chrome(options=options)
            print("✅ WebDriver 설정 완료")
            return driver
        except Exception as e:
            print(f"❌ WebDriver 설정 실패: {e}")
            return None

    def crawl_daum_kbo(self, year=2025, month=8):
        """다음 스포츠에서 KBO 데이터 크롤링"""
        print(f"\n📡 {year}년 {month}월 KBO 데이터 크롤링 시작...")
        
        # GitHub Actions 환경 감지
        import os
        is_github_actions = os.getenv('GITHUB_ACTIONS') == 'true'
        
        driver = self.setup_driver(headless=is_github_actions)
        if not driver:
            return []
        
        try:
            # URL 접속
            target_month = f"{year}{month:02d}"
            url = f"{self.base_url}?date={target_month}"
            print(f"🔗 접속: {url}")
            
            driver.get(url)
            time.sleep(5)
            
            # 테이블이 로드될 때까지 대기
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "scheduleList"))
                )
                print("✅ 스케줄 테이블 로드 완료")
            except:
                print("⚠️ 스케줄 테이블 로드 타임아웃")
            
            time.sleep(2)
            
            # 스크린샷
            screenshot_path = Path(self.paths.crawlers_dir) / 'kbo-working-screenshot.png'
            driver.save_screenshot(str(screenshot_path))
            print("📸 스크린샷 저장: kbo-working-screenshot.png")
            
            # HTML 파싱
            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            
            # 데이터 추출
            games = self.extract_games_from_table(soup)
            
            print(f"\n✅ 총 {len(games)}개 경기 데이터 추출 완료")
            
            return games
            
        except Exception as e:
            print(f"❌ 크롤링 오류: {e}")
            import traceback
            traceback.print_exc()
            return []
        finally:
            time.sleep(3)  # 확인용
            driver.quit()
            print("🔚 브라우저 종료")

    def extract_games_from_table(self, soup):
        """스케줄 테이블에서 경기 데이터 추출"""
        print("\n🎯 스케줄 테이블에서 데이터 추출 중...")
        
        games = []
        
        # scheduleList tbody 찾기
        schedule_tbody = soup.find('tbody', id='scheduleList')
        if not schedule_tbody:
            print("❌ scheduleList를 찾을 수 없음")
            return []
        
        # 모든 tr 행 찾기
        rows = schedule_tbody.find_all('tr')
        print(f"📊 {len(rows)}개 행 발견")
        
        current_date = None
        
        for row_idx, row in enumerate(rows):
            try:
                # 날짜 셀 확인 (rowspan이 있는 td_date)
                date_cell = row.find('td', class_='td_date')
                if date_cell:
                    date_span = date_cell.find('span', class_='num_date')
                    if date_span:
                        date_text = date_span.get_text(strip=True)
                        # "08.01" 형식을 "2025-08-01"로 변환
                        date_match = re.match(r'(\d{2})\.(\d{2})', date_text)
                        if date_match:
                            month = date_match.group(1)
                            day = date_match.group(2)
                            current_date = f"2025-{month}-{day}"
                            print(f"\n📅 날짜: {current_date}")
                
                # 경기 정보 추출
                team_cell = row.find('td', class_='td_team')
                if team_cell and current_date:
                    # 홈팀 정보
                    home_team_div = team_cell.find('div', class_='team_home')
                    away_team_div = team_cell.find('div', class_='team_away')
                    
                    if home_team_div and away_team_div:
                        # 팀명 추출
                        home_team_name = home_team_div.find('span', class_='txt_team')
                        away_team_name = away_team_div.find('span', class_='txt_team')
                        
                        # 점수 추출
                        home_score_elem = home_team_div.find('span', class_='num_score')
                        if not home_score_elem:
                            home_score_elem = home_team_div.find('em', class_='num_score')
                        
                        away_score_elem = away_team_div.find('span', class_='num_score')
                        if not away_score_elem:
                            away_score_elem = away_team_div.find('em', class_='num_score')
                        
                        if home_team_name and away_team_name and home_score_elem and away_score_elem:
                            home_team = home_team_name.get_text(strip=True)
                            away_team = away_team_name.get_text(strip=True)
                            
                            # 점수 텍스트에서 숫자만 추출
                            home_score_text = home_score_elem.get_text(strip=True)
                            away_score_text = away_score_elem.get_text(strip=True)
                            
                            # 숫자만 추출
                            home_score_match = re.search(r'\d+', home_score_text)
                            away_score_match = re.search(r'\d+', away_score_text)
                            
                            if home_score_match and away_score_match:
                                home_score = int(home_score_match.group())
                                away_score = int(away_score_match.group())
                                
                                # 경기 상태 확인
                                state_elem = team_cell.find('span', class_='state_game')
                                state = state_elem.get_text(strip=True) if state_elem else "종료"
                                
                                # 완료된 경기만 저장 - 엄격한 검증
                                completed_states = ["종료", "완료", "끝"]
                                is_completed = (
                                    state in completed_states or 
                                    (state == "종료" and home_score >= 0 and away_score >= 0 and 
                                     home_score <= 30 and away_score <= 30)  # 점수 범위 검증
                                )
                                
                                if is_completed:
                                    # KBO 웹사이트에서 team_home div가 실제로는 원정팀, team_away div가 홈팀을 의미함
                                    game = {
                                        'date': current_date,
                                        'away_team': self.normalize_team_name(home_team),  # team_home div = 원정팀
                                        'home_team': self.normalize_team_name(away_team),  # team_away div = 홈팀
                                        'away_score': home_score,  # team_home 점수 = 원정팀 점수
                                        'home_score': away_score,  # team_away 점수 = 홈팀 점수
                                        'state': state
                                    }
                                    
                                    games.append(game)
                                    print(f"  ✅ {self.normalize_team_name(home_team)} {home_score}:{away_score} {self.normalize_team_name(away_team)} [완료]")
                                else:
                                    print(f"  ⏳ {self.normalize_team_name(away_team)} vs {self.normalize_team_name(home_team)} [{state}] - 제외")
                
            except Exception as e:
                print(f"  ⚠️ 행 {row_idx} 파싱 오류: {e}")
                continue
        
        return games

    def normalize_team_name(self, team_name):
        """팀명 정규화"""
        return self.team_mapping.get(team_name.strip(), team_name.strip())

    def save_results(self, games, year, month):
        """결과 저장"""
        if not games:
            print("\n❌ 저장할 데이터가 없습니다.")
            return
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # JSON 저장 (주석 처리 - 백업 필요시 활성화)
        # json_file = f'kbo-{year}-{month:02d}-{timestamp}.json'
        # with open(json_file, 'w', encoding='utf-8') as f:
        #     json.dump(games, f, ensure_ascii=False, indent=2)
        # print(f"\n💾 JSON 저장: {json_file}")
        
        # PathManager와 일치하는 안전한 경로 사용
        main_clean_file = Path(self.paths.data_dir) / f'{year}-season-data-clean.txt'
        
        # 기존 경기 데이터 로드 (날짜별 매핑)
        existing_games = set()
        existing_by_date = {}
        if main_clean_file.exists():
            with open(main_clean_file, 'r', encoding='utf-8') as f:
                content = f.read()
                current_date = None
                
                for line in content.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    
                    # 날짜 라인인지 확인
                    if re.match(r'^\d{4}-\d{2}-\d{2}$', line):
                        current_date = line
                        if current_date not in existing_by_date:
                            existing_by_date[current_date] = set()
                    elif current_date:
                        # 경기 라인 저장 (날짜별 + 전체)
                        existing_games.add(line)
                        existing_by_date[current_date].add(line)
                        
        print(f"📚 기존 경기 데이터 로드: {len(existing_games)}개 경기")
        
        # 새로운 경기만 필터링 (날짜별 정확한 중복 체크)
        new_games = []
        for game in games:
            game_line = f"{game['away_team']} {game['away_score']}:{game['home_score']} {game['home_team']}(H)"
            game_date = game['date']
            
            # 1차: 해당 날짜에 같은 경기가 있는지 확인
            date_exists = game_date in existing_by_date and game_line in existing_by_date[game_date]
            
            # 2차: 전체에서 중복 확인 (동일 스코어 다른 날짜 허용)
            if not date_exists:
                new_games.append(game)
                print(f"  🆕 새 경기 추가: {game_date} {game_line}")
            else:
                print(f"  ♻️ 중복 경기 제외: {game_date} {game_line} (해당 날짜에 이미 존재)")
        
        if new_games:
            print(f"\n🆕 새로운 경기 {len(new_games)}개 발견")
            
            # 새로운 경기를 기존 파일에 append
            with open(main_clean_file, 'a', encoding='utf-8') as f:
                # 날짜별 그룹화
                date_groups = {}
                for game in new_games:
                    date = game['date']
                    if date not in date_groups:
                        date_groups[date] = []
                    
                    # clean.txt 형식: "원정팀 원정점수:홈점수 홈팀(H)" (뒤에 나온 팀이 홈팀)
                    line = f"{game['away_team']} {game['away_score']}:{game['home_score']} {game['home_team']}(H)"
                    date_groups[date].append(line)
                
                # 날짜순 정렬하여 출력 (빈 줄과 함께)
                for date in sorted(date_groups.keys()):
                    f.write(f"\n\n{date}\n")  # 두 번 \n으로 빈 줄 추가
                    for line in date_groups[date]:
                        f.write(f"{line}\n")
            
            print(f"💾 새 경기 {len(new_games)}개를 {main_clean_file}에 추가")
        else:
            print("ℹ️ 새로운 경기가 없습니다")
            
            # GitHub Actions 환경에서 새 경기가 없을 때 상세 분석
            if os.getenv('GITHUB_ACTIONS') == 'true' and len(games) > 0:
                print("\n🔍 GitHub Actions 자동화 상태 분석:")
                print(f"  📊 크롤링된 경기 수: {len(games)}개")
                print(f"  📚 기존 경기 수: {len(existing_games)}개")
                
                # 최근 크롤링된 날짜별 경기 수 표시
                date_counts = {}
                for game in games:
                    date = game['date']
                    date_counts[date] = date_counts.get(date, 0) + 1
                
                print("  📅 크롤링된 날짜별 경기:")
                for date in sorted(date_counts.keys())[-7:]:  # 최근 7일
                    existing_count = len(existing_by_date.get(date, set()))
                    crawled_count = date_counts[date]
                    status = "✅" if existing_count == crawled_count else "⚠️"
                    print(f"    {status} {date}: 크롤링 {crawled_count}개, 기존 {existing_count}개")
                
                print("\n💡 자동화가 제대로 작동하려면 새 경기가 감지되어야 합니다.")
        
        # 백업용 타임스탬프 파일 (주석 처리 - 백업 필요시 활성화)
        # backup_clean_file = f'kbo-{year}-{month:02d}-{timestamp}-clean.txt'
        # with open(backup_clean_file, 'w', encoding='utf-8') as f:
        #     # 전체 경기 저장 (백업용)
        #     date_groups = {}
        #     for game in games:
        #         date = game['date']
        #         if date not in date_groups:
        #             date_groups[date] = []
        #         
        #         line = f"{game['away_team']} {game['away_score']}:{game['home_score']} {game['home_team']}(H)"
        #         date_groups[date].append(line)
        #     
        #     for date in sorted(date_groups.keys()):
        #         f.write(f"{date}\n")
        #         for line in date_groups[date]:
        #             f.write(f"{line}\n")
        #         f.write("\n")
        # 
        # print(f"💾 백업 파일 저장: {backup_clean_file}")
        
        # 요약 출력
        print("\n📊 크롤링 결과 요약:")
        print(f"- 총 경기 수: {len(games)}개")
        print(f"- 기간: {min(g['date'] for g in games)} ~ {max(g['date'] for g in games)}")
        
        # 날짜별 경기 수
        date_counts = {}
        for game in games:
            date = game['date']
            date_counts[date] = date_counts.get(date, 0) + 1
        
        print("\n📅 날짜별 경기 수:")
        for date in sorted(date_counts.keys())[:10]:  # 처음 10일만
            print(f"  {date}: {date_counts[date]}개")
        
        if len(date_counts) > 10:
            print(f"  ... 외 {len(date_counts) - 10}일")

def main():
    """메인 실행"""
    print("=" * 60)
    print("🏟️ KBO 실제 작동 크롤링 시스템")
    print("📡 다음 스포츠 월별 스케줄 크롤링")
    print("=" * 60)
    
    crawler = KBOWorkingCrawler()
    
    # 2025년 8월-10월 크롤링
    all_games = []
    for month in [8, 9, 10]:
        print(f"\n🗓️ {month}월 크롤링 시작...")
        games = crawler.crawl_daum_kbo(2025, month)
        
        if games:
            crawler.save_results(games, 2025, month)
            all_games.extend(games)
            print(f"✅ {month}월 크롤링 완료! ({len(games)}개 경기)")
        else:
            print(f"⚠️ {month}월 크롤링 결과 없음")
    
    if all_games:
        print(f"\n🎯 전체 크롤링 완료! 총 {len(all_games)}개 경기")
    else:
        print("\n❌ 전체 크롤링 실패 - 데이터 없음")
    
    print("=" * 60)

if __name__ == "__main__":
    main()