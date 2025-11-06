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

// 4. 백그라운드에서 푸시 처리 (data 페이로드 사용)
messaging.onBackgroundMessage((payload) => {
    console.log('[service-worker.js] 백그라운드 메시지 수신:', payload);
    
    // (payload.data에서 title/body를 읽는 로직은 수정 없음)
    const notificationTitle = payload.data.title;
    const notificationOptions = {
        body: payload.data.body,
        icon: 'favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 5. 알림 클릭 시 동작 (기존 코드 유지)
self.addEventListener('notificationclick', event => {
  event.notification.close(); // 알림 닫기
  
  event.waitUntil(
    clients.openWindow('index.html')
  );
});