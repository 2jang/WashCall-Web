// js/main.js
// ❗️ (notify 수신 처리 및 자동 해제 트리거 포함 최종본)

let connectionStatusElement;
let currentSelectedMachineId = null; 

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        
        const [machines] = await Promise.all([
            api.getInitialMachines(),
            loadCongestionTip() 
        ]);

        renderMachines(machines); 
        
        setupModalEvents();
        addGlobalClickListener();

        tryConnect(); 
    } catch (error) {
        console.error("초기화 오류:", error);
        updateConnectionStatus('error'); 
    }
}

async function loadCongestionTip() {
    const tipContainer = document.getElementById('congestion-tip-container');
    if (!tipContainer) return;
    try {
        const tipText = await api.getCongestionTip(); 
        if (tipText) {
            tipContainer.textContent = tipText; 
            tipContainer.style.display = 'flex'; 
        } else {
            tipContainer.style.display = 'none'; 
        }
    } catch (error) {
        console.warn("혼잡도 팁 로드 실패:", error);
        tipContainer.style.display = 'none';
    }
}

function tryConnect() {
    api.connect(
        () => {
            updateConnectionStatus('success');
        },
        (event) => {
            handleSocketMessage(event); 
        },
        () => {
            updateConnectionStatus('error');
            setTimeout(() => {
                console.log("WebSocket 재연결 시도...");
                tryConnect();
            }, 5000); 
        }
    );
}

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

async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 

        // 타이머 동기화 메시지 (구독 정보 없음 -> null)
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    const isSubscribed = null; // 서버 정보 없음
                    updateMachineCard(
                        machine.machine_id, 
                        machine.status, 
                        machine.timer, 
                        isSubscribed, 
                        machine.elapsed_time_minutes
                    );
                }
            }
            return; 
        }

        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; // 개별 알림도 구독 정보는 null
        const newElapsedMinutes = message.elapsed_time_minutes;

        // 🚀 [수정] 'room_status' 뿐만 아니라 'notify' 메시지도 처리
        if (message.type === 'room_status' || message.type === 'notify') { 
            
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes); 
            
            // 🚀 [신규] 완료 알림(FINISHED) 수신 시, 빈자리 알림 모드 자동 해제
            if (message.type === 'notify' && newStatus === 'FINISHED') {
                // push.js에 정의된 자동 해제 함수 호출
                if (typeof window.handleAutoUnsubscribe === 'function') {
                    const machineName = `세탁기 ${machineId}번`;
                    window.handleAutoUnsubscribe(machineName);
                }
            }
        }
        
    } catch (error) {
        console.error("WebSocket 오류:", error);
    }
}

// 🔄 카드 업데이트
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    // 1. 상태 데이터 갱신 (중요)
    card.dataset.status = newStatus;
    
    const machineType = card.dataset.machineType || 'washer';
    card.className = 'machine-card'; 
    card.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer'); 
    card.classList.add(`status-${newStatus ? newStatus.toLowerCase() : 'off'}`); 

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) statusStrong.textContent = translateStatus(newStatus, machineType);

    // 2. 타이머 UI 업데이트
    const timerDiv = card.querySelector('.timer-display');
    const timerTotalSpan = card.querySelector(`#timer-total-${machineId}`);
    const timerElapsedSpan = card.querySelector(`#timer-elapsed-${machineId}`);
    
    const isOperating = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');
    const hasTimer = (newTimer !== null && typeof newTimer === 'number');
    const hasElapsed = (newElapsedMinutes !== null && typeof newElapsedMinutes === 'number' && newElapsedMinutes >= 0);
    
    let totalTime = (hasTimer && hasElapsed) ? (newElapsedMinutes + newTimer) : null;
    const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);

    if (shouldShowTimer && timerDiv) {
        timerDiv.style.display = 'block';
        if (timerTotalSpan) timerTotalSpan.textContent = `약 ${totalTime}분`;
        
        let elapsedText = `${newElapsedMinutes}분 진행`;
        if (newStatus === 'SPINNING' && newElapsedMinutes === 0) elapsedText = `0분 진행 (탈수)`;
        if (timerElapsedSpan) timerElapsedSpan.textContent = elapsedText;
    } else if (timerDiv) {
        timerDiv.style.display = 'none';
    }

    // ❗️ [핵심] 구독 정보가 '명확하게(true/false)' 올 때만 dataset 변경
    if (isSubscribed === true) {
        card.dataset.isSubscribed = 'true';
    } else if (isSubscribed === false) {
        delete card.dataset.isSubscribed;
    } 
    // null이나 undefined면 기존 상태를 그대로 유지함
    
    // 3. 통합 UI 함수 호출
    if (typeof window.updateButtonUI === 'function') {
        window.updateButtonUI(card, newStatus);
    }
}

// 🔄 카드 렌더링
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        const machineType = machine.machine_type || 'washer'; 
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status ? machine.status.toLowerCase() : 'off'}`);
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.dataset.machineType = machineType; 
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        // 상태 데이터 저장
        machineDiv.dataset.status = machine.status;

        // 초기 구독 상태
        if (machine.isusing === 1) {
            machineDiv.dataset.isSubscribed = 'true';
        }

        // 타이머 초기값
        const isOperating = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerRemaining = machine.timer; 
        const elapsedMinutes = machine.elapsed_time_minutes;
        const hasTimer = (timerRemaining !== null && typeof timerRemaining === 'number');
        const hasElapsed = (elapsedMinutes !== null && typeof elapsedMinutes === 'number' && elapsedMinutes >= 0);
        let totalTime = (hasTimer && hasElapsed) ? (elapsedMinutes + timerRemaining) : null;
        const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);
        const timerDivStyle = shouldShowTimer ? '' : 'style="display: none;"';
        const displayTotalTime = shouldShowTimer ? `약 ${totalTime}분` : '';
        const displayElapsedTime = shouldShowTimer ? `${elapsedMinutes}분 진행` : '';
        
        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status, machineType)}</strong>
            </div>
            <div class="timer-display" ${timerDivStyle}>
                <div class="timer-row total-time">
                    <span>총 예상:</span><span id="timer-total-${machine.machine_id}">${displayTotalTime}</span>
                </div>
                <div class="timer-row">
                    <span>진행 시간:</span><span id="timer-elapsed-${machine.machine_id}">${displayElapsedTime}</span>
                </div>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" style="display: none;">
                🔔 세탁 시작
            </button>
            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" style="display: none;">
                🔔 완료 알림 받기
            </button>
        `;
        container.appendChild(machineDiv);

        // UI 초기화
        window.updateButtonUI(machineDiv, machine.status);
    });

    addNotifyStartLogic(); 
    addNotifyMeDuringWashLogic(); 
}

// 🚀 버튼 UI 통합 관리자
window.updateButtonUI = function(card, status) {
    const startButton = card.querySelector('.notify-start-btn');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');

    const isRoomSubscribed = localStorage.getItem('washcallRoomSubState') === 'true';
    const isLocalSubscribed = card.dataset.isSubscribed === 'true';
    
    const isOperating = (status === 'WASHING' || status === 'SPINNING' || status === 'DRYING');

    // 초기화
    if (courseButtonsDiv) courseButtonsDiv.style.display = 'none';
    if (startButton) {
        startButton.style.display = 'none';
        startButton.style.backgroundColor = ''; 
        startButton.disabled = false;
    }
    if (notifyMeButton) {
        notifyMeButton.style.display = 'none';
        notifyMeButton.style.backgroundColor = ''; 
        notifyMeButton.disabled = false;
    }

    if (isRoomSubscribed) {
        // [빈자리 알림 모드]
        if (isOperating) {
            if (notifyMeButton) {
                notifyMeButton.style.display = 'block';
                notifyMeButton.disabled = true;
                if (isLocalSubscribed) {
                    notifyMeButton.textContent = '✅ 알림 등록됨';
                } else {
                    notifyMeButton.textContent = "빈자리 알림 사용 중";
                    notifyMeButton.style.backgroundColor = '#6c757d';
                    notifyMeButton.style.borderColor = '#6c757d';
                }
            }
        } else {
            if (startButton) {
                startButton.style.display = 'block';
                startButton.disabled = true;
                startButton.textContent = "빈자리 알림 사용 중";
                startButton.style.backgroundColor = '#6c757d';
                startButton.style.borderColor = '#6c757d';
            }
        }
        return;
    }

    // [일반 모드]
    if (isOperating) {
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block';
            if (isLocalSubscribed) {
                notifyMeButton.textContent = '✅ 알림 등록됨 (해제)';
            } else {
                notifyMeButton.textContent = '🔔 완료 알림 받기';
            }
        }
    } else {
        if (startButton) {
            startButton.style.display = 'block';
            startButton.textContent = "🔔 세탁 시작";
        }
    }
}

// ... (기존 이벤트 핸들러들은 변경 없음) ...
function setupModalEvents() {
    const modal = document.getElementById('course-modal');
    const closeBtn = document.querySelector('.close-modal');
    const courseBtns = document.querySelectorAll('.modal-course-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            currentSelectedMachineId = null;
        };
    }
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            currentSelectedMachineId = null;
        }
    };
    courseBtns.forEach(btn => {
        btn.onclick = async () => {
            const courseName = btn.dataset.course;
            if (currentSelectedMachineId && courseName) {
                modal.style.display = 'none'; 
                await handleCourseSelection(currentSelectedMachineId, courseName);
            }
        };
    });
}

function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;
            const machineId = parseInt(btn.dataset.machineId, 10);
            const machineType = card.dataset.machineType || 'washer';
            if (machineType === 'washer') {
                currentSelectedMachineId = machineId;
                const modal = document.getElementById('course-modal');
                if (modal) modal.style.display = 'flex';
            } else {
                handleDryerStart(btn, card);
            }
        });
    });
}

function addGlobalClickListener() { }

async function handleCourseSelection(machineId, courseName) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return;
    const startButton = card.querySelector('.notify-start-btn');

    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "요청 중...";
    }

    try {
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
             const washerCards = document.querySelectorAll('.machine-type-washer');
            const tasks = [];
            washerCards.forEach(card => {
                const mid = parseInt(card.id.replace('machine-', ''), 10);
                if(mid) tasks.push(api.toggleNotifyMe(mid, false));
            });
            await Promise.all(tasks);
            localStorage.setItem('washcallRoomSubState', 'false');
            const masterBtn = document.getElementById('room-subscribe-button');
            if (masterBtn) {
                masterBtn.textContent = "🔔 빈자리 알림 받기";
                masterBtn.classList.remove('subscribed'); 
            }
            alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다.");
        }

        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
        if (tokenOrStatus === null) throw new Error("알림 거부됨");
        const token = tokenOrStatus;

        await Promise.all([
            api.registerPushToken(token),
            api.toggleNotifyMe(machineId, true),
            api.startCourse(machineId, courseName)
        ]);
        
        card.dataset.isSubscribed = 'true';
        window.updateButtonUI(card, 'WASHING'); 

        setTimeout(() => alert(`${courseName} 코스 알림이 등록되었습니다.`), 50);

    } catch (error) {
        alert(`시작 실패: ${error.message}`);
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        delete card.dataset.isSubscribed;
        window.updateButtonUI(card, 'OFF'); 
    }
}

async function handleDryerStart(clickedBtn, card) {
    const machineId = parseInt(clickedBtn.dataset.machineId, 10);
    if (!machineId) return;
    clickedBtn.disabled = true;
    clickedBtn.textContent = "요청 중...";

    try {
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
            const washerCards = document.querySelectorAll('.machine-type-washer');
            const tasks = [];
            washerCards.forEach(card => {
                const mid = parseInt(card.id.replace('machine-', ''), 10);
                if(mid) tasks.push(api.toggleNotifyMe(mid, false));
            });
            await Promise.all(tasks);
            localStorage.setItem('washcallRoomSubState', 'false');
            const masterBtn = document.getElementById('room-subscribe-button');
            if (masterBtn) {
                masterBtn.textContent = "🔔 빈자리 알림 받기";
                masterBtn.classList.remove('subscribed'); 
            }
            alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다.");
        }

        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
        if (tokenOrStatus === null) throw new Error("알림 거부됨");
        const token = tokenOrStatus;

        await Promise.all([
            api.registerPushToken(token),
            api.toggleNotifyMe(machineId, true),
            api.startCourse(machineId, 'DRYER')
        ]);
        
        card.dataset.isSubscribed = 'true';
        window.updateButtonUI(card, 'DRYING'); 

        setTimeout(() => alert(`건조기 알림이 등록되었습니다.`), 50);

    } catch (error) {
        alert(`시작 실패: ${error.message}`);
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        delete card.dataset.isSubscribed;
        window.updateButtonUI(card, 'OFF'); 
    }
}

function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);
            const card = btn.closest('.machine-card');
            
            const isCurrentlySubscribed = card.dataset.isSubscribed === 'true';
            btn.disabled = true;

            if (isCurrentlySubscribed) {
                // 취소
                btn.textContent = "취소 중...";
                try {
                    await api.toggleNotifyMe(machineId, false);
                    delete card.dataset.isSubscribed;
                    
                    const currentStatus = card.dataset.status || 'WASHING';
                    window.updateButtonUI(card, currentStatus);
                    
                    setTimeout(() => alert('알림이 취소되었습니다.'), 50);

                } catch (error) {
                    alert(`취소 실패: ${error.message}`);
                    window.updateButtonUI(card, 'WASHING'); 
                }
            } else {
                // 등록
                btn.textContent = "요청 중...";
                try {
                    const tokenOrStatus = await requestPermissionAndGetToken();
                    if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
                    if (tokenOrStatus === null) throw new Error("알림 거부됨");
                    const token = tokenOrStatus;
    
                    await Promise.all([
                        api.registerPushToken(token),
                        api.toggleNotifyMe(machineId, true)
                    ]);
                    
                    card.dataset.isSubscribed = 'true';
                    const currentStatus = card.dataset.status || 'WASHING';
                    window.updateButtonUI(card, currentStatus); 

                    setTimeout(() => alert('완료 알림이 등록되었습니다.'), 50);
    
                } catch (error) {
                    alert(`알림 등록 실패: ${error.message}`);
                    delete card.dataset.isSubscribed;
                    const currentStatus = card.dataset.status || 'WASHING';
                    window.updateButtonUI(card, currentStatus);
                }
            }
        });
    });
}

function translateStatus(status, machineType = 'washer') {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'DRYING': return '건조 중';
        case 'FINISHED': return (machineType === 'dryer') ? '건조 완료' : '세탁 완료'; 
        case 'OFF': return '대기 중';
        default: return status || '대기 중';
    }
}