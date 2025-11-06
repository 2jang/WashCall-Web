// js/push.js
// ❗️ (Firebase 설정을 'washcallproject'로 수정한 최종본)

// 1. ❗️ [핵심 수정] 서버 팀이 새로 준 Firebase 설정
 const firebaseConfig = {
    apiKey: "AIzaSyD0MBr9do9Hl3AJsNv0yZJRupDT1l-8dVE",
    authDomain: "washcallproject.firebaseapp.com",
    projectId: "washcallproject",
    storageBucket: "washcallproject.firebasestorage.app",
    messagingSenderId: "401971602509",
    appId: "1:401971602509:web:45ee34d4ed2454555aa804",
    measurementId: "G-K4FHGY7MZT"
  };
// ❗️ [수정] 끝

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// (이하 '마스터 스위치' 및 '친절한 안내' 로직은 수정 없음)
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

  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      masterPushButton.textContent = '알림 설정 실패';
    });

  masterPushButton.onclick = onMasterToggleClick;

  updateMasterButtonText();
  setTimeout(updateMasterButtonText, 2000); 

  document.body.addEventListener('change', event => {
      if (event.target.classList.contains('notify-me-toggle')) {
          setTimeout(updateMasterButtonText, 50);
      }
  });
}

async function onMasterToggleClick() {
    masterPushButton.disabled = true; 

    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);

    if (shouldTurnOn) {
        masterPushButton.textContent = '권한 확인 중...';
        try {
            const tokenOrStatus = await requestPermissionAndGetToken();

            if (tokenOrStatus === 'denied') {
                alert("알림이 '차단' 상태입니다.\n\n알림을 받으려면, 주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                masterPushButton.textContent = '알림 거부됨';
                masterPushButton.disabled = false; 
                return; 
            
            } else if (tokenOrStatus === null) {
                throw new Error('알림 권한이 거부되었습니다.');
            
            } else {
                const token = tokenOrStatus;
                await api.registerPushToken(token);
                await toggleAllMachinesAPI(allToggles, true);
                alert('전체 알림이 켜졌습니다.');
            }

        } catch (error) {
            alert(`전체 켜기 실패: ${error.message}`);
        }
    } else {
        masterPushButton.textContent = '끄는 중...';
        try {
            await toggleAllMachinesAPI(allToggles, false);
            alert('전체 알림이 꺼졌습니다.');
        } catch (error) {
            alert(`전체 끄기 실패: ${error.message}`);
        }
    }
    
    updateMasterButtonText();
    masterPushButton.disabled = false;
}

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