// js/push.js
// ❗️ (빈자리 알림 해제 시 기존 구독 복구 + UI 완벽 복원)

// 1. Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyD0MBr9do9Hl3AJsNv0yZJRupDT1l-8dVE",
    authDomain: "washcallproject.firebaseapp.com",
    projectId: "washcallproject",
    storageBucket: "washcallproject.firebasestorage.app",
    messagingSenderId: "401971602509",
    appId: "1:401971602509:web:45ee34d4ed2454555aa804",
    measurementId: "G-K4FHGY7MZT"
};

// Firebase 초기화
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
const RESTORE_KEY = 'washcallRestoreSubs'; // ❗️ 복구용 저장 키
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

  // 초기 상태 로드
  isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true');
  updateMasterButtonText(isRoomSubscribed);
  
  // 페이지 로드 시 이미 켜져있다면 카드 잠금 실행
  if (isRoomSubscribed) {
      setTimeout(() => toggleAllCardButtons(true), 500);
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
            // [ON 켜기]
            masterPushButton.textContent = '권한 확인 중...';
            
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
            if (tokenOrStatus === null) throw new Error("알림 거부됨");
            
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            // ❗️ 1. 끄기 전에 현재 구독 정보 저장 (메모)
            saveCurrentSubscriptions();

            // 2. 개별 알림 모두 끄기 (중복 방지)
            await turnOffAllIndividualToggles();
            
            // 3. 전체 구독 API 호출
            const allToggles = document.querySelectorAll('.notify-me-toggle'); 
            await subscribeAllMachinesAPI(allToggles, true); 
            
            // 4. 카드 버튼들 잠그기
            toggleAllCardButtons(true);

            alert(`'빈자리 알림'이 켜졌습니다.\n세탁기가 비면 푸시 알림을 드립니다.`);

        } else {
            // [OFF 끄기]
            masterPushButton.textContent = '해제 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, false); 
            
            // ❗️ 5. 기존 구독 정보 복구 (Restore)
            await restoreSubscriptions();

            // 6. 카드 버튼들 풀기 (복구된 상태 반영)
            toggleAllCardButtons(false);
            
            alert('빈자리 알림이 꺼졌습니다.\n(기존 알림 설정이 복구되었습니다)');
        }

        isRoomSubscribed = targetState; 
        localStorage.setItem(STORAGE_KEY, isRoomSubscribed); 
        
    } catch (error) {
        alert(`처리 실패: ${error.message}`);
        isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true'); 
    }
    
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false; 
}

// ❗️ [신규] 현재 구독 중인 카드 ID 저장
function saveCurrentSubscriptions() {
    const subscribedIds = [];
    document.querySelectorAll('.machine-card').forEach(card => {
        if (card.dataset.isSubscribed === 'true') {
            const id = parseInt(card.id.replace('machine-', ''), 10);
            if (id) subscribedIds.push(id);
        }
    });
    localStorage.setItem(RESTORE_KEY, JSON.stringify(subscribedIds));
    console.log("저장된 구독 목록:", subscribedIds);
}

// ❗️ [신규] 저장된 구독 정보로 재구독 및 상태 복구
async function restoreSubscriptions() {
    const savedData = localStorage.getItem(RESTORE_KEY);
    if (!savedData) return;

    const ids = JSON.parse(savedData);
    if (!Array.isArray(ids) || ids.length === 0) return;

    console.log("구독 복구 시작:", ids);
    
    // API 재호출
    const tasks = ids.map(id => api.toggleNotifyMe(id, true));
    await Promise.all(tasks);

    // UI 상태(꼬리표) 복구
    ids.forEach(id => {
        const card = document.getElementById(`machine-${id}`);
        if (card) card.dataset.isSubscribed = 'true';
    });

    // 사용 후 삭제
    localStorage.removeItem(RESTORE_KEY);
}

// ❗️ [핵심 수정] 카드 버튼 잠금/해제 (복구 로직 포함)
function toggleAllCardButtons(shouldDisable) {
    const allCards = document.querySelectorAll('.machine-card');

    allCards.forEach(card => {
        const startBtn = card.querySelector('.notify-start-btn');
        const notifyBtn = card.querySelector('.notify-me-during-wash-btn');
        const isSubscribed = card.dataset.isSubscribed === 'true';
        
        // 상태 텍스트로 현재 기기 상태 추측 (main.js 연동 없이 UI 복구)
        const statusText = card.querySelector('.status-display strong')?.textContent || "";
        const isRunning = statusText.includes("중"); // 세탁 중, 탈수 중...
        const isWaiting = statusText.includes("대기") || statusText.includes("완료");

        if (shouldDisable) {
            // 🔴 [잠금 모드]
            if (startBtn) {
                startBtn.style.display = 'block'; // 버튼을 보여주되
                startBtn.disabled = true;         // 비활성화
                startBtn.textContent = "빈자리 알림 사용 중";
                startBtn.style.opacity = "0.5";
            }
            if (notifyBtn) notifyBtn.style.display = 'none'; // 알림 버튼은 숨김
            
        } else {
            // 🟢 [해제 모드 - 원상복구]
            if (isSubscribed) {
                // (1) 구독 중이었던 카드 -> "✅ 알림 등록됨"
                if (startBtn) startBtn.style.display = 'none';
                if (notifyBtn) {
                    notifyBtn.style.display = 'block';
                    notifyBtn.textContent = '✅ 알림 등록됨';
                    notifyBtn.disabled = true;
                }
            } else {
                // (2) 구독 안 했던 카드 -> 원래 상태로
                if (isWaiting) {
                    // 대기 중 -> 세탁 시작 버튼
                    if (startBtn) {
                        startBtn.style.display = 'block';
                        startBtn.disabled = false;
                        startBtn.textContent = "🔔 세탁 시작";
                        startBtn.style.opacity = "1";
                    }
                    if (notifyBtn) notifyBtn.style.display = 'none';
                } else {
                    // 작동 중 -> 알림 받기 버튼
                    if (startBtn) startBtn.style.display = 'none';
                    if (notifyBtn) {
                        notifyBtn.style.display = 'block';
                        notifyBtn.textContent = '🔔 완료 알림 받기';
                        notifyBtn.disabled = false;
                    }
                }
            }
        }
    });
}

async function turnOffAllIndividualToggles() {
    // UI상으로는 이미 꼬리표(dataset)에 저장했으므로, 여기선 API만 끄면 됨
    const subscribedCards = document.querySelectorAll('.machine-card[data-is-subscribed="true"]');
    const tasks = [];
    subscribedCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, false));
        }
        // ❗️ 주의: 여기서 dataset을 지우면 안됨! (복구해야 하니까)
    });
    await Promise.all(tasks);
}

async function subscribeAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    const washerCards = document.querySelectorAll('.machine-type-washer');
    washerCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
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