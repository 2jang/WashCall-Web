// js/navbar.js (이 코드만 남겨두세요)
// 햄버거 버튼 클릭 및 외부 클릭 이벤트를 처리합니다.

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('navbarToggle');
    const menu = document.getElementById('navbarMenu');
    
    if (toggleBtn && menu) {
        // 1. 햄버거 버튼 클릭 시
        toggleBtn.addEventListener('click', (event) => {
            // ❗️ [추가] 클릭 이벤트가 문서(document)까지 전파되는 것을 막습니다.
            event.stopPropagation();
            
            // 'active' 클래스를 추가/제거하여 메뉴를 토글합니다.
            menu.classList.toggle('active');
        });
    }

    // 2. ❗️ [신규] 문서(페이지) 전체를 클릭했을 때
    document.addEventListener('click', (event) => {
        
        // 메뉴가 열려 있는지(.active) 확인
        if (menu && menu.classList.contains('active')) {
            
            // 클릭된 곳이 메뉴(menu) 내부가 아니고,
            // 클릭된 곳이 햄버거 버튼(toggleBtn)도 아니라면
            if (!menu.contains(event.target) && !toggleBtn.contains(event.target)) {
                
                // 메뉴를 닫습니다.
                menu.classList.remove('active');
            }
        }
    });
});

// js/navbar.js (파일 맨 아래에 이어서 추가)

// --- ❗️ [신규] 다크 모드 로직 ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (기존 햄버거 메뉴 로직) ...

    // --- 다크 모드 로직 시작 ---
    const toggle = document.getElementById('theme-checkbox');
    const storageKey = 'theme-preference';

    // 1. 저장된 설정 또는 OS 설정 확인
    const getPreferredTheme = () => {
        const savedTheme = localStorage.getItem(storageKey);
        if (savedTheme) {
            return savedTheme;
        }
        // OS 설정 확인
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    let currentTheme = getPreferredTheme();

    // 2. 현재 테마 적용
    const applyTheme = (theme) => {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        // 토글 버튼 상태도 동기화
        if (toggle) {
            toggle.checked = (theme === 'dark');
        }
    };

    applyTheme(currentTheme);

    // 3. 토글 클릭 이벤트
    if (toggle) {
        toggle.addEventListener('change', () => {
            currentTheme = toggle.checked ? 'dark' : 'light';
            applyTheme(currentTheme);
            localStorage.setItem(storageKey, currentTheme);
        });
    }
    // --- 다크 모드 로직 끝 ---
});