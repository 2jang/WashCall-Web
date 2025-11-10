// js/push.js
// ❗️ (중복 알림 방지: '세탁실'과 '개별'이 연동되는 최종본)

// 1. Firebase 설정 (그대로)
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

// --- ❗️ 상태 저장을 위한 변수 ---
let masterPushButton; 
const STORAGE_KEY = 'washcallRoomSubState'; 
let isRoomSubscribed = false; 
// ---

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
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

  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      masterPushButton.textContent = '알림 설정 실패';
    });

  // 3. localStorage에서 상태를 불러옴
  isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true');
  
  // 4. 불러온 상태에 맞게 버튼 텍스트 초기화
  updateMasterButtonText(isRoomSubscribed);
  
  // 5. 버튼 클릭 이벤트 (토글 기능)
  masterPushButton.onclick = onMasterSubscribeToggle;
}

/**
 * ❗️ [핵심 수정] '세탁실 알림' 켜기/끄기 토글
 */
async function onMasterSubscribeToggle() {
    masterPushButton.disabled = true;
    
    // 1. 목표 상태 결정
    const targetState = !isRoomSubscribed; // true = 켜기, false = 끄기

    try {
        if (targetState === true) {
            // --- [A] 켜기 로직 ---
            masterPushButton.textContent = '권한 확인 중...';
            
            // 1-A. 권한/토큰 확보
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') {
                throw new Error("알림이 '차단' 상태입니다. 주소창의 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
            } else if (tokenOrStatus === null) {
                throw new Error('알림 권한이 거부되었습니다.');
            }
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            // 1-B. ❗️ [신규] "다 끄게 만들자"
            // (중복 방지: 켜져 있는 '개별' 토글을 먼저 모두 끈다)
            masterPushButton.textContent = '개별 알림 끄는 중...';
            await turnOffAllIndividualToggles();
            
            // 1-C. '세탁실 알림' API 호출 (UI 변경 없음)
            masterPushButton.textContent = '세탁실 알림 등록 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, true); // true = 켜기
            
            alert('세탁실 알림이 등록되었습니다.\n(기존에 켜져있던 개별 알림은 모두 꺼졌습니다)');

        } else {
            // --- [B] 끄기 로직 ---
            masterPushButton.textContent = '세탁실 알림 취소 중...';
            
            // 2-A. '세탁실 알림' API 호출 (UI 변경 없음)
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, false); // false = 끄기
            
            alert('세탁실 알림이 취소되었습니다.');
        }

        // --- [C] 성공 시 상태 저장 (공통) ---
        isRoomSubscribed = targetState; 
        localStorage.setItem(STORAGE_KEY, isRoomSubscribed); 
        
    } catch (error) {
        alert(`처리 실패: ${error.message}`);
    }
    
    // 5. 최종 상태에 맞게 버튼 텍스트/활성화 복구
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false;
}

/**
 * ❗️ [신규] "다 끄게" 하는 헬퍼 (UI + API 모두 끔)
 */
async function turnOffAllIndividualToggles() {
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    if (checkedToggles.length === 0) return; // 끈 게 없으면 스킵

    console.log(`중복 방지: ${checkedToggles.length}개의 개별 알림을 끕니다.`);
    
    const tasks = [];
    for (const toggle of checkedToggles) {
        // 1. UI 끄기
        toggle.checked = false; 
        
        // 2. API 끄기
        const machineId = parseInt(toggle.dataset.machineId, 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, false));
        }
    }
    await Promise.all(tasks);
}


/**
 * ❗️ [수정] "세탁실 알림" 전용 헬퍼 (API만 호출, UI 안 건드림)
 * (이 함수 이름은 헷갈리지 않게 변경합니다: subscribeAllMachinesAPI)
 */
async function subscribeAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    for (const toggle of toggles) {
        // ❗️ [중요] 개별 토글 UI(toggle.checked)는 건드리지 않음
        
        const machineId = parseInt(toggle.dataset.machineId, 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
        }
    }
    await Promise.all(tasks);
}

/**
 * ❗️ [수정 없음] 버튼 텍스트 업데이트 헬퍼
 */
function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; // (안전장치)
    
    if (isOn) {
        masterPushButton.textContent = "🔔 세탁실 알림 끄기";
    } else {
        masterPushButton.textContent = "🔔 세탁실 알림 받기";
    }
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
            return currentToken; // 성공
        } else {
            throw new Error('FCM 토큰 발급에 실패했습니다.'); // 실패
        }
    } else {
        return null; // 거부
    }
}