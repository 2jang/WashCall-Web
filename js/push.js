// js/push.js
// ❗️ (새로운 '세탁실 알림 구독' 버튼 로직 최종본)

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

// ❗️ 버튼 DOM 참조
let roomSubscribeButton; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    setupRoomSubscribeButton();
  }
});

function setupRoomSubscribeButton() {
  // ❗️ [수정] 새 버튼 ID 참조
  roomSubscribeButton = document.getElementById('room-subscribe-button');
  if (!roomSubscribeButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    roomSubscribeButton.textContent = '알림 미지원';
    roomSubscribeButton.disabled = true;
    return;
  }

  // 2. 서비스 워커 등록
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      roomSubscribeButton.textContent = '알림 설정 실패';
    });

  // 3. ❗️ [수정] 새 버튼 클릭 이벤트
  roomSubscribeButton.onclick = onRoomSubscribeClick;

  // 4. ❗️ [수정] 버튼 텍스트 초기화
  // (서버에서 /load 시 isreserved 값을 받아와야 완벽하지만,
  //  일단 기본 텍스트로 설정)
  roomSubscribeButton.textContent = '🔔 세탁실 알림 받기';
}

/**
 * ❗️ [핵심 수정] '세탁실 알림 받기' 버튼 클릭 시
 */
async function onRoomSubscribeClick() {
    roomSubscribeButton.disabled = true; // 중복 클릭 방지

    // ❗️ (현재 로직은 '켜기'만 가정. 끄기 로직은 서버가 담당)
    const shouldTurnOn = true; 

    if (shouldTurnOn) {
        roomSubscribeButton.textContent = '권한 확인 중...';
        try {
            // 1. 권한 요청 및 토큰 발급
            const tokenOrStatus = await requestPermissionAndGetToken();

            if (tokenOrStatus === 'denied') {
                alert("알림이 '차단' 상태입니다.\n\n주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                throw new Error('알림 권한이 차단되었습니다.');
            
            } else if (tokenOrStatus === null) {
                throw new Error('알림 권한이 거부되었습니다.');
            
            } else {
                // 2. (성공) FCM 토큰 등록
                const token = tokenOrStatus;
                await api.registerPushToken(token);
                
                // 3. ❗️ [신규] '세탁실 구독' (POST /reserve) API 호출
                await api.reserveRoom(1, 1); // (room_id: 1, isreserved: 1)
                
                alert('세탁실 알림이 등록되었습니다.');
                roomSubscribeButton.textContent = '✅ 알림 등록됨';
                // (일회성이므로, 다시 비활성화할 필요 없이 '등록됨'으로 둠)
            }

        } catch (error) {
            alert(`알림 등록 실패: ${error.message}`);
            roomSubscribeButton.disabled = false; // 롤백
            roomSubscribeButton.textContent = '🔔 세탁실 알림 받기';
        }
    } 
    // (끄기 로직은 서버가 자동으로 처리하므로 프론트엔드에서는 불필요)
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