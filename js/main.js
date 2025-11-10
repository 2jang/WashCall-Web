// js/main.js
// ❗️ ('개별 알림 토글' 로직이 '전부 삭제'되고, '세탁실 구독' 방식으로 변경된 최종본)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

// [수정 없음] main 함수 (tryConnect 호출)
async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        const machines = await api.getInitialMachines();
        renderMachines(machines); // ❗️ 수정된 함수가 연결됨
        tryConnect(); // 웹소켓 연결 시작
    } catch (error) {
        console.error("초기 세탁기 목록 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

// [수정 없음] tryConnect (5초 재연결 로직)
function tryConnect() {
    api.connect(
        () => {
            updateConnectionStatus('success');
        },
        (event) => {
            handleSocketMessage(event); // ❗️ 수정된 함수가 연결됨
        },
        () => {
            updateConnectionStatus('error');
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
            connectionStatusElement.textContent = '❌ 서버와의 연결이 끊어졌습니다. 5초 후 재연결 시도...';
            connectionStatusElement.style.opacity = 1;
            break;
    }
}

/**
 * ❗️ [핵심 수정] WebSocket 메시지 처리 (개별 토글 로직 '삭제')
 */
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;

        // (서버 팀이 타이머를 보낸다면 이 로직은 유효함)
        const newTimer = message.timer || null; 

        if (message.type === 'room_status') {
            updateMachineCard(machineId, newStatus, newTimer);
        } 
        else if (message.type === 'notify') {
            // (서버 팀이 /reserve 기반으로 알림을 보낸다면, 이 'notify' 타입이 사용될 것임)
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
            updateMachineCard(machineId, newStatus, newTimer);
        }

        // ❗️ [삭제] 'FINISHED'일 때 토글을 끄는 로직 제거
        // (이제 서버가 /reserve 상태를 0으로 바꿔야 함)

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

// ❗️ [삭제] turnOffToggle 헬퍼 함수 제거


/**
 * ❗️ [수정] updateMachineCard (버튼 활성화/비활성화 로직 '유지')
 * (코스 버튼 비활성화는 여전히 유효한 기능임)
 */
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
        if (newTimer !== null && newTimer > 0 && (newStatus === 'WASHING' || newStatus === 'SPINNING')) {
            timerSpan.textContent = `${newTimer}분 남음`;
        } else if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            timerSpan.textContent = '세탁 완료!';
        } else {
            timerSpan.textContent = '대기 중';
        }
    }

    // (코스 버튼 비활성화 로직은 '유지')
    const courseButtons = card.querySelectorAll('.course-btn');
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    courseButtons.forEach(btn => {
        btn.disabled = shouldBeDisabled;
        if (!shouldBeDisabled) {
            btn.textContent = btn.dataset.courseName; 
        }
    });
}

/**
 * ❗️ [핵심 수정] renderMachines ('개별 토글' HTML '삭제')
 */
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
        const machineTimer = machine.timer;

        if ((machine.status === 'WASHING' || machine.status === 'SPINNING')) {
            if (machineTimer !== null && machineTimer !== undefined && machineTimer > 0) {
                displayTimerText = `${machineTimer}분 남음`;
            } else {
                displayTimerText = '작동 중...'; 
            }
        } else if (machine.status === 'FINISHED') {
            displayTimerText = '세탁 완료!';
        }

        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING');
        const disabledAttribute = isDisabled ? 'disabled' : '';

        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        
        // ❗️ [수정] 개별 토글 HTML 제거
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            
            <div class="course-buttons" style="${isDisabled ? 'display: none;' : 'display: flex;'}">
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준" ${disabledAttribute}>표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속" ${disabledAttribute}>쾌속</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="울/섬세" ${disabledAttribute}>울/섬세</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });

    addCourseButtonLogic();
    // ❗️ [삭제] addNotifyMeLogic() 호출 제거
}

// [수정 없음] 코스 버튼 로직 (API 호출만 하고 UI 상태 변경 안 함)
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = document.getElementById(`machine-${machineId}`);
            if (!card) return;
            const allButtonsOnCard = card.querySelectorAll('.course-btn');

            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                await api.startCourse(machineId, courseName);
                console.log(`API: 코스 시작 요청 성공 (서버에 알림)`);
                // (API 성공 시, 버튼은 비활성화 상태 '유지')
            } catch (error) {
                console.error("API: 코스 시작 요청 실패:", error);
                alert(`코스 시작 실패: ${error.message}`);
                // (롤백) '실패' 시에만 모든 버튼을 다시 활성화
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
            }
        };
    });
}

// ❗️ [삭제] addNotifyMeLogic 함수 제거

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