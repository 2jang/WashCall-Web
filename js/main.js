// js/main.js
// ❗️ (timer_sync 수신 시 빈자리 알림 상태 유지 버그 수정)

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

        // 1. 1분마다 타이머 동기화
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    // timer_sync는 구독 정보가 없으므로 null 전달 (기존 상태 유지용)
                    const isSubscribed = null;
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

        // 2. 개별 상태 변경
        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 
        const newElapsedMinutes = message.elapsed_time_minutes;

        if (message.type === 'room_status') { 
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes); 
        }
        
    } catch (error) {
        console.error("WebSocket 오류:", error);
    }
}

// ❗️ [핵심] 이 함수가 주기적으로 호출될 때 빈자리 알림을 체크해야 합니다.
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    const machineType = card.dataset.machineType || 'washer';
    card.className = 'machine-card'; 
    card.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer'); 
    card.classList.add(`status-${newStatus.toLowerCase()}`); 

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) statusStrong.textContent = translateStatus(newStatus, machineType);

    // --- 타이머 로직 ---
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
        timerTotalSpan.textContent = `약 ${totalTime}분`;
        let elapsedText = `${newElapsedMinutes}분 진행`;
        if (newStatus === 'SPINNING' && newElapsedMinutes === 0) elapsedText = `0분 진행 (탈수)`;
        timerElapsedSpan.textContent = elapsedText;
    } else if (timerDiv) {
        timerDiv.style.display = 'none';
    }

    // ❗️ [여기!] 빈자리 알림이 켜져있는지 확인
    const isRoomSubscribed = localStorage.getItem('washcallRoomSubState') === 'true';

    const shouldBeDisabled = isOperating;
    const startButton = card.querySelector('.notify-start-btn');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');

    // 개별 구독 상태 동기화
    let finalIsSubscribed = false;
    if (isSubscribed === true) {
        finalIsSubscribed = true;
        card.dataset.isSubscribed = 'true';
    } else if (isSubscribed === false) {
        finalIsSubscribed = false;
        delete card.dataset.isSubscribed;
    } else {
        if (card.dataset.isSubscribed === 'true') finalIsSubscribed = true;
    }

    // --- 버튼 표시 로직 ---
    
    // 1. 빈자리 알림이 켜져있다면 -> 무조건 잠금 상태 유지
    if (isRoomSubscribed) {
        if (startButton) {
            startButton.style.display = 'block';
            startButton.disabled = true;
            startButton.textContent = "빈자리 알림 사용 중"; 
            startButton.style.opacity = "0.5";
        }
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none';
        
        if (notifyMeButton) {
            if (finalIsSubscribed) {
                 // 예외: 사용자가 이미 개별 알림을 등록한 경우엔 그것만 보여줌
                 notifyMeButton.style.display = 'block';
                 notifyMeButton.textContent = '✅ 알림 등록됨';
                 notifyMeButton.disabled = true;
            } else {
                 notifyMeButton.style.display = 'none';
            }
        }
        return; // ❗️ 여기서 함수 종료 (아래 로직 실행 안 함)
    }

    // 2. 빈자리 알림 꺼짐 -> 정상 로직
    if (finalIsSubscribed) {
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block'; 
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
    } else {
        if (shouldBeDisabled) {
             if (startButton) startButton.style.display = 'none';
             if (notifyMeButton) {
                notifyMeButton.style.display = 'block';
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
             }
        } else {
            if (notifyMeButton) notifyMeButton.style.display = 'none';
            
            const isMenuOpen = courseButtonsDiv && courseButtonsDiv.classList.contains('show-courses');
            if (isMenuOpen) {
                 if (startButton) startButton.style.display = 'none';
                 if (courseButtonsDiv) courseButtonsDiv.style.display = ''; 
            } else {
                 if (startButton) {
                     startButton.style.display = 'block';
                     startButton.disabled = false;
                     startButton.textContent = "🔔 세탁 시작"; // 텍스트 복구
                     startButton.style.opacity = "1";
                 }
                 if (courseButtonsDiv) courseButtonsDiv.style.display = 'none';
            }
        }
    }
}


function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    // 초기 렌더링 시에도 빈자리 알림 체크
    const isRoomSubscribed = localStorage.getItem('washcallRoomSubState') === 'true';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        const machineType = machine.machine_type || 'washer'; 
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.dataset.machineType = machineType; 
        machineDiv.id = `machine-${machine.machine_id}`; 
        if (machine.isusing === 1) machineDiv.dataset.isSubscribed = 'true';

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
        
        let showStartButton = false; 
        let showScenario_B = false;
        let startBtnDisabled = false;
        let startBtnText = "🔔 세탁 시작";
        let startBtnOpacity = "1";

        if (isRoomSubscribed) {
            // 🔴 빈자리 알림 켜짐 -> 잠금 상태로 렌더링
            showStartButton = true;
            startBtnDisabled = true;
            startBtnText = "빈자리 알림 사용 중";
            startBtnOpacity = "0.5";
            showScenario_B = false; 
        } else {
            const isDisabled = isOperating;
            const isSubscribed = (machine.isusing === 1);
            if (isSubscribed) {
                showStartButton = false; showScenario_B = true; 
            } else {
                if (isDisabled) {
                    showStartButton = false; showScenario_B = true;
                } else {
                    showStartButton = true; showScenario_B = false;
                }
            }
        }
        
        const scenarioB_DisabledAttr = (machine.isusing === 1) ? 'disabled' : '';
        const scenarioB_Text = (machine.isusing === 1) ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';
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
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" 
                ${showStartButton ? '' : 'style="display: none;"'}
                ${startBtnDisabled ? 'disabled' : ''}
                style="opacity: ${startBtnOpacity}; display: ${showStartButton ? 'block' : 'none'};">
                ${startBtnText}
            </button>
            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" 
                ${showScenario_B ? '' : 'style="display: none;"'} ${scenarioB_DisabledAttr}>
                ${scenarioB_Text}
            </button>
        `;
        container.appendChild(machineDiv);
    });

    addNotifyStartLogic(); 
    addNotifyMeDuringWashLogic(); 
}

// ... (setupModalEvents, handleCourseSelection, handleDryerStart 등 기존 함수 동일) ...
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
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');

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

        if (startButton) startButton.style.display = 'none';
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block';
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
        setTimeout(() => alert(`${courseName} 코스 알림이 등록되었습니다.`), 50);

    } catch (error) {
        alert(`시작 실패: ${error.message}`);
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        delete card.dataset.isSubscribed;
        if (startButton) {
            startButton.style.display = 'block';
            startButton.disabled = false;
            startButton.textContent = '🔔 세탁 시작';
        }
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
        clickedBtn.style.display = 'none'; 
        const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
        if (notifyMeButton) { 
            notifyMeButton.style.display = 'block';
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
        setTimeout(() => alert(`건조기 알림이 등록되었습니다.`), 50);

    } catch (error) {
        alert(`시작 실패: ${error.message}`);
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        delete card.dataset.isSubscribed;
        clickedBtn.disabled = false;
        clickedBtn.textContent = '🔔 세탁 시작';
    }
}

function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);
            const card = btn.closest('.machine-card');
            btn.disabled = true;
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
                
                if (card) card.dataset.isSubscribed = 'true';
                btn.textContent = '✅ 알림 등록됨';
                setTimeout(() => alert('완료 알림이 등록되었습니다.'), 50);

            } catch (error) {
                alert(`알림 등록 실패: ${error.message}`);
                if (card) delete card.dataset.isSubscribed;
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
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