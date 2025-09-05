"""
KBO 프로젝트 중앙화된 경로 관리 시스템 (Python용)
JavaScript PathManager와 동일한 경로 구조를 제공
"""

import os
import sys
from pathlib import Path
from typing import Optional, List


class PathManager:
    """중앙화된 경로 관리 시스템 - Python용"""
    
    def __init__(self):
        """PathManager 초기화 - 프로젝트 루트 자동 감지"""
        self.project_root = self._find_project_root()
        self.magic_number_root = self.project_root / 'magic-number'
        self.data_dir = self.magic_number_root / 'data'
        self.js_dir = self.magic_number_root / 'js'
        self.crawlers_dir = self.magic_number_root / 'crawlers'
        self.css_dir = self.magic_number_root / 'css'
        self.images_dir = self.magic_number_root / 'images'
        self.icons_dir = self.magic_number_root / 'icons'
        self.utils_dir = self.magic_number_root / 'utils'
        self.screenshots_dir = self.magic_number_root / 'screenshots'
        self.archive_dir = self.project_root / 'archive'
        self.docs_dir = self.project_root / 'docs'
        self.logs_dir = self.project_root / 'logs'
        self.config_dir = self.project_root / 'config'
        self.scripts_dir = self.project_root / 'scripts'
        
    def _find_project_root(self) -> Path:
        """package.json이 있는 프로젝트 루트 디렉토리를 찾습니다"""
        # 현재 파일의 경로에서 시작
        current_dir = Path(__file__).resolve().parent
        
        # 환경변수로 프로젝트 루트가 지정된 경우
        env_root = os.getenv('KBO_PROJECT_ROOT')
        if env_root:
            env_path = Path(env_root)
            if env_path.exists() and (env_path / 'package.json').exists():
                return env_path
        
        # 최대 10단계까지만 상위 디렉토리를 찾습니다 (무한루프 방지)
        for i in range(10):
            package_json_path = current_dir / 'package.json'
            if package_json_path.exists():
                return current_dir
            
            parent_dir = current_dir.parent
            if parent_dir == current_dir:
                # 루트 디렉토리에 도달한 경우
                break
            current_dir = parent_dir
        
        raise FileNotFoundError(
            '프로젝트 루트를 찾을 수 없습니다. package.json이 있는 디렉토리가 필요합니다.\n'
            '또는 KBO_PROJECT_ROOT 환경변수를 설정하세요.'
        )
    
    def get_data_file(self, filename: str) -> Path:
        """data 디렉토리의 파일 경로를 반환합니다"""
        return self.data_dir / filename
    
    def get_js_file(self, filename: str) -> Path:
        """js 디렉토리의 파일 경로를 반환합니다"""
        return self.js_dir / filename
    
    def get_crawler_file(self, filename: str) -> Path:
        """crawlers 디렉토리의 파일 경로를 반환합니다"""
        return self.crawlers_dir / filename
    
    
    def ensure_dir(self, dir_path: Path) -> Path:
        """지정된 디렉토리가 없으면 생성합니다"""
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path
    
    def exists(self, file_path: Path) -> bool:
        """파일이 존재하는지 확인합니다"""
        return file_path.exists()
    
    def find_existing_file(self, possible_paths: List[Path]) -> Optional[Path]:
        """여러 가능한 파일 경로 중 존재하는 첫 번째 파일을 찾습니다"""
        for file_path in possible_paths:
            if self.exists(file_path):
                return file_path
        return None
    
    def find_season_data_file(self) -> Optional[Path]:
        """현재 연도의 시즌 데이터 파일을 찾습니다"""
        from datetime import datetime
        current_year = datetime.now().year
        
        possible_files = [
            self.get_data_file(f'{current_year}-season-data-clean.txt'),
            self.get_data_file('2025-season-data-clean.txt'),
            self.get_data_file('season-data-clean.txt'),
            self.get_data_file('clean.txt')
        ]
        
        return self.find_existing_file(possible_files)
    
    def get_log_file(self, filename: str) -> Path:
        """로그 파일 경로를 생성합니다"""
        self.ensure_dir(self.logs_dir)
        return self.logs_dir / filename
    
    def print_paths(self):
        """현재 경로 설정을 출력합니다 (디버깅용)"""
        print('📁 KBO Project Paths (Python):')
        print(f'  Project Root: {self.project_root}')
        print(f'  Magic Number: {self.magic_number_root}')
        print(f'  Data:         {self.data_dir}')
        print(f'  JS:           {self.js_dir}')
        print(f'  Crawlers:     {self.crawlers_dir}')
        print(f'  Logs:         {self.logs_dir}')
    
    def validate_paths(self) -> bool:
        """필수 디렉토리들이 존재하는지 확인합니다"""
        required_paths = [
            self.project_root,
            self.magic_number_root,
            self.data_dir,
            self.js_dir,
            self.crawlers_dir
        ]
        
        missing = [p for p in required_paths if not self.exists(p)]
        
        if missing:
            missing_str = ', '.join(str(p) for p in missing)
            raise FileNotFoundError(f'필수 경로가 존재하지 않습니다: {missing_str}')
        
        return True
    
    def setup_python_path(self):
        """Python 모듈 import를 위한 경로 설정"""
        # 프로젝트 루트를 Python path에 추가
        if str(self.project_root) not in sys.path:
            sys.path.insert(0, str(self.project_root))
        
        # config 디렉토리를 Python path에 추가
        if str(self.config_dir) not in sys.path:
            sys.path.insert(0, str(self.config_dir))


# 싱글톤 인스턴스 생성
_path_manager_instance = None

def get_path_manager() -> PathManager:
    """PathManager 싱글톤 인스턴스를 반환합니다"""
    global _path_manager_instance
    if _path_manager_instance is None:
        _path_manager_instance = PathManager()
    return _path_manager_instance


# 편의를 위한 전역 인스턴스
paths = get_path_manager()

# 자주 사용하는 경로들을 직접 export
PROJECT_ROOT = paths.project_root
MAGIC_NUMBER_ROOT = paths.magic_number_root
DATA_DIR = paths.data_dir
CRAWLERS_DIR = paths.crawlers_dir


if __name__ == '__main__':
    # 테스트/디버깅용 실행
    paths.print_paths()
    paths.validate_paths()
    print('\n✅ Python PathManager 검증 완료!')