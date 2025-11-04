// js/server-api.js
// ❗️ WebSocket 연결, getInitialMachines, getCongestionData 함수가 포함된 최종 버전

// const API_BASE_URL = 'http://127.0.0.1:8000'; // 개발 환경
const API_BASE_URL = 'https://unconical-kyong-frolicsome.ngrok-free.dev';

// localStorage에서 인증 토큰을 가져오는 헬퍼 함수
function getAuthToken() {
    return localStorage.getItem('user_token');
}

// fetch API 요청에 필요한 옵션을 구성하는 헬퍼 함수 (토큰 포함)
function getFetchOptions(method, body = null, isFormData = false) {
    const token = getAuthToken();
    const headers = {
        'ngrok-skip-browser-warning': 'true'  // ngrok 경고 페이지 우회
    };

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }
    return options;
}

const api = {
    // 1. 초기 세탁기 목록 가져오기 (GET)
    getInitialMachines: async function() {
        console.log('API: "진짜" POST /load 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/load`, getFetchOptions('POST'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '초기 세탁기 목록 로드 실패');
            }
            const data = await response.json();

            // ❗️ 서버 응답 형식이 {machine_list: [...]} 일 경우 처리
            if (data && Array.isArray(data.machine_list)) { 
                console.log("API: /load 응답 (data.machine_list):", data.machine_list);
                return data.machine_list; // 서버가 {"machine_list": [...] } 형식으로 보낼 때
            } else if (data && Array.isArray(data.data)) { // 혹시 모를 다른 형식 대비
                console.log("API: /load 응답 (data.data):", data.data);
                return data.data; 
            } else if (Array.isArray(data)) { // 혹시 모를 다른 형식 대비
                console.log("API: /load 응답 (직접 배열):", data);
                return data; 
            } else {
                // 예상치 못한 형식이라면 에러 발생
                console.error("API: /load 예상치 못한 응답 형식:", data);
                throw new Error('서버로부터 예상치 못한 형식의 세탁기 목록을 받았습니다.');
            }
        } catch (error) {
            console.error('API: 초기 세탁기 목록 로드 실패:', error);
            throw error;
        }
    },

    // 2. 세탁 코스 시작 (POST)
    startCourse: async function(machineId, courseName) {
        console.log(`API: 세탁기 ${machineId} 코스 '${courseName}' 시작 요청 중...`);
        try {
            const response = await fetch(`${API_BASE_URL}/start_course`, getFetchOptions('POST', {
                machine_id: machineId,
                course_name: courseName
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '코스 시작 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 코스 시작 실패:', error);
            throw error;
        }
    },

    // 3. 사용자 회원가입 (POST)
    // ❗️ [수정] 서버(web_router.py)의 스펙에 맞춤
    // ❗️ [수정] auth.js가 호출하는 순서(username, studentId, password)로 파라미터 순서 변경
    register: async function(username, studentId, password) { 
        console.log('API: 사용자 회원가입 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/register`, getFetchOptions('POST', {
                // ❗️ 1. [수정] user_id -> user_snum (서버 스키마)
                user_snum: parseInt(studentId, 10),
                // ❗️ 2. [수정] auth.js에서 받은 username 사용
                user_username: username, 
                user_password: password
            }));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '회원가입 실패');
            }
            return await response.json();

        } catch (error) {
            console.error('API: 회원가입 실패:', error);
            throw error;
        }
    },

   // 4. 사용자 로그인 (POST)
    // ❗️ [수정] 서버(web_router.py)의 /login API 스펙에 맞춤
    login: async function(studentId, password) {
        console.log('API: 사용자 로그인 요청 중...');

        // ❗️ 1. [수정] Form Data 대신 JSON 페이로드 생성
        const payload = {
            // ❗️ 필드명 'username' -> 'user_snum'
            user_snum: parseInt(studentId, 10), 
            // ❗️ 필드명 'password' -> 'user_password'
            user_password: password,            
            // ❗️ /login API는 fcm_token을 필수로 받음
            //    (이 토큰은 나중에 push.js와 연동해야 함)
            fcm_token: "TEMP_TOKEN_ON_LOGIN"  
        };

        try { 
            // ❗️ 2. [수정] 엔드포인트 /token -> /login
            // ❗️   3. [수정] getFetchOptions를 사용하여 JSON으로 전송 (x-www-form-urlencoded 제거)
            const response = await fetch(`${API_BASE_URL}/login`, getFetchOptions('POST', payload));

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '로그인 실패');
            }
            const data = await response.json();
            return data.access_token; // JWT 토큰 반환

        } catch (error) {
            console.error('API: 로그인 실패:', error);
            throw error;
        }
    },

    // 5. 게시글 목록 가져오기 (GET)
    getPosts: async function() {
        console.log('API: 게시글 목록 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/posts`, getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 목록 로드 실패');
            }
            const data = await response.json();
            return data.data || data;
        } catch (error) {
            console.error('API: 게시글 목록 로드 실패:', error);
            throw error;
        }
    },

    // 6. 새 게시글 생성 (POST)
    createPost: async function(title, content) {
        console.log('API: 새 게시글 생성 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/posts`, getFetchOptions('POST', {
                title: title,
                content: content
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 생성 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 생성 실패:', error);
            throw error;
        }
    },

    // 7. 게시글 수정 (PUT)
    updatePost: async function(postId, title, content) {
        console.log(`API: 게시글 ${postId} 수정 요청 중...`);
        try {
            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, getFetchOptions('PUT', {
                title: title,
                content: content
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 수정 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 수정 실패:', error);
            throw error;
        }
    },

    // 8. 게시글 삭제 (DELETE)
    deletePost: async function(postId) {
        console.log(`API: 게시글 ${postId} 삭제 요청 중...`);
        try {
            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, getFetchOptions('DELETE'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 삭제 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 삭제 실패:', error);
            throw error;
        }
    },

    // ❗️ 9. WebSocket 연결 함수 (초기 버전으로 롤백)
    connect: function(onOpenCallback, onMessageCallback, onErrorCallback) {
        console.log('API: "진짜" WebSocket에 연결합니다...');
        const token = getAuthToken();
        if (!token) {
            console.error("WebSocket 연결 실패: 토큰이 없습니다.");
            if (onErrorCallback) onErrorCallback();
            return;
        }

        // ❗️ WebSocket URL: wss:// 사용, 토큰을 쿼리 파라미터로 전달
        // 서버팀이 이 주소를 WebSocket 엔드포인트로 구현해야 합니다.
        const wsUrl = API_BASE_URL.replace('https', 'wss') + `/status_update?token=${token}`;

        console.log(`API: WebSocket URL: ${wsUrl}`); // ❗️ 연결 URL 로그 추가

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WebSocket 연결 성공!");
            if (onOpenCallback) onOpenCallback();
        };

        ws.onmessage = (event) => {
            console.log("WebSocket 메시지 수신 (Raw):", event.data); // ❗️ 수신 확인용 로그
            if (onMessageCallback) onMessageCallback(event);
        };

        ws.onerror = (error) => {
            console.error("WebSocket 오류 발생:", error);
            if (onErrorCallback) onErrorCallback();
        };

        ws.onclose = () => {
            console.log("WebSocket 연결 종료.");
            // 오류 콜백을 다시 호출하여 재연결 로직을 트리거할 수 있습니다.
            if (onErrorCallback) onErrorCallback();
        };
    },
    
    getCongestionData: async function() {
        console.log('API: 혼잡도 데이터 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/statistics/congestion`, getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '혼잡도 데이터 로드 실패');
            }
            const serverData = await response.json(); // ❗️ 서버로부터 받은 원본 데이터

            console.log("API: 혼잡도 데이터 응답 (원본):", serverData);

            // ❗️ 서버 원본 데이터를 그대로 반환 (congestion.js에서 처리)
            return serverData;
        } catch (error) {
            console.error('API: 혼잡도 데이터 로드 실패:', error);
            throw error;
        }
    },

    // 10. (신규) 설문조사 제출 (POST)
    submitSurvey: async function(surveyData) {
        console.log('API: 설문조사 제출 요청 중...', surveyData);

        // 1. 데이터 타입 변환
        // survey.js는 폼에서 데이터를 문자열(예: "5")로 가져옵니다.
        // 하지만 web_schemas.py는 satisfaction을 정수(int)로 기대합니다.
        const payload = {
            satisfaction: parseInt(surveyData.satisfaction, 10),
            suggestion: surveyData.suggestion || "" // 빈 문자열 보장
        };

        // 2. 백엔드 스키마 유효성 검사 (1~5점)
        if (isNaN(payload.satisfaction) || payload.satisfaction < 1 || payload.satisfaction > 5) {
            console.error("API: 유효하지 않은 만족도 값:", surveyData.satisfaction);
            throw new Error('만족도 점수(1-5)가 올바르지 않습니다.');
        }

        try {
            // 3. /survey 엔드포인트로 POST 요청 (web_router.py 참조)
            const response = await fetch(`${API_BASE_URL}/survey`, getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '설문조사 제출 실패');
            }
            
            // 4. 성공 시 (web_router.py는 SurveyResponse({"message": "survey ok"}) 반환)
            return await response.json();

        } catch (error) {
            console.error('API: 설문조사 제출 실패:', error);
            throw error; // 에러를 survey.js로 전파하여 alert()가 실행되도록 함
        }
    },
    getPostById: async function(postId) {
        console.log(`API: 게시글 ${postId} 상세 정보 요청 중...`);
        try {
            // 백엔드에 GET /posts/{postId} 엔드포인트를 호출합니다.
            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 상세 로드 실패');
            }
            // board-detail.js는 {post: {...}, comments: [...]} 형식을 기대합니다.
            return await response.json(); 
        } catch (error) {
            console.error('API: 게시글 상세 로드 실패:', error);
            // board-detail.js가 에러를 처리할 수 있도록 {error: ...} 객체 반환
            return { error: error.message }; 
        }
    },

    // 12. (신규) 새 댓글 생성 (POST)
    createComment: async function(postId, content) {
        console.log(`API: 게시글 ${postId}에 댓글 작성 요청 중...`);
        try {
            // 백엔드에 POST /posts/{postId}/comments 엔드포인트를 호출합니다.
            const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, getFetchOptions('POST', {
                content: content // 백엔드는 {content: "..."} JSON을 받습니다.
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '댓글 작성 실패');
            }
            // board-detail.js는 새로 생성된 댓글 객체를 받습니다.
            return await response.json(); 
        } catch (error) {
            console.error('API: 댓글 작성 실패:', error);
            return { error: error.message };
        }
    },
    // 13. (신규) 게시글 좋아요 토글 (POST)
    toggleLike: async function(postId) {
        console.log(`API: 게시글 ${postId} 좋아요 토글 요청 중...`);
        try {
            // 백엔드에 POST /posts/{postId}/like 엔드포인트를 호출합니다.
            const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, getFetchOptions('POST'));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '좋아요 처리 실패');
            }
            // 백엔드가 반환한 최신 상태를 반환합니다.
            // (예: {like_count: 10, user_liked: true})
            return await response.json(); 
        } catch (error) {
            console.error('API: 좋아요 처리 실패:', error);
            return { error: error.message };
        }
    },
   // 14. (신규) 푸시 알림(FCM) 토큰 등록 (POST)
    registerPushToken: async function(fcmToken) {
        console.log('API: FCM 토큰 등록 요청 중...', fcmToken);
        
        // 1. 백엔드 web_schemas.py의 SetFcmTokenRequest 형식에 맞춤
        const payload = {
            fcm_token: fcmToken
        };

        try {
            // 2. web_router.py의 /set_fcm_token 엔드포인트 호출
            const response = await fetch(`${API_BASE_URL}/set_fcm_token`, getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'FCM 토큰 등록 실패');
            }
            
            // 3. 성공 시
            const result = await response.json();
            console.log("API: FCM 토큰 등록 성공:", result.message);
            return result;

        } catch (error) {
            console.error('API: FCM 토큰 등록 실패:', error);
            throw error; // 에러를 push.js로 전파
        }
    },

    // 15. (신규) 세탁기 알림 구독/취소 (POST /notify_me)
    toggleNotifyMe: async function(machineId, subscribe) {
        // subscribe가 true이면 isusing=1, false이면 isusing=0
        const payload = {
            machine_id: machineId,
            isusing: subscribe ? 1 : 0
        };
        console.log('API: 세탁기 알림 구독 토글 요청...', payload);

        try {
            // web_router.py의 /notify_me 엔드포인트 호출
            const response = await fetch(`${API_BASE_URL}/notify_me`, getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '알림 설정 실패');
            }
            
            // 성공 시 ({"message": "notify ok"})
            return await response.json();

        } catch (error) {
            console.error('API: 알림 설정 실패:', error);
            throw error;
        }
    },
    getAllAvailableRooms: async function() {
        console.log('API: 구독 가능한 모든 세탁실 목록 요청 중...');
        try {
            // 1단계에서 추가한 /all_rooms 엔드포인트 호출
            const response = await fetch(`${API_BASE_URL}/all_rooms`, getFetchOptions('GET'));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '전체 세탁실 로드 실패');
            }
            
            const data = await response.json();
            return data.rooms; // {rooms: [...]} 형식으로 가정

        } catch (error) {
            console.error('API: 전체 세탁실 로드 실패:', error);
            throw error;
        }
    },

    // 17. (신규) 특정 세탁실 구독하기 (POST /device_subscribe)
   subscribeToRoom: async function(roomId, isSubscribedInt) {
        console.log(`API: ${roomId}번 세탁실 구독 요청 (요청값: ${isSubscribedInt})`);
        
        // web_schemas.py의 DeviceSubscribeRequest 형식에 맞춤
        const payload = {
            room_id: parseInt(roomId, 10),
            issubscribed: isSubscribedInt // ❗️ 0 또는 1 전달
        };

        try {
            // web_router.py의 /device_subscribe 엔드포인트 호출
            const response = await fetch(`${API_BASE_URL}/device_subscribe`, getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '세탁실 구독 실패');
            }
            
            // ❗️ 백엔드가 반환하는 객체 전체를 반환 (e.g., {"message": "ok", "subscribed": true})
            return await response.json();

        } catch (error) {
            console.error('API: 세탁실 구독 실패:', error);
            throw error;
        }
    }
};