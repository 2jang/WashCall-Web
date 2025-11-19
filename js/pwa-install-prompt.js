// js/pwa-install-prompt.js
// 통합 PWA 홈 화면 추가 안내 (iOS, Android, Desktop 모두 지원)

let deferredPrompt = null;

/**
 * 플랫폼 감지
 */
function detectPlatform() {
    const ua = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
        return 'ios';
    }
    
    if (/android/i.test(ua)) {
        return 'android';
    }
    
    return 'desktop';
}

/**
 * PWA 설치 여부 확인
 */
function isPWAInstalled() {
    // iOS: window.navigator.standalone
    // Android/Desktop: display-mode
    return window.navigator.standalone === true || 
           window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * beforeinstallprompt 이벤트 리스너 (Android/Desktop)
 */
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 beforeinstallprompt 이벤트 감지 (Android/Desktop)');
    
    // 기본 동작 방지
    e.preventDefault();
    
    // 나중에 사용하기 위해 저장
    deferredPrompt = e;
    
    // Android/Desktop용 프롬프트 표시
    checkAndShowPWAPrompt();
});

/**
 * PWA 설치 프롬프트 표시 여부 확인
 */
function checkAndShowPWAPrompt() {
    const platform = detectPlatform();
    
    // 이미 PWA로 설치되어 실행 중이면 종료
    if (isPWAInstalled()) {
        console.log('✅ PWA 모드에서 실행 중');
        return;
    }
    
    const PROMPT_STORAGE_KEY = 'washcall_pwa_prompt_shown';
    const PROMPT_DISMISS_COUNT_KEY = 'washcall_pwa_prompt_dismiss_count';
    
    // 사용자가 3번 이상 닫았으면 더 이상 표시 안 함
    const dismissCount = parseInt(localStorage.getItem(PROMPT_DISMISS_COUNT_KEY) || '0', 10);
    if (dismissCount >= 3) {
        console.log('PWA 프롬프트가 3번 이상 무시됨. 더 이상 표시 안 함');
        return;
    }
    
    // 이미 오늘 표시했으면 스킵 (24시간 후 재표시)
    const lastShown = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (lastShown) {
        const lastShownTime = new Date(lastShown);
        const now = new Date();
        const hoursSinceLastShown = (now - lastShownTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastShown < 24) {
            console.log(`PWA 프롬프트는 ${Math.floor(24 - hoursSinceLastShown)}시간 후 다시 표시됩니다.`);
            return;
        }
    }
    
    // Android는 beforeinstallprompt가 발생했을 때만, iOS는 항상 표시
    if (platform === 'android' && !deferredPrompt) {
        console.log('Android: beforeinstallprompt 대기 중...');
        return;
    }
    
    // 3초 후 표시
    setTimeout(() => {
        showPWAPrompt(platform);
        localStorage.setItem(PROMPT_STORAGE_KEY, new Date().toISOString());
    }, 3000);
}

/**
 * PWA 설치 프롬프트 표시
 */
function showPWAPrompt(platform) {
    // 이미 표시 중이면 종료
    if (document.getElementById('pwa-install-prompt')) {
        return;
    }
    
    let emoji, title, instructions;
    
    switch (platform) {
        case 'ios':
            emoji = '📱';
            title = 'WashCall을 홈 화면에 추가하세요!';
            instructions = `
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; opacity: 0.95;">
                    Safari 하단의 <strong>공유 버튼 📤</strong>을 눌러<br>
                    <strong>"홈 화면에 추가"</strong>를 선택하세요.
                </p>
                <p style="margin: 0 0 16px 0; font-size: 13px; opacity: 0.85; line-height: 1.4;">
                    <em>※ 푸시 알림은 홈 화면 앱에서만 동작합니다 (iOS 16.4+)</em>
                </p>
            `;
            break;
            
        case 'android':
            emoji = '🤖';
            title = 'WashCall 앱을 설치하세요!';
            instructions = `
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; opacity: 0.95;">
                    아래 <strong>"설치"</strong> 버튼을 눌러<br>
                    빠르게 접속하고 푸시 알림을 받아보세요!
                </p>
                <p style="margin: 0 0 16px 0; font-size: 13px; opacity: 0.85; line-height: 1.4;">
                    <em>※ 앱처럼 사용할 수 있고 용량도 적습니다</em>
                </p>
            `;
            break;
            
        default: // desktop
            emoji = '💻';
            title = 'WashCall을 설치하세요!';
            instructions = `
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; opacity: 0.95;">
                    아래 <strong>"설치"</strong> 버튼을 눌러<br>
                    데스크톱 앱처럼 사용해보세요!
                </p>
            `;
            break;
    }
    
    const promptHTML = `
        <div id="pwa-install-prompt" style="
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 16px 24px 16px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
            animation: slideUp 0.4s ease-out;
        ">
            <style>
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideDown {
                    from {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                }
                
                #pwa-install-prompt button {
                    transition: all 0.3s ease;
                }
                
                #pwa-install-prompt button:active {
                    transform: scale(0.95);
                }
            </style>
            
            <div style="max-width: 500px; margin: 0 auto;">
                <div style="font-size: 28px; margin-bottom: 8px;">${emoji}</div>
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; line-height: 1.4;">
                    ${title}
                </p>
                ${instructions}
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    ${platform === 'ios' ? `
                        <button id="pwa-prompt-close" style="
                            background: white;
                            color: #667eea;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-weight: bold;
                            font-size: 14px;
                            cursor: pointer;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        ">확인</button>
                    ` : `
                        <button id="pwa-prompt-install" style="
                            background: white;
                            color: #667eea;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-weight: bold;
                            font-size: 14px;
                            cursor: pointer;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        ">설치</button>
                        <button id="pwa-prompt-close" style="
                            background: rgba(255, 255, 255, 0.2);
                            color: white;
                            border: 1px solid rgba(255, 255, 255, 0.4);
                            padding: 12px 24px;
                            border-radius: 12px;
                            font-weight: normal;
                            font-size: 14px;
                            cursor: pointer;
                        ">나중에</button>
                    `}
                    <button id="pwa-prompt-never" style="
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.4);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-weight: normal;
                        font-size: 14px;
                        cursor: pointer;
                    ">다시 보지 않기</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', promptHTML);
    
    // 설치 버튼 (Android/Desktop만)
    const installButton = document.getElementById('pwa-prompt-install');
    if (installButton) {
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) {
                console.warn('설치 프롬프트를 사용할 수 없습니다.');
                dismissPWAPrompt(false);
                return;
            }
            
            // 네이티브 설치 프롬프트 표시
            deferredPrompt.prompt();
            
            // 사용자의 응답 대기
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`사용자 선택: ${outcome}`);
            
            if (outcome === 'accepted') {
                console.log('✅ PWA 설치 완료');
            } else {
                console.log('❌ PWA 설치 취소');
            }
            
            // 프롬프트 초기화
            deferredPrompt = null;
            dismissPWAPrompt(false);
        });
    }
    
    // 확인/나중에 버튼
    const closeButton = document.getElementById('pwa-prompt-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            dismissPWAPrompt(false);
        });
    }
    
    // 다시 보지 않기 버튼
    const neverButton = document.getElementById('pwa-prompt-never');
    if (neverButton) {
        neverButton.addEventListener('click', () => {
            dismissPWAPrompt(true);
        });
    }
}

/**
 * PWA 프롬프트 닫기
 */
function dismissPWAPrompt(neverShowAgain) {
    const prompt = document.getElementById('pwa-install-prompt');
    if (!prompt) return;
    
    // 애니메이션과 함께 닫기
    prompt.style.animation = 'slideDown 0.3s ease-in';
    prompt.style.animationFillMode = 'forwards';
    
    setTimeout(() => {
        prompt.remove();
    }, 300);
    
    if (neverShowAgain) {
        // 다시 보지 않기 선택 시 dismiss count를 3으로 설정
        localStorage.setItem('washcall_pwa_prompt_dismiss_count', '3');
        console.log('PWA 프롬프트 영구 숨김');
    } else {
        // 확인 버튼: dismiss count 증가
        const PROMPT_DISMISS_COUNT_KEY = 'washcall_pwa_prompt_dismiss_count';
        const currentCount = parseInt(localStorage.getItem(PROMPT_DISMISS_COUNT_KEY) || '0', 10);
        localStorage.setItem(PROMPT_DISMISS_COUNT_KEY, String(currentCount + 1));
        console.log(`PWA 프롬프트 닫힘 (${currentCount + 1}/3)`);
    }
}

/**
 * 앱 설치 성공 시 이벤트 리스너
 */
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA가 성공적으로 설치되었습니다!');
    deferredPrompt = null;
});

/**
 * 페이지 로드 시 자동 실행
 */
document.addEventListener('DOMContentLoaded', () => {
    // index.html에서만 실행
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        checkAndShowPWAPrompt();
    }
});

// 전역으로 노출 (디버깅용)
window.showPWAPromptManually = () => {
    localStorage.removeItem('washcall_pwa_prompt_shown');
    localStorage.removeItem('washcall_pwa_prompt_dismiss_count');
    const platform = detectPlatform();
    showPWAPrompt(platform);
};
