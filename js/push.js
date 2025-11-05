// js/push.js
// ❗️ ('알림 차단' 시 친절한 안내 가이드가 포함된 최종본)

// 1. Firebase 설정 (이전과 동일)
 const firebaseConfig = {
    apiKey: "AIzaSyAiL4dY0dkiYIsXdQDByULXZB2HJLxssvM",
    authDomain: "washcall-server.firebaseapp.com",
    projectId: "washcall-server",
    storageBucket: "washcall-server.firebasestorage.app",
    messagingSenderId: "695727341464",
    appId: "1:695727341464:web:56a51f41431c27c56fb5ed",
    measurementId: "G-SL6R08TWHP"
  };

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 마스터 버튼 DOM을 전역에서 참조
let masterPushButton; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    setupMasterPushButton();
  }
});

function setupMasterPushButton() {
  masterPushButton = document.getElementById('enable-push-button');
  if (!masterPushButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  // 2. 서비스 워커 등록 (필수)
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      masterPushButton.textContent = '알림 설정 실패';
    });

  // 3. 마스터 버튼 클릭 이벤트
  masterPushButton.onclick = onMasterToggleClick;

  // 4. 페이지 로드 시 및 2초 후 버튼 상태 업데이트
  updateMasterButtonText();
  setTimeout(updateMasterButtonText, 2000); 

  // 5. 개별 토글 변경 시 마스터 버튼 동기화
  document.body.addEventListener('change', event => {
      if (event.target.classList.contains('notify-me-toggle')) {
          setTimeout(updateMasterButtonText, 50);
      }
  });
}

/**
 * ❗️ [수정됨] 마스터 토글 버튼 클릭 시 실행되는 메인 로직
 */
async function onMasterToggleClick() {
    masterPushButton.disabled = true; // 중복 클릭 방지

    // 1. 현재 토글 상태 계산
    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    // 2. 켤지(true) 끌지(false) 결정
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);

    if (shouldTurnOn) {
        // --- [A] 전체 켜기 로직 ---
        masterPushButton.textContent = '권한 확인 중...';
        try {
            // 3. ❗️ 수정된 권한/토큰 함수 호출
            const tokenOrStatus = await requestPermissionAndGetToken();

            // 4. ❗️ [핵심 Q1 로직] 반환값에 따라 분기 처리
            if (tokenOrStatus === 'denied') {
                // ❗️ (A-1) 이미 차단된 경우
                alert("알림이 '차단' 상태입니다.\n\n알림을 받으려면, 주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                masterPushButton.textContent = '알림 거부됨';
                masterPushButton.disabled = false; // 다시 누를 수 있게 함
                return; // 함수 종료
            
            } else if (tokenOrStatus === null) {
                // ❗️ (A-2) 팝업을 띄웠으나 '차단' 또는 '무시'한 경우
                throw new Error('알림 권한이 거부되었습니다.');
            
            } else {
                // ❗️ (A-3) 성공: 토큰을 정상적으로 받음
                const token = tokenOrStatus;
                await api.registerPushToken(token);
                await toggleAllMachinesAPI(allToggles, true);
                alert('전체 알림이 켜졌습니다.');
            }

        } catch (error) {
            alert(`전체 켜기 실패: ${error.message}`);
        }
    } else {
        // --- [B] 전체 끄기 로직 (수정 없음) ---
        masterPushButton.textContent = '끄는 중...';
        try {
            await toggleAllMachinesAPI(allToggles, false);
            alert('전체 알림이 꺼졌습니다.');
        } catch (error) {
            alert(`전체 끄기 실패: ${error.message}`);
        }
    }
    
    // 5. 최종 버튼 텍스트 업데이트 및 버튼 활성화
    updateMasterButtonText();
    masterPushButton.disabled = false;
}

/**
 * ❗️ [수정 없음] 모든 토글 DOM 업데이트 및 API 병렬 호출
 */
async function toggleAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    for (const toggle of toggles) {
        toggle.checked = shouldBeOn;
        const machineId = parseInt(toggle.dataset.machineId, 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
        }
    }
    await Promise.all(tasks);
}


/**
 * ❗️ [수정 없음] 마스터 버튼 텍스트 업데이트
 */
function updateMasterButtonText() {
    if (!masterPushButton) return;

    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    if (allToggles.length === 0) {
        masterPushButton.textContent = '🔔 전체 알림 켜기'; // (기본값)
        return;
    }

    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);
    masterPushButton.textContent = shouldTurnOn ? "🔔 전체 알림 켜기" : "🔕 전체 알림 끄기";
}


/**
 * ❗️ [수정됨] 권한 요청 및 FCM 토큰 발급 헬퍼
 * (이미 'denied' 상태인지 미리 확인)
 */
async function requestPermissionAndGetToken() {
    
    // 1. ❗️ [신규] 현재 권한 상태를 먼저 확인
    if (Notification.permission === 'denied') {
        console.warn('알림 권한이 이미 \'차단\' 상태입니다.');
        // ❗️ 'denied'라는 특별한 값을 반환하여 호출자가 알 수 있게 함
        return 'denied'; 
    }

    // 2. 권한 요청 (default 상태일 때만 팝업이 뜸)
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        const currentToken = await messaging.getToken();
        if (currentToken) {
            console.log('FCM 토큰 획득:', currentToken);
            return currentToken; // 성공
        } else {
            throw new Error('FCM 토큰 발급에 실패했습니다.'); // 실패
        }
    } else {
        // 'default' (무시) 또는 'denied' (방금 차단)
        return null; // 거부
    }
}