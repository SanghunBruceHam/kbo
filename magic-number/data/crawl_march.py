#!/usr/bin/env python3
"""
3월 경기 크롤링 테스트
"""
import sys
import os
from pathlib import Path

# 환경변수 설정하고 크롤러의 main 함수 직접 호출
os.environ['MANUAL_RUN'] = 'true'

# 크롤러 경로에서 직접 import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'crawlers'))

try:
    from kbo_python_working_crawler import KBOWorkingCrawler
    
    print("🔍 3월 누락 경기 확인...")
    
    crawler = KBOWorkingCrawler()
    
    # 3월만 크롤링
    march_games = crawler.crawl_daum_kbo(2025, 3)
    print(f"\n📊 3월 총 경기: {len(march_games)}개")
    
    # 정규시즌만 필터링
    regular_games = [g for g in march_games if g.get('division') == '정규']
    print(f"📊 3월 정규시즌: {len(regular_games)}개")
    
    # 날짜별 정규시즌 경기
    regular_dates = {}
    for game in regular_games:
        date = game['date']
        regular_dates[date] = regular_dates.get(date, 0) + 1
    
    print(f"\n📅 3월 정규시즌 날짜별:")
    for date in sorted(regular_dates.keys()):
        print(f"  {date}: {regular_dates[date]}개")
        
    # 실제 저장해서 비교
    if regular_games:
        print(f"\n💾 3월 정규시즌 경기를 저장...")
        crawler.save_results(regular_games, 2025, 3)

except ImportError as e:
    print(f"Import 오류: {e}")
except Exception as e:
    print(f"실행 오류: {e}")
    import traceback
    traceback.print_exc()