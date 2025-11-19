// service-worker.js (파일 전체 덮어쓰기)
// ❗️ (Firebase 설정을 'washcallproject'로 수정한 최종본)

// 1. Firebase 스크립트 임포트
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js");

// 2. ❗️ [핵심 수정] 서버 팀이 새로 준 Firebase 설정
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

// 3. 메시징 인스턴스
const messaging = firebase.messaging();

// 3-1. PWA 설치 조건 충족을 위한 fetch 이벤트 리스너 (필수)
self.addEventListener('fetch', (event) => {
    // 기본적으로 네트워크 요청을 그대로 통과시킴 (Network Only 전략)
    event.respondWith(fetch(event.request));
});

// 4. 백그라운드에서 푸시 처리 (data 페이로드 사용)
messaging.onBackgroundMessage((payload) => {
    console.log('[service-worker.js] 백그라운드 메시지 수신:', payload);
    
    //메시지 지원 (notification과 data 모두 체크)
    const notificationTitle = payload.notification?.title || payload.data?.title || '알림';
    const notificationBody = payload.notification?.body || payload.data?.body || '새 메시지가 도착했습니다.';
    const machineId = payload.data?.machine_id;
    
    const notificationOptions = {
        body: notificationBody,
        icon: 'favicon.png',
        badge: 'favicon.png',
        tag: machineId ? `machine-${machineId}` : 'notification',
        requireInteraction: false,
        data: {
            url: machineId ? `index.html#machine-${machineId}` : 'index.html',
            machine_id: machineId
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 5. 알림 클릭 시 동작 (개선)
self.addEventListener('notificationclick', event => {
  console.log('[service-worker.js] 알림 클릭:', event.notification);
  
  event.notification.close(); // 알림 닫기
  
  // ✅ 알림 데이터에서 URL과 machine_id 가져오기
  const targetUrl = event.notification.data?.url || 'index.html';
  const machineId = event.notification.data?.machine_id;
  
  event.waitUntil(
    // 이미 열려있는 탭이 있으면 포커스, 없으면 새 탭
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 이미 열려있는 WashCall 탭 찾기
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            // ✅ Service Worker → 클라이언트 메시지 전송 (스크롤 요청)
            if (machineId) {
              client.postMessage({
                type: 'SCROLL_TO_MACHINE',
                machine_id: machineId
              });
            }
            return client.focus();
          }
        }
        
        // 열려있는 탭이 없으면 새로 열기
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});