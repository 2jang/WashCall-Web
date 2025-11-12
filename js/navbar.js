// js/navbar.js (파일 전체 덮어쓰기)
// 햄버거 버튼 클릭, 외부 클릭, 다크 모드 토글 로직 포함

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. 햄버거 메뉴 로직 ---
    const toggleBtn = document.getElementById('navbarToggle');
    const menu = document.getElementById('navbarMenu');
    
    if (toggleBtn && menu) {
        // 1-1. 햄버거 버튼 클릭 시
        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            menu.classList.toggle('active');
        });
    }

    // 1-2. 문서(페이지) 전체를 클릭했을 때
    document.addEventListener('click', (event) => {
        if (menu && menu.classList.contains('active')) {
            if (!menu.contains(event.target) && !toggleBtn.contains(event.target)) {
                menu.classList.remove('active');
            }
        }
    });

    // --- 2. ❗️ [신규] 다크 모드 로직 ---
    const themeToggle = document.getElementById('theme-checkbox');
    const storageKey = 'washcall-theme-preference';

    // 2-1. 저장된 설정 또는 OS 설정 확인
    const getPreferredTheme = () => {
        const savedTheme = localStorage.getItem(storageKey);
        if (savedTheme) {
            return savedTheme;
        }
        // OS 설정 확인
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    let currentTheme = getPreferredTheme();

    // 2-2. 현재 테마 적용
    const applyTheme = (theme) => {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        // 토글 버튼 상태도 동기화
        if (themeToggle) {
            themeToggle.checked = (theme === 'dark');
        }
    };

    // 2-3. 페이지 로드 시 즉시 테마 적용
    applyTheme(currentTheme);

    // 2-4. 토글 클릭 이벤트 리스너
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            currentTheme = themeToggle.checked ? 'dark' : 'light';
            applyTheme(currentTheme);
            // 선택 사항을 localStorage에 저장
            localStorage.setItem(storageKey, currentTheme);
        });
    }
});