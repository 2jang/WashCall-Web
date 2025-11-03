// js/main.js
// ❗️ (최종 수정) WebSocket 메시지 처리 및 코스 시작 로직 포함, machine_id/machine_name 일치

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

// 2. main 함수 (async로 변경)
async function main() {
    console.log('WashCall WebApp 시작!');

    connectionStatusElement = document.getElementById('connection-status');
    updateConnectionStatus('connecting');

    // 3. try...catch로 /load API 에러 잡기
    try {
        const machines = await api.getInitialMachines();
        renderMachines(machines);

        // 4. '진짜' WebSocket 연결 (onOpen, onMessage, onError 콜백 전달)
        api.connect(
            () => updateConnectionStatus('success'), // ❗️ 1. onOpen
            (event) => handleSocketMessage(event), // ❗️ 2. onMessage: event 객체를 handleSocketMessage로 전달
            () => updateConnectionStatus('error') // ❗️ 3. onError
        );

    } catch (error) {
        console.error("초기 세탁기 목록 로드 실패:", error);
        updateConnectionStatus('error');
    }
}

/**
 * [수정 없음] 연결 상태를 UI에 표시하는 함수
 */
function updateConnectionStatus(status) {
    if (!connectionStatusElement) return;
    // (이전 코드와 동일)
    connectionStatusElement.className = 'status-alert';
    switch (status) {
        case 'connecting':
            connectionStatusElement.classList.add('info');
            connectionStatusElement.textContent = '서버와 연결을 시도 중...';
            connectionStatusElement.style.opacity = 1;
            break;
        case 'success':
            connectionStatusElement.classList.add('success');
            connectionStatusElement.textContent = '✅ 서버 연결 성공! 실시간 업데이트 중.';
            connectionStatusElement.style.opacity = 1;
            setTimeout(() => {
                connectionStatusElement.style.opacity = 0;
            }, 3000);
            break;
        case 'error':
            connectionStatusElement.classList.add('error');
            connectionStatusElement.textContent = '❌ 서버와의 연결이 끊어졌습니다. 5초 후 재연결 시도...';
            connectionStatusElement.style.opacity = 1;
            // TODO: 5초 후 재연결 로직 추가
            break;
    }
}

// WebSocket 메시지 처리 함수
function handleSocketMessage(event) {
    console.log("WebSocket 수신 (Raw):", event.data); // 서버-api.js에서도 로그 찍히지만, 여기도 남겨둡니다.

    try {
        const message = JSON.parse(event.data); // WebSocket 메시지는 JSON 문자열이므로 파싱해야 합니다.

        console.log("WebSocket 메시지 (Parsed):", message); // 파싱된 메시지 확인용 로그

        if (message.type === 'room_status') { // 서버에서 "type": "room_status"로 보낸다고 가정
            // 서버에서 보낸 메시지 구조에 따라 데이터를 추출합니다.
            const machineId = message.machine_id;
            const newStatus = message.status;

            console.log(`UI 업데이트 요청: Machine ID ${machineId}, New Status ${newStatus}`); // 업데이트 요청 로그

            // UI 업데이트 함수 호출
            updateMachineCard(machineId, newStatus);
        } else if (message.type === 'notify') {
            // 다른 종류의 알림 메시지 처리 (예: "세탁 완료 알림")
            console.log("알림 메시지:", message.payload.message);
            alert(message.payload.message); // 예시: 알림 팝업
        }
        // ... 필요한 다른 메시지 타입 처리 ...

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}


/**
 * ❗️ [수정 없음] 세탁기 카드 1개의 상태만 업데이트하는 함수 (machineId 사용)
 * @param {number} machineId - 상태가 변경된 기기 ID
 * @param {string} newStatus - 새 상태 (예: "FINISHED")
 */
function updateMachineCard(machineId, newStatus) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) {
        console.warn(`UI: Machine ID ${machineId}에 해당하는 카드 요소를 찾을 수 없습니다.`);
        return; // 화면에 없는 기기면 무시
    }

    console.log(`UI 업데이트 (ID: ${machineId}, 상태: ${newStatus})`);

    // 1. CSS 클래스 변경 (애니메이션 등 적용)
    card.className = 'machine-card'; // 기존 상태 클래스(status-washing 등) 초기화
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    // 2. 상태 텍스트 변경
    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    // 3. 타이머 텍스트 변경
    // (참고: '진짜' 서버는 timer 값을 보내주지 않으므로, 상태에 따라 임의로 표시)
    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            timerSpan.textContent = '세탁 완료!';
        } else {
            timerSpan.textContent = '대기 중';
        }
    }
}


/**
 * ❗️ [최종 수정] 세탁기 리스트 렌더링 (machine_id, machine_name 사용)
 * (api.getInitialMachines()가 '진짜'와 '가짜' 형식을 변환해 주므로 수정 불필요)
 */
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        machineDiv.className = 'machine-card';
        // ❗️ machine.status를 사용하여 CSS 클래스 추가
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        // ❗️ machine.machine_id를 사용하여 HTML ID 부여
        machineDiv.id = `machine-${machine.machine_id}`; 

        let displayTimerText = '대기 중';
        if (machine.status === 'WASHING' || machine.status === 'SPINNING') {
            displayTimerText = `작동 중...`; // 서버가 타이머를 주지 않으므로 임시 텍스트
        } else if (machine.status === 'FINISHED') {
            displayTimerText = '세탁 완료!';
        }

        // ❗️ machine.machine_name을 사용하여 이름 표시
        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;

        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            
            <div class="course-buttons">
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="울/섬세">울/섬세</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });
    addCourseButtonLogic(); // 함수 이름 변경: addTimerLogic -> addCourseButtonLogic
}

/**
 * ❗️ [수정 없음] 코스 선택 버튼 클릭 로직
 * 버튼 클릭 시 WebSocket 연결이 아닌, API.startCourse() 호출
 */
function addCourseButtonLogic() { // 함수 이름 변경
    document.querySelectorAll('.course-btn').forEach(btn => {
        btn.onclick = async (event) => { // ❗️ (async 확인)
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const courseName = event.target.dataset.courseName;

            try {
                // api.startCourse()를 호출하여 HTTP POST 요청을 보냅니다.
                // WebSocket 연결은 main() 함수에서 이미 이루어졌습니다.
                const result = await api.startCourse(machineId, courseName);
                console.log(`API: 코스 시작 요청 성공: ${JSON.stringify(result)}`);
                // UI 업데이트는 서버가 WebSocket 메시지를 통해 자동으로 수행할 것입니다.
            } catch (error) {
                console.error("API: 코스 시작 요청 실패:", error);
                alert(`코스 시작 실패: ${error.message}`);
            }
        };
    });
}

/**
 * (수정 없음) 유틸리티: 상태값 한글 번역
 */
function translateStatus(status) {
    switch (status) {
        case 'WASHING':
            return '세탁 중';
        case 'SPINNING':
            return '탈수 중';
        case 'FINISHED':
            return '세탁 완료';
        case 'AVAILABLE': // AVAILABLE 상태 추가 (서버에서 AVAILABLE로 보낼 수 있음)
            return '대기 중';
        case 'FAULT': // FAULT 상태 추가
            return '고장';
        case 'OFF':
            return '대기 중'; // OFF도 대기 중으로 처리
        default:
            return status;
    }
}