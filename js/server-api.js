// js/server-api.js
// ❗️ (API_BASE_URL 정의가 상단에 위치하고, 401 만료 처리가 포함된 최종본)

// ❗️ [핵심 1] 변수 정의
// (api 객체보다 '반드시' 먼저 정의되어야 합니다)
const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const LOCAL_URL = "http://localhost:8000"; 
const PRODUCTION_URL = "https://server.washcall.space";
const API_BASE_URL = isLocal ? LOCAL_URL : PRODUCTION_URL;

console.log(`API Base URL: ${API_BASE_URL} (isLocal: ${isLocal})`);


// ❗️ [핵심 2] 헬퍼 함수 정의
// (api 객체보다 '반드시' 먼저 정의되어야 합니다)

function getAuthToken() {
    return localStorage.getItem('user_token');
}

function getFetchOptions(method, body = null, isFormData = false) {
    const token = getAuthToken();
    const headers = {
        'ngrok-skip-browser-warning': 'true'
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

/**
 * ❗️ 전역 Fetch 래퍼 (401 만료 처리)
 */
async function apiFetch(url, options) {
    const response = await fetch(url, options);

    if (response.status === 401) {
        if (!window.location.pathname.includes('login.html')) {
            localStorage.removeItem('user_token');
            alert('세션이 만료되었거나 인증에 실패했습니다. 다시 로그인해주세요.');
            window.location.href = 'login.html';
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || '인증 실패 (401)');
    }
    return response;
}

// ❗️ [핵심 3] api 객체 정의
// (모든 헬퍼 함수와 변수가 정의된 '후에' 선언됩니다)
const api = {
    // 1. 초기 세탁기 목록 가져오기
    getInitialMachines: async function() {
        console.log('API: "진짜" POST /load 요청 중...');
        try {
            // ❗️ API_BASE_URL 변수를 여기서 참조
            const response = await apiFetch(`${API_BASE_URL}/load`, getFetchOptions('POST'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '초기 세탁기 목록 로드 실패');
            }
            const data = await response.json();
            if (data && Array.isArray(data.machine_list)) { 
                return data.machine_list;
            } else {
                throw new Error('서버로부터 예상치 못한 형식의 세탁기 목록을 받았습니다.');
            }
        } catch (error) {
            console.error('API: 초기 세탁기 목록 로드 실패:', error);
            throw error;
        }
    },

    // 2. 세탁 코스 시작 (POST)
    startCourse: async function(machineId, courseName) {
        try {
            const response = await apiFetch(`${API_BASE_URL}/start_course`, getFetchOptions('POST', {
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

    // 3. 사용자 회원가입
    register: async function(username, studentId, password) { 
        try {
            const response = await apiFetch(`${API_BASE_URL}/register`, getFetchOptions('POST', {
                user_snum: parseInt(studentId, 10),
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

   // 4. 사용자 로그인
    login: async function(studentId, password) {
        console.log('API: 사용자 로그인 요청 중...');
        const payload = {
            user_snum: parseInt(studentId, 10),
            user_password: password,
            fcm_token: "TEMP_TOKEN_ON_LOGIN" 
        };
        try { 
            // ❗️ API_BASE_URL 변수를 여기서 참조 (오류 발생 지점)
            const response = await apiFetch(`${API_BASE_URL}/login`, getFetchOptions('POST', payload));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '로그인 실패');
            }
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            // ❗️ auth.js가 이 오류를 잡아서 표시
            console.error('API: 로그인 실패:', error); 
            throw error;
        }
    },

    // 5. WebSocket 연결
    connect: function(onOpenCallback, onMessageCallback, onErrorCallback) {
        console.log('API: "진짜" WebSocket에 연결합니다...');
        const token = getAuthToken();
        if (!token) {
            console.error("WebSocket 연결 실패: 토큰이 없습니다.");
            if (onErrorCallback) onErrorCallback();
            return;
        }
        // ❗️ API_BASE_URL 변수를 여기서 참조
        const wsUrl = API_BASE_URL.replace('https', 'wss').replace('http', 'ws') + `/status_update?token=${token}`;
        console.log(`API: WebSocket URL: ${wsUrl}`); 
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            console.log("WebSocket 연결 성공!");
            if (onOpenCallback) onOpenCallback();
        };
        ws.onmessage = (event) => {
            console.log("WebSocket 메시지 수신 (Raw):", event.data); 
            if (onMessageCallback) onMessageCallback(event);
        };
        ws.onerror = (error) => {
            console.error("WebSocket 오류 발생:", error);
            if (onErrorCallback) onErrorCallback();
        };
        ws.onclose = () => {
            console.log("WebSocket 연결 종료.");
            if (onErrorCallback) onErrorCallback();
        };
    },
    
    // 6. 혼잡도 데이터
    getCongestionData: async function() {
        try {
            const response = await apiFetch(`${API_BASE_URL}/statistics/congestion`, getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '혼잡도 데이터 로드 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 혼잡도 데이터 로드 실패:', error);
            throw error;
        }
    },

    // 7. 설문조사 제출
    submitSurvey: async function(surveyData) {
        const payload = {
            satisfaction: parseInt(surveyData.satisfaction, 10),
            suggestion: surveyData.suggestion || ""
        };
        if (isNaN(payload.satisfaction) || payload.satisfaction < 1 || payload.satisfaction > 5) {
            throw new Error('만족도 점수(1-5)가 올바르지 않습니다.');
        }
        try {
            const response = await apiFetch(`${API_BASE_URL}/survey`, getFetchOptions('POST', payload));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '설문조사 제출 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 설문조사 제출 실패:', error); 
            throw error; 
        }
    },

    // 14. FCM 토큰 등록
    registerPushToken: async function(fcmToken) {
        const payload = {
            fcm_token: fcmToken
        };
        try {
            const response = await apiFetch(`${API_BASE_URL}/set_fcm_token`, getFetchOptions('POST', payload));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'FCM 토큰 등록 실패');
            }
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API: FCM 토큰 등록 실패:', error);
            throw error; 
        }
    },

    // 15. '개별 토글' 함수
    toggleNotifyMe: async function(machineId, subscribe) {
        const payload = {
            machine_id: machineId,
            isusing: subscribe ? 1 : 0
        };
        try {
            const response = await apiFetch(`${API_BASE_URL}/notify_me`, getFetchOptions('POST', payload));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '알림 설정 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 알림 설정 실패:', error);
            throw error;
        }
    },

    // 16. 혼잡도 예측 팁 (GET /tip)
    getCongestionTip: async function() {
        try {
            const response = await apiFetch(`${API_BASE_URL}/tip`, getFetchOptions('GET')); 
            if (!response.ok) {
                const errorData = await response.json(); 
                throw new Error(errorData.detail || '혼잡도 팁 로드 실패');
            }
            const data = await response.json();
            const tipText = data.tip || data.message;
            
            if (typeof tipText === 'string' && tipText.length > 0) {
                return tipText;
            } else {
                return null;
            }
        } catch (error) {
            console.error('API: 혼잡도 팁 로드 실패:', error);
            return null; 
        }
    },

    // 17. '세탁실 알림 구독' (POST /reserve)
    reserveRoom: async function(roomId, isReservedInt) {
        const payload = {
            room_id: parseInt(roomId, 10),
            isreserved: isReservedInt
        };
        try {
            const response = await apiFetch(`${API_BASE_URL}/reserve`, getFetchOptions('POST', payload));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '세탁실 구독 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 세탁실 구독 실패:', error);
            throw error;
        }
    }
};