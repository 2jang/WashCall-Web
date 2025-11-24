// js/push.js
// ❗️ (빈자리 알림 자동 해제 기능 포함 최종본)

const firebaseConfig = {
    apiKey: "AIzaSyD0MBr9do9Hl3AJsNv0yZJRupDT1l-8dVE",
    authDomain: "washcallproject.firebaseapp.com",
    projectId: "washcallproject",
    storageBucket: "washcallproject.firebasestorage.app",
    messagingSenderId: "401971602509",
    appId: "1:401971602509:web:45ee34d4ed2454555aa804",
    measurementId: "G-K4FHGY7MZT"
};

let messaging = null;
try {
    firebase.initializeApp(firebaseConfig);
    if (typeof firebase.messaging === 'function' && firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
    }
} catch (e) {
    console.error("Firebase 초기화 오류:", e);
}

let masterPushButton; 
const STORAGE_KEY = 'washcallRoomSubState'; 
const RESTORE_KEY = 'washcallRestoreSubs';
let isRoomSubscribed = false; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    masterPushButton = document.getElementById('room-subscribe-button');
    setupMasterPushButton();
  }
});

async function setupMasterPushButton() {
  if (!masterPushButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !messaging) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  const swPath = await findServiceWorkerPath();
  if (swPath) {
      navigator.serviceWorker.register(swPath).catch(console.error);
  } else {
      masterPushButton.textContent = 'SW 파일 없음';
  }

  isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true');
  updateMasterButtonText(isRoomSubscribed);
  
  if (isRoomSubscribed) {
      setTimeout(() => toggleAllCardButtons(), 500);
  }

  masterPushButton.onclick = onMasterSubscribeToggle;
}

async function findServiceWorkerPath() {
    const candidates = ['./service-worker.js', '/service-worker.js', 'service-worker.js'];
    for (const path of candidates) {
        try {
            const res = await fetch(path, { method: 'HEAD' });
            if (res.ok) return path;
        } catch (e) {}
    }
    return null;
}

async function onMasterSubscribeToggle() {
    if (!messaging) return alert("알림 기능을 사용할 수 없습니다.");

    masterPushButton.disabled = true; 
    const targetState = !isRoomSubscribed; 

    try {
        if (targetState === true) {
            masterPushButton.textContent = '권한 확인 중...';
            
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
            if (tokenOrStatus === null) throw new Error("알림 거부됨");
            
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            saveCurrentSubscriptions();
            await turnOffAllIndividualToggles();
            
            await subscribeAllMachinesAPI(true); 
            
            // 상태 저장 먼저
            isRoomSubscribed = targetState;
            localStorage.setItem(STORAGE_KEY, isRoomSubscribed);
            
            toggleAllCardButtons();

            alert(`'빈자리 알림'이 켜졌습니다.\n세탁기가 비면 푸시 알림을 드립니다.`);

        } else {
            masterPushButton.textContent = '해제 중...';
            
            await subscribeAllMachinesAPI(false); 
            await restoreSubscriptions();
            
            isRoomSubscribed = targetState;
            localStorage.setItem(STORAGE_KEY, isRoomSubscribed);
            
            toggleAllCardButtons();
            
            alert('빈자리 알림이 꺼졌습니다.\n(기존 알림 설정이 복구되었습니다)');
        }

    } catch (error) {
        alert(`처리 실패: ${error.message}`);
        isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true'); 
    }
    
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false; 
}

/**
 * 🚀 [신규] 알림 수신 시 자동으로 빈자리 알림을 해제하는 함수
 * main.js에서 세탁 완료 알림을 받으면 이 함수를 호출합니다.
 */
window.handleAutoUnsubscribe = async function(machineName) {
    const isSubscribed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!isSubscribed) return; // 이미 꺼져있으면 패스

    console.log(`[Push] ${machineName} 완료 감지 -> 빈자리 알림 자동 해제 시작...`);

    // 1. 상태 끄기 (로컬 스토리지 및 변수)
    isRoomSubscribed = false;
    localStorage.setItem(STORAGE_KEY, 'false');

    // 2. UI 즉시 변경 (사용자가 바로 알 수 있게)
    updateMasterButtonText(false);
    toggleAllCardButtons(); // 개별 버튼들의 잠금(회색)을 풂

    // 3. 백그라운드에서 서버에 구독 해제 요청 (나머지 기기들 알림 취소)
    try {
        // 모든 기기 구독 해제
        await subscribeAllMachinesAPI(false);
        // 기존 구독 상태 복구 (있다면)
        await restoreSubscriptions();
    } catch (e) {
        console.warn("[Push] 자동 해제 중 API 오류 (무시됨):", e);
    }
    
    // (선택) 필요하다면 여기서 alert나 토스트 메시지를 띄울 수 있습니다.
};

function saveCurrentSubscriptions() {
    const subscribedIds = [];
    document.querySelectorAll('.machine-card').forEach(card => {
        if (card.dataset.isSubscribed === 'true') {
            const id = parseInt(card.id.replace('machine-', ''), 10);
            if (id) subscribedIds.push(id);
        }
    });
    localStorage.setItem(RESTORE_KEY, JSON.stringify(subscribedIds));
}

async function restoreSubscriptions() {
    const savedData = localStorage.getItem(RESTORE_KEY);
    if (!savedData) return;

    const ids = JSON.parse(savedData);
    if (!Array.isArray(ids) || ids.length === 0) return;
    
    const tasks = ids.map(id => api.toggleNotifyMe(id, true));
    await Promise.all(tasks);

    ids.forEach(id => {
        const card = document.getElementById(`machine-${id}`);
        if (card) card.dataset.isSubscribed = 'true';
    });

    localStorage.removeItem(RESTORE_KEY);
}

// UI 제어를 main.js의 updateButtonUI에 위임
function toggleAllCardButtons() {
    const allCards = document.querySelectorAll('.machine-card');
    allCards.forEach(card => {
        const currentStatus = card.dataset.status || 'OFF';
        if (typeof window.updateButtonUI === 'function') {
            window.updateButtonUI(card, currentStatus);
        }
    });
}

async function turnOffAllIndividualToggles() {
    const subscribedCards = document.querySelectorAll('.machine-card[data-is-subscribed="true"]');
    const tasks = [];
    subscribedCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) tasks.push(api.toggleNotifyMe(machineId, false));
    });
    await Promise.all(tasks);
}

async function subscribeAllMachinesAPI(shouldBeOn) {
    const tasks = [];
    // 세탁기만 대상으로 함
    const washerCards = document.querySelectorAll('.machine-type-washer');
    
    washerCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
        }
    });
    
    await Promise.all(tasks);
}

function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; 
    if (isOn) {
        masterPushButton.textContent = "🔔 빈자리 알림 사용 중"; 
        masterPushButton.classList.add('subscribed'); 
    } else {
        masterPushButton.textContent = "🔔 빈자리 알림 받기";
        masterPushButton.classList.remove('subscribed'); 
    }
}

function checkiOSVersion() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) return true; 
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return true;
    const majorVersion = parseInt(match[1], 10);
    const minorVersion = parseInt(match[2], 10);
    if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
        alert(`⚠️ iOS 16.4 이상이 필요합니다.`);
        return false;
    }
    return true;
}

async function requestPermissionAndGetToken() {
    if (!checkiOSVersion()) throw new Error('iOS 16.4 이상이 필요합니다.');
    if (!('Notification' in window)) throw new Error('알림 기능을 사용할 수 없습니다.');
    if (Notification.permission === 'denied') return 'denied'; 
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const VAPID_PUBLIC_KEY = 'BCyYOy8xvlx73JHB2ZikUoNI19l7qmkTnpzQvqmlheaiXwelDy9SLa4LhRcx3wG82gwdtMlFcQH3lqr3_5pwGm8'; 
        const registration = await navigator.serviceWorker.ready;
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
        });
        if (currentToken) return currentToken; 
        else throw new Error('FCM 토큰 발급에 실패했습니다.'); 
    } else {
        return null; 
    }
}