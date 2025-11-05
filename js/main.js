// js/main.js
// ❗️ ('일회성 알림' + '코스 타이머' + '버튼 비활성화' + '5초 재연결' 로직이 모두 포함된 최종본)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    // 1. 초기 세탁기 목록 로드
    try {
        updateConnectionStatus('connecting'); // (연결 시도 중... 표시)
        const machines = await api.getInitialMachines();
        renderMachines(machines);

        // 2. ❗️ [수정] 최초 웹소켓 연결 시도
        tryConnect();

    } catch (error) {
        console.error("초기 세탁기 목록 로드 실패:", error);
        updateConnectionStatus('error'); // (목록 로드 실패 시에도 '연결 끊김' 표시)
    }
}

/**
 * ❗️ [신규] WebSocket 연결 및 재연결 로직
 */
function tryConnect() {
    // 1. 'api.connect' 호출 시 3개의 콜백 함수를 전달
    api.connect(
        // 1A: (onOpen) 연결 성공 시
        () => {
            updateConnectionStatus('success');
        },
        
        // 1B: (onMessage) 메시지 수신 시
        (event) => {
            handleSocketMessage(event);
        },
        
        // 1C: (onError) 연결 실패 또는 끊김 시
        () => {
            // ❗️ UI 업데이트 (5초 후 재연결 시도... 텍스트 표시)
            updateConnectionStatus('error');
            
            // ❗️ [핵심] 5초 후에 이 함수('tryConnect')를 다시 호출
            setTimeout(() => {
                console.log("WebSocket 재연결 시도...");
                tryConnect();
            }, 5000); // 5초
        }
    );
}


// [수정 없음] 연결 상태 UI
function updateConnectionStatus(status) {
    if (!connectionStatusElement) return;
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
            // ❗️ (텍스트 수정 없음. 이 텍스트가 정확했음)
            connectionStatusElement.textContent = '❌ 서버와의 연결이 끊어졌습니다. 5초 후 재연결 시도...';
            connectionStatusElement.style.opacity = 1;
            break;
    }
}

// [수정 없음] WebSocket 메시지 처리 (일회성 알림 로직 포함)
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;

        if (message.type === 'room_status') {
            updateMachineCard(machineId, newStatus, null);
        } 
        else if (message.type === 'notify') {
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
        }

        if (newStatus === 'FINISHED') {
            await turnOffToggle(machineId);
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

// [수정 없음] 토글 자동 끄기 헬퍼
async function turnOffToggle(machineId) {
    const toggle = document.querySelector(`.notify-me-toggle[data-machine-id="${machineId}"]`);
    if (toggle && toggle.checked) {
        console.log(`알림 완료: ${machineId}번 세탁기 토글을 자동으로 끕니다.`);
        toggle.checked = false;
        try {
            await api.toggleNotifyMe(machineId, false);
        } catch (error) {
            console.error(`토글 ${machineId} 자동 끄기 서버 전송 실패:`, error);
        }
    }
}


// [수정 없음] updateMachineCard (버튼 비활성화 로직 포함)
function updateMachineCard(machineId, newStatus, newTimer = null) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    card.className = 'machine-card'; 
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        if (newTimer !== null && (newStatus === 'WASHING' || newStatus === 'SPINNING')) {
            timerSpan.textContent = `${newTimer}분 남음`;
        } else if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            timerSpan.textContent = '세탁 완료!';
        } else {
            timerSpan.textContent = '대기 중';
        }
    }

    const courseButtons = card.querySelectorAll('.course-btn');
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    courseButtons.forEach(btn => {
        btn.disabled = shouldBeDisabled;
    });
}

// [수정 없음] renderMachines (버튼 비활성화 로직 포함)
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        let displayTimerText = '대기 중';
        if (machine.status === 'WASHING' || machine.status === 'SPINNING') {
            displayTimerText = `작동 중...`; 
        } else if (machine.status === 'FINISHED') {
            displayTimerText = '세탁 완료!';
        }

        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING');
        const disabledAttribute = isDisabled ? 'disabled' : '';

        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        const isCurrentlyUsing = (machine.isusing === 1 || machine.isusing === true);
        const checkedAttribute = isCurrentlyUsing ? 'checked' : '';

        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            <div class="notify-me-container">
                <label class="switch">
                    <input type="checkbox" class="notify-me-toggle" data-machine-id="${machine.machine_id}" ${checkedAttribute}>
                    <span class="slider"></span>
                </label>
                <label class="notify-me-label">이 세탁기 알림 받기</label>
            </div>
            <div class="course-buttons">
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준" ${disabledAttribute}>표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속" ${disabledAttribute}>쾌속</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="울/섬세" ${disabledAttribute}>울/섬세</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });

    addCourseButtonLogic();
    addNotifyMeLogic();
}

// [수정 없음] 코스 버튼 로직 (UI 즉시 업데이트)
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(btn => {
        btn.onclick = async (event) => { 
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const courseName = event.target.dataset.courseName;
            
            updateMachineCard(machineId, 'WASHING', null);
            
            try {
                const result = await api.startCourse(machineId, courseName);
                
                if (result && result.timer) {
                    const status = result.status || 'WASHING';
                    updateMachineCard(machineId, status, result.timer);
                }
                
                console.log(`API: 코스 시작 요청 성공: ${JSON.stringify(result)}`);
            
            } catch (error) {
                console.error("API: 코스 시작 요청 실패:", error);
                alert(`코스 시작 실패: ${error.message}`);
                updateMachineCard(machineId, 'OFF', null);
            }
        };
    });
}

// [수정 없음] 개별 토글 로직 (FCM 로직 없음)
function addNotifyMeLogic() {
    document.querySelectorAll('.notify-me-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (event) => {
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const shouldSubscribe = event.target.checked; 

            if (shouldSubscribe && Notification.permission !== 'granted') {
                alert("먼저 '전체 알림 켜기' 버튼을 눌러 알림 권한을 허용해주세요.");
                event.target.checked = false; 
                return; 
            }

            try {
                await api.toggleNotifyMe(machineId, shouldSubscribe);
            } catch (error) {
                alert(`알림 설정 실패: ${error.message}`);
                event.target.checked = !shouldSubscribe; 
            }
        });
    });
}

// [수정 없음] 유틸리티: 상태값 한글 번역
function translateStatus(status) {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'FINISHED': return '세탁 완료';
        case 'OFF': return '대기 중';
        default: return status;
    }
}