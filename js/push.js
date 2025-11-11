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
 * [핵심] '세탁실 알림' 켜기/끄기 토글
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
 * ❗️ [핵심 수정] 모든 '세탁기'에 대해서만 API를 호출 (건조기 제외)
 */
async function subscribeAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    
    // 1. ❗️ [수정] '.machine-type-washer' 클래스를 가진 '세탁기' 카드만 선택
    //    (main.js의 renderMachines가 이 클래스를 추가함)
    const washerCards = document.querySelectorAll('.machine-type-washer');
    
    const machineIds = new Set();

    // 2. ❗️ 각 세탁기 카드에서 machine-id를 수집
    washerCards.forEach(card => {
        // (main.js가 card.id = `machine-${machine.machine_id}`로 설정함)
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) {
            machineIds.add(machineId);
        }
    });

    // 3. ❗️ 수집된 '세탁기' ID(건조기 제외)에 대해서만 API 호출
    console.log(`'빈자리 알림' ${shouldBeOn ? '켜기' : '끄기'}: ${machineIds.size}대의 '세탁기'를 대상으로 실행합니다.`);
    
    for (const machineId of machineIds) {
        tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
    }

    await Promise.all(tasks);
}

/**
 * ❗️ [신규] 버튼 텍스트 업데이트 헬퍼
 * (이름이 "빈자리 알림"으로 수정됨)
 */
function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; // (안전장치)
    
    if (isOn) {
        masterPushButton.textContent = "🔔 빈자리 알림 끄기 (허용 중)";
        masterPushButton.classList.add('subscribed'); 
    } else {
        masterPushButton.textContent = "🔔 빈자리 알림 받기";
        masterPushButton.classList.remove('subscribed'); 
    }
}

/**
 * ✅ iOS 버전 체크 (iOS 16.4+ 필요)
 */
function checkiOSVersion() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) return true; // iOS가 아니면 통과
    
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return true;
    
    const majorVersion = parseInt(match[1], 10);
    const minorVersion = parseInt(match[2], 10);
    
    // iOS 16.4 미만
    if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
        const currentVersion = `iOS ${majorVersion}.${minorVersion}`;
        console.error(`⚠️ iOS 16.4 이상이 필요합니다. 현재: ${currentVersion}`);
        alert(`⚠️ iOS 16.4 이상이 필요합니다.\n현재 버전: ${currentVersion}\n\n푸시 알림을 사용하려면 iOS를 업데이트해주세요.`);
        return false;
    }
    
    console.log(`✅ iOS ${majorVersion}.${minorVersion} - 푸시 알림 지원`);
    return true;
}

/**
 * ❗️ [핵심 수정] 권한 요청 및 FCM 토큰 발급 헬퍼
 * ✅ iOS PWA 지원: VAPID 키 및 serviceWorkerRegistration 전달
 */
async function requestPermissionAndGetToken() {
    
    // ✅ iOS 버전 체크 (iOS 16.4+ 필요)
    if (!checkiOSVersion()) {
        throw new Error('iOS 16.4 이상이 필요합니다.');
    }
    
    // ❗️ 'Notification' 변수 자체가 존재하는지 확인
    // (iOS 개인정보 보호 모드에서는 이 변수가 차단되어 오류 발생)
    if (!('Notification' in window) || !('PushManager' in window)) {
        console.error('알림 API(Notification)를 이 브라우저/모드에서 지원하지 않습니다.');
        throw new Error('알림 기능을 사용할 수 없습니다. Safari "개인정보 보호 브라우징" 모드를 끄고 다시 시도해주세요.');
    }

    // 알림 권한이 이미 차단된 경우
    if (Notification.permission === 'denied') {
        console.warn('알림 권한이 이미 \'차단\' 상태입니다.');
        return 'denied'; 
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        // ✅ VAPID 공개키 (Firebase Console에서 가져온 값으로 교체 필요)
        // TODO: Firebase Console → 프로젝트 설정 → Cloud Messaging → 웹 푸시 인증서에서 복사
        const VAPID_PUBLIC_KEY = 'BCyYOy8xvlx73JHB2ZikUoNI19l7qmkTnpzQvqmlheaiXwelDy9SLa4LhRcx3wG82gwdtMlFcQH3lqr3_5pwGm8'; // ⚠️ 실제 VAPID 키로 교체 필요!
        
        // Service Worker 등록 확인
        const registration = await navigator.serviceWorker.ready;
        
        // ✅ iOS PWA 지원: vapidKey 및 serviceWorkerRegistration 전달
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
        });
        
        if (currentToken) {
            console.log('✅ FCM 토큰 획득 (iOS PWA 지원):', currentToken);
            return currentToken; // 성공
        } else {
            console.warn('FCM 토큰을 가져올 수 없습니다.');
            throw new Error('FCM 토큰 발급에 실패했습니다.'); 
        }
    } else {
        return null; // 거부
    }
}