// js/server-api.js
// ❗️ WebSocket 연결, getInitialMachines, getCongestionData 함수가 포함된 최종 버전

// const API_BASE_URL = 'http://127.0.0.1:8000'; // 개발 환경
const API_BASE_URL = 'https://unconical-kyong-frolicsome.ngrok-free.dev'; // ❗️ 운영 환경 (ngrok 주소)

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
    register: async function(studentId, password, username) { // ❗️ username 추가
        console.log('API: 사용자 회원가입 요청 중...');
        try {
            const response = await fetch(`${API_BASE_URL}/register`, getFetchOptions('POST', {
                user_id: studentId,
                user_password: password,
                user_username: username // ❗️ username 전달
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
    login: async function(studentId, password) {
        console.log('API: 사용자 로그인 요청 중...');
        const formData = new URLSearchParams();
        formData.append('username', studentId); // FastAPI의 OAuth2Form은 'username' 필드를 기대
        formData.append('password', password);

        try {
            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'ngrok-skip-browser-warning': 'true'  // ngrok 경고 페이지 우회
                },
                body: formData.toString()
            });

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

            // ❗️ [핵심 수정]: 서버 데이터를 Chart.js 형식으로 변환
            const labels = []; // 시간대 레이블 (예: "00시", "01시", ...)
            for (let i = 0; i < 24; i++) { // 하루 24시간을 기준으로 레이블 생성
                labels.push(`${i.toString().padStart(2, '0')}시`);
            }

            const datasets = [];
            const colors = { // 각 요일별 차트 색상 (원하는대로 추가/변경 가능)
                "월": { borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)' },
                "화": { borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)' },
                "수": { borderColor: 'rgba(255, 206, 86, 1)', backgroundColor: 'rgba(255, 206, 86, 0.2)' },
                "목": { borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)' },
                "금": { borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)' },
                "토": { borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.2)' },
                "일": { borderColor: 'rgba(199, 199, 199, 1)', backgroundColor: 'rgba(199, 199, 199, 0.2)' },
            };


            for (const day in serverData) { // "월", "화", ... 요일을 순회
                if (Object.hasOwnProperty.call(serverData, day)) {
                    const congestionValues = serverData[day]; // 각 요일의 혼잡도 배열
                    
                    // Chart.js datasets 형식에 맞게 변환
                    datasets.push({
                        label: day, // 요일을 레이블로 사용 (예: "월")
                        data: congestionValues,
                        borderColor: colors[day] ? colors[day].borderColor : 'rgba(0, 0, 0, 1)', // 색상 적용 또는 기본값
                        backgroundColor: colors[day] ? colors[day].backgroundColor : 'rgba(0, 0, 0, 0.2)',
                        fill: false, // 선 그래프로 표시
                        tension: 0.1 // 부드러운 선
                    });
                }
            }

            const chartJsData = { labels, datasets };
            console.log("API: Chart.js 변환 데이터:", chartJsData);

            return chartJsData; // 변환된 데이터를 반환
        } catch (error) {
            console.error('API: 혼잡도 데이터 로드 실패:', error);
            throw error;
        }
    }
};