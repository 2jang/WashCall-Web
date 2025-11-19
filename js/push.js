// js/push.js
// ❗️ (서비스 워커 경로 수정 및 초기화 에러 방지)

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

// Firebase 초기화 안전하게 처리
let messaging = null;
try {
    firebase.initializeApp(firebaseConfig);
    if (firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
    } else {
        console.warn("이 브라우저는 Firebase 알림을 지원하지 않습니다.");
    }
} catch (e) {
    console.error("Firebase 초기화 오류:", e);
}

// --- 상태 저장을 위한 변수 ---
let masterPushButton; 
const STORAGE_KEY = 'washcallRoomSubState'; 
let isRoomSubscribed = false; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    masterPushButton = document.getElementById('room-subscribe-button');
    setupMasterPushButton();
  }
});

function setupMasterPushButton() {
  if (!masterPushButton) return; 

  // 1. 브라우저 지원 여부 확인
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !messaging) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    console.warn('알림 기능이 지원되지 않는 환경입니다 (HTTP, 시크릿모드 등).');
    return;
  }

  // 2. 서비스 워커 등록 (❗️ 상대 경로 './' 사용으로 404 방지)
  navigator.serviceWorker.register('./service-worker.js')
    .then(registration => {
      console.log('서비스 워커 등록 성공:', registration);
      
      // ❗️ messaging 객체가 유효할 때만 사용
      if (messaging && typeof messaging.useServiceWorker === 'function') {
          messaging.useServiceWorker(registration);
      }
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
 * '세탁실 알림' 켜기/끄기 토글
 */
async function onMasterSubscribeToggle() {
    if (!messaging) {
        alert("알림 기능을 사용할 수 없는 환경입니다.");
        return;
    }

    masterPushButton.disabled = true;
    const targetState = !isRoomSubscribed; 

    try {
        if (targetState === true) {
            // [켜기]
            masterPushButton.textContent = '권한 확인 중...';
            
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') {
                throw new Error("알림이 '차단' 상태입니다. 주소창의 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
            } else if (tokenOrStatus === null) {
                throw new Error('알림 권한이 거부되었습니다.');
            }
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            masterPushButton.textContent = '개별 알림 끄는 중...';
            const turnedOffCount = await turnOffAllIndividualToggles(); 
            
            masterPushButton.textContent = '세탁실 알림 등록 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle'); 
            await subscribeAllMachinesAPI(allToggles, true); 
            
            if (turnedOffCount > 0) {
                alert(`'빈자리 알림'이 등록되었습니다.\n\n켜져 있던 ${turnedOffCount}개의 개별 알림은 자동으로 꺼졌습니다.`);
            } else {
                alert("'빈자리 알림'이 등록되었습니다.");
            }

        } else {
            // [끄기]
            masterPushButton.textContent = '세탁실 알림 취소 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, false); 
            
            alert('빈자리 알림이 취소되었습니다.');
        }

        isRoomSubscribed = targetState; 
        localStorage.setItem(STORAGE_KEY, isRoomSubscribed); 
        
    } catch (error) {
        alert(`처리 실패: ${error.message}`);
    }
    
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false;
}

async function turnOffAllIndividualToggles() {
    const subscribedB_buttons = document.querySelectorAll('.notify-me-during-wash-btn:disabled');
    // const subscribedA_buttons = ... (모달 방식이라 생략 가능)

    const tasks = [];
    const uniqueMachineIds = new Set();

    for (const btn of subscribedB_buttons) {
        if (btn.textContent.includes('✅ 알림 등록됨')) {
            btn.disabled = false;
            btn.textContent = '🔔 완료 알림 받기'; 
            
            const machineId = parseInt(btn.dataset.machineId, 10);
            if (machineId && !uniqueMachineIds.has(machineId)) {
                tasks.push(api.toggleNotifyMe(machineId, false));
                uniqueMachineIds.add(machineId);
            }
        }
    }
    
    if (tasks.length === 0) return 0;
    await Promise.all(tasks);
    return tasks.length; 
}

async function subscribeAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    const washerCards = document.querySelectorAll('.machine-type-washer');
    const machineIds = new Set();

    washerCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) {
            machineIds.add(machineId);
        }
    });

    console.log(`'빈자리 알림' ${shouldBeOn ? '켜기' : '끄기'}: ${machineIds.size}대의 '세탁기'를 대상으로 실행합니다.`);
    
    for (const machineId of machineIds) {
        tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
    }

    await Promise.all(tasks);
}

function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; 
    
    if (isOn) {
        masterPushButton.textContent = "🔔 빈자리 알림 끄기 (허용 중)";
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
        const currentVersion = `iOS ${majorVersion}.${minorVersion}`;
        console.error(`⚠️ iOS 16.4 이상이 필요합니다. 현재: ${currentVersion}`);
        alert(`⚠️ iOS 16.4 이상이 필요합니다.\n현재 버전: ${currentVersion}\n\n푸시 알림을 사용하려면 iOS를 업데이트해주세요.`);
        return false;
    }
    return true;
}

async function requestPermissionAndGetToken() {
    if (!messaging) {
        throw new Error('알림 기능 초기화에 실패했습니다.');
    }

    if (!checkiOSVersion()) {
        throw new Error('iOS 16.4 이상이 필요합니다.');
    }
    
    if (!('Notification' in window)) {
        console.error('알림 API를 지원하지 않습니다.');
        throw new Error('알림 기능을 사용할 수 없습니다.');
    }

    if (Notification.permission === 'denied') {
        console.warn('알림 권한이 이미 \'차단\' 상태입니다.');
        return 'denied'; 
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        // ⚠️ 실제 VAPID 키로 교체 필요
        const VAPID_PUBLIC_KEY = 'BCyYOy8xvlx73JHB2ZikUoNI19l7qmkTnpzQvqmlheaiXwelDy9SLa4LhRcx3wG82gwdtMlFcQH3lqr3_5pwGm8'; 
        
        const registration = await navigator.serviceWorker.ready;
        
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
        });
        
        if (currentToken) {
            console.log('✅ FCM 토큰 획득:', currentToken);
            return currentToken; 
        } else {
            console.warn('FCM 토큰을 가져올 수 없습니다.');
            throw new Error('FCM 토큰 발급에 실패했습니다.'); 
        }
    } else {
        return null; 
    }
}