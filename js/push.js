// js/push.js
// ❗️ ('세탁실 구독' 버튼이 '모든 /notify_me'를 호출하도록 수정된 최종본)

// 1. Firebase 설정 (washcallproject)
 const firebaseConfig = {
    apiKey: "AIzaSyD0MBr9do9Hl3AJsNv0yZJRupDT1l-8dVE",
    authDomain: "washcallproject.firebaseapp.com",
    projectId: "washcallproject",
    storageBucket: "washcallproject.firebasestorage.app",
    messagingSenderId: "401971602509",
    appId: "1:401971602509:web:45ee34d4ed2454555aa804",
    measurementId: "G-K4FHGY7MZT"
  };

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ❗️ 마스터 버튼 DOM을 전역에서 참조
let masterPushButton; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    // ❗️ [수정] ID 변경 (index.html의 롤백된 ID와 일치)
    masterPushButton = document.getElementById('room-subscribe-button');
    setupMasterPushButton();
  }
});

function setupMasterPushButton() {
  if (!masterPushButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  // 2. 서비스 워커 등록
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      masterPushButton.textContent = '알림 설정 실패';
    });

  // 3. ❗️ [수정] 새 버튼 클릭 이벤트
  masterPushButton.onclick = onMasterToggleClick;

  // 4. ❗️ [수정] 버튼 텍스트 초기화 (main.js가 로드될 때까지 대기)
  setTimeout(updateMasterButtonText, 2000); 

  // 5. ❗️ [신규] 개별 토글 변경 시 마스터 버튼 동기화
  document.body.addEventListener('change', event => {
      if (event.target.classList.contains('notify-me-toggle')) {
          setTimeout(updateMasterButtonText, 50);
      }
  });
}

/**
 * ❗️ [핵심 수정] '세탁실 구독' 버튼 클릭 시 (마스터 토글)
 */
async function onMasterToggleClick() {
    masterPushButton.disabled = true; // 중복 클릭 방지

    // 1. 현재 켜진 토글과 전체 토글 수를 계산
    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    // 2. 켤지(true) 끌지(false) 결정
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);

    if (shouldTurnOn) {
        // --- [A] 전체 켜기 로직 ---
        masterPushButton.textContent = '권한 확인 중...';
        try {
            // 3. 권한 요청 및 토큰 발급
            const tokenOrStatus = await requestPermissionAndGetToken();

            if (tokenOrStatus === 'denied') {
                alert("알림이 '차단' 상태입니다.\n\n알림을 받으려면, 주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                throw new Error('알림 권한이 차단되었습니다.');
            
            } else if (tokenOrStatus === null) {
                throw new Error('알림 권한이 거부되었습니다.');
            
            } else {
                // 4. (성공) FCM 토큰 등록
                const token = tokenOrStatus;
                await api.registerPushToken(token);
                
                // 5. ❗️ "각 개체마다 /notify_me를 보냄"
                await toggleAllMachinesAPI(allToggles, true);
                alert('전체 알림이 켜졌습니다.');
            }

        } catch (error) {
            alert(`전체 켜기 실패: ${error.message}`);
        }
    } else {
        // --- [B] 전체 끄기 로직 ---
        masterPushButton.textContent = '끄는 중...';
        try {
            // 3. ❗️ "각 개체마다 /notify_me를 보냄" (끄기)
            await toggleAllMachinesAPI(allToggles, false);
            alert('전체 알림이 꺼졌습니다.');
        } catch (error) {
            alert(`전체 끄기 실패: ${error.message}`);
        }
    }
    
    // 4. 최종 버튼 텍스트 업데이트 및 버튼 활성화
    updateMasterButtonText();
    masterPushButton.disabled = false;
}

/**
 * ❗️ [신규] 모든 토글의 DOM을 업데이트하고 '각 개체마다' API를 병렬 호출
 */
async function toggleAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    for (const toggle of toggles) {
        // 1. DOM(UI) 상태 변경
        toggle.checked = shouldBeOn;
        
        // 2. ❗️ '/notify_me 하나의 객체' API 호출
        const machineId = parseInt(toggle.dataset.machineId, 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
        }
    }
    // 3. 모든 API 호출이 끝날 때까지 대기
    await Promise.all(tasks);
}


/**
 * ❗️ [신규] 현재 토글 상태를 읽어 마스터 버튼 텍스트를 업데이트
 */
function updateMasterButtonText() {
    if (!masterPushButton) return;

    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    if (allToggles.length === 0) {
        masterPushButton.textContent = '🔔 세탁실 알림 켜기'; // (기본값)
        return;
    }

    // 절반 이하로 켜져 있으면 '켜기' 버튼 표시, 아니면 '끄기' 버튼 표시
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);
    masterPushButton.textContent = shouldTurnOn ? "🔔 전체 알림 켜기" : "🔕 전체 알림 끄기";
}


/**
 * ❗️ [수정 없음] 권한 요청 및 FCM 토큰 발급 헬퍼
 */
async function requestPermissionAndGetToken() {
    
    if (Notification.permission === 'denied') {
        console.warn('알림 권한이 이미 \'차단\' 상태입니다.');
        return 'denied'; 
    }

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
        return null; // 거부
    }
}