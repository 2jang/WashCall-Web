// js/main.js
// ❗️ (timer_sync가 UI를 초기화하는 버그 수정)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

async function main() {
    console.log('WashCall WebApp 시작!');
    
    // Service Worker 등록 (PWA 설치 조건 필수)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then((reg) => console.log('Service Worker Registered:', reg))
            .catch((err) => console.log('Service Worker Registration Failed:', err));
    }

    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        
        // ❗️ [필수] /load API가 'elapsed_time_minutes'를 반환해야 함
        const [machines] = await Promise.all([
            api.getInitialMachines(),
            loadCongestionTip() 
        ]);

        renderMachines(machines); 
        tryConnect(); 
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

async function loadCongestionTip() {
    // ... (이전과 동일) ...
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
        console.warn("혼잡도 팁을 불러오는 데 실패했습니다:", error);
        tipContainer.style.display = 'none';
    }
}

function tryConnect() {
    api.connect(
        // ... (이전과 동일) ...
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
    // ... (이전과 동일) ...
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

// ❗️ [수정] handleSocketMessage (timer_sync 버그 수정)
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 

        // 1. 1분마다 타이머 동기화
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    
                    // ❗️ [버그 수정]
                    // timer_sync 페이로드에는 'isusing' 값이 없습니다.
                    // 'undefined'가 'false'로 변환되어 UI를 초기화시키는 버그가 있었습니다.
                    // 'isSubscribed'를 'null'로 전달하여 버튼 상태를 건드리지 않도록 합니다.
                    const isSubscribed = null;
                    
                    updateMachineCard(
                        machine.machine_id, 
                        machine.status, 
                        machine.timer, // 남은 시간 (총 시간 계산용)
                        isSubscribed,  // ❗️ null로 변경
                        machine.elapsed_time_minutes // ❗️ 경과 시간
                    );
                }
            }
            return; 
        }

        // 2. 개별 상태 변경 (room_status만 처리)
        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 
        const newElapsedMinutes = message.elapsed_time_minutes;

        if (message.type === 'room_status') { 
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes); 
        }
        
    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}


/**
 * ❗️ [수정] updateMachineCard ("계산 중..." 숨김 로직 강화)
 */
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    const machineType = card.dataset.machineType || 'washer';

    card.className = 'machine-card'; 
    card.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer'); 
    card.classList.add(`status-${newStatus.toLowerCase()}`); 

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus, machineType);
    }

    // --- ❗️ [수정] 타이머 로직 ("계산 중..." 숨김 강화) ---
    const timerDiv = card.querySelector('.timer-display');
    const timerTotalSpan = card.querySelector(`#timer-total-${machineId}`);
    const timerElapsedSpan = card.querySelector(`#timer-elapsed-${machineId}`);

    const isOperating = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');
    
    // ❗️ [수정] 두 값이 모두 유효한 숫자인지 명확하게 확인
    const hasTimer = (newTimer !== null && typeof newTimer === 'number');
    const hasElapsed = (newElapsedMinutes !== null && typeof newElapsedMinutes === 'number' && newElapsedMinutes >= 0);
    const canShowTimer = isOperating && hasTimer && hasElapsed;

    if (canShowTimer && timerDiv && timerTotalSpan && timerElapsedSpan) {
        
        const totalTime = newElapsedMinutes + newTimer;

        // ❗️ [수정] 0분일 때도 숨김 처리 (기존 로직 유지)
        if (totalTime <= 0) {
             timerDiv.style.display = 'none';
        } else {
            // (정상 표시)
            timerDiv.style.display = 'block';
            
            const totalText = `약 ${totalTime}분`;
            timerTotalSpan.textContent = totalText;

            let elapsedText = `${newElapsedMinutes}분 진행`;
            if (newStatus === 'SPINNING' && newElapsedMinutes === 0) {
                elapsedText = `0분 진행 (탈수)`;
            }
            timerElapsedSpan.textContent = elapsedText;
        }

    } else if (timerDiv) {
        timerDiv.style.display = 'none'; // 작동 중이 아니거나, 값이 null이면 숨김
    }
    // --- ❗️ 타이머 로직 끝 ---

    const shouldBeDisabled = isOperating;
    
    // ... (이하 버튼 로직은 이전과 동일) ...
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    const courseButtons = card.querySelectorAll('.course-btn');

    // ❗️ [수정] isSubscribed 상태를 버튼 로직에서 명시적으로 처리
    if (isSubscribed === true) {
        // [1. 구독 상태가 true로 강제됨 (timer_sync 또는 새로고침)]
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block'; 
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
    } else if (isSubscribed === false) {
        // [2. 구독 상태가 false로 강제됨 (timer_sync)]
        if (shouldBeDisabled) {
             if (notifyMeButton) {
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
             }
        } else {
            if (startButton) startButton.style.display = 'block';
            if (machineType === 'washer' && courseButtonsDiv) {
                courseButtonsDiv.style.display = '';
                courseButtonsDiv.classList.remove('show-courses');
            }
            if (notifyMeButton) notifyMeButton.style.display = 'none';
        }
    } else {
        // [3. isSubscribed가 null (room_status 또는 ❗️timer_sync)]
        // (버튼 상태는 그대로 두고, 작동/대기 상태만 변경)
        if (shouldBeDisabled) {
            if (startButton) startButton.style.display = 'none'; 
            if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
            if (notifyMeButton) notifyMeButton.style.display = 'block'; 
        } else {
            if (startButton) startButton.style.display = 'block';
            if (machineType === 'washer' && courseButtonsDiv) {
                courseButtonsDiv.style.display = '';
                courseButtonsDiv.classList.remove('show-courses');
            }
            if (notifyMeButton) notifyMeButton.style.display = 'none'; 
        }
    }
}


/**
 * ❗️ [수정] renderMachines ("계산 중..." 숨김 로직 강화)
 */
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        
        const machineType = machine.machine_type || 'washer'; 
        
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.dataset.machineType = machineType; 
        
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        // --- ❗️ [수정] 타이머 텍스트 계산 ('남은 시간' 제거) ---
        const isOperating = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        
        const timerRemaining = machine.timer;  // (남은 시간)
        const elapsedMinutes = machine.elapsed_time_minutes; // ❗️ (서버가 보내줘야 함)
        
        // ❗️ [수정] 두 값이 모두 유효한 숫자인지 명확하게 확인
        const hasTimer = (timerRemaining !== null && typeof timerRemaining === 'number');
        const hasElapsed = (elapsedMinutes !== null && typeof elapsedMinutes === 'number' && elapsedMinutes >= 0);
        let totalTime = (hasTimer && hasElapsed) ? (elapsedMinutes + timerRemaining) : null;

        // ❗️ [수정] totalTime이 null이거나 0 이하면 숨김
        const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);
        const timerDivStyle = shouldShowTimer ? '' : 'style="display: none;"';

        const displayTotalTime = (totalTime !== null && totalTime > 0) ? `약 ${totalTime}분` : '';
        const displayElapsedTime = (elapsedMinutes !== null && elapsedMinutes >= 0) ? `${elapsedMinutes}분 진행` : '';
        // --- ❗️ 계산 끝 ---

        
        // --- ❗️ [버그 수정] 버튼 표시 로직 (이전과 동일) ---
        const isDisabled = isOperating;
        const isSubscribed = (machine.isusing === 1);
        
        let showStartButton, showCourseButtons, showScenario_B;

        if (isSubscribed) {
            showStartButton = false;
            showCourseButtons = false;
            showScenario_B = true; 
        } else {
            if (isDisabled) {
                showStartButton = false;
                showCourseButtons = false;
                showScenario_B = true;
            } else {
                showStartButton = true;
                showCourseButtons = (!isDisabled && machineType === 'washer');
                showScenario_B = false;
            }
        }
        
        const scenarioB_DisabledAttr = isSubscribed ? 'disabled' : '';
        const scenarioB_Text = isSubscribed ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';
        // --- ❗️ 로직 수정 끝 ---

        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        // --- ❗️ [수정] HTML 템플릿 ('남은 시간' 제거) ---
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status, machineType)}</strong>
            </div>
            
            <div class="timer-display" ${timerDivStyle}>
                <div class="timer-row total-time">
                    <span>총 예상:</span>
                    <span id="timer-total-${machine.machine_id}">${displayTotalTime}</span>
                </div>
                <div class="timer-row">
                    <span>진행 시간:</span>
                    <span id="timer-elapsed-${machine.machine_id}">${displayElapsedTime}</span>
                </div>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" ${showStartButton ? '' : 'style="display: none;"'}>
                🔔 알림 받고 시작
            </button>
            <div class="course-buttons" ${showCourseButtons ? '' : 'style="display: none;"'}>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="강력">강력</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
            </div>

            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" ${showScenario_B ? '' : 'style="display: none;"'} ${scenarioB_DisabledAttr}>
                ${scenarioB_Text}
            </button>
        `;
        container.appendChild(machineDiv);
    });

    // 이벤트 리스너 연결 (이전과 동일)
    addNotifyStartLogic(); 
    addCourseButtonLogic(); 
    addNotifyMeDuringWashLogic(); 
}

/**
 * "알림 받고 시작" 버튼 로직 (그대로)
 */
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;

            const machineType = card.dataset.machineType || 'washer';
            
            if (machineType === 'washer') {
                const courseButtonsDiv = card.querySelector('.course-buttons');
                if (courseButtonsDiv) {
                    courseButtonsDiv.classList.add('show-courses');
                }
                btn.style.display = 'none'; 
            } else {
                handleDryerStart(btn, card); // 건조기 로직
            }
        });
    });
}

/**
 * ❗️ [수정] 건조기 시작 로직 (속도 개선)
 */
async function handleDryerStart(clickedBtn, card) {
    const machineId = parseInt(clickedBtn.dataset.machineId, 10);
    if (!machineId) return;

    clickedBtn.disabled = true;
    clickedBtn.textContent = "요청 중...";

    try {
        // ... (빈자리 알림 끄기 로직 - 이전과 동일) ...
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
            console.log("중복 방지: '빈자리 알림'을 끕니다.");
            const washerCards = document.querySelectorAll('.machine-type-washer');
            const tasks = [];
            washerCards.forEach(card => {
                const mid = parseInt(card.id.replace('machine-', ''), 10);
                if(mid) tasks.push(api.toggleNotifyMe(mid, false));
            });
            await Promise.all(tasks); // ❗️ 병목 지점 1
            localStorage.setItem('washcallRoomSubState', 'false');
            const masterBtn = document.getElementById('room-subscribe-button');
            if (masterBtn) {
                masterBtn.textContent = "🔔 빈자리 알림 받기";
                masterBtn.classList.remove('subscribed'); 
            }
            alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다."); // ❗️ (이 alert는 유지)
        }

        // ... (FCM 토큰 발급 - 이전과 동일) ...
        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') {
            throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
        } else if (tokenOrStatus === null) {
            throw new Error('알림 권한이 거부되었습니다.'); 
        }
        
        const token = tokenOrStatus;

        // ❗️ [수정] 3개의 API를 병렬(동시)로 처리하여 속도 개선
        await Promise.all([
            api.registerPushToken(token),
            api.toggleNotifyMe(machineId, true),
            api.startCourse(machineId, 'DRYER')
        ]);
        
        console.log(`API: 건조기 시작 및 알림 구독 성공 (병렬 처리)`);
        
        // ❗️ [수정] alert() 제거
        // alert(`건조기 알림이 등록되었습니다.`);
        
        // (수동 UI 전환)
        clickedBtn.style.display = 'none'; 
        const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
        if (notifyMeButton) { 
            notifyMeButton.style.display = 'block';
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }

    } catch (error) {
        // ... (실패 시 롤백 로직 - 이전과 동일) ...
        console.error("API: 건조기 시작/알림 등록 실패:", error);
        alert(`시작 실패: ${error.message}`);
        try {
            await api.toggleNotifyMe(machineId, false);
            console.log("롤백: 알림 구독 취소 완료");
        } catch (rollbackError) {
            console.error("롤백 실패 (구독 취소):", rollbackError);
        }
        clickedBtn.disabled = false;
        clickedBtn.textContent = '🔔 알림 받고 시작';
    }
}


/**
 * ❗️ [수정] 코스 버튼 로직 (속도 개선)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = clickedBtn.closest('.machine-card');
            if (!card) return;

            const startButton = card.querySelector('.notify-start-btn');
            const courseButtonsDiv = card.querySelector('.course-buttons');
            const allButtonsOnCard = card.querySelectorAll('.course-btn');

            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // ... (빈자리 알림 끄기 로직 - 이전과 동일) ...
                const roomSubState = localStorage.getItem('washcallRoomSubState');
                if (roomSubState === 'true') {
                    console.log("중복 방지: '빈자리 알림'을 끕니다.");
                    const washerCards = document.querySelectorAll('.machine-type-washer');
                    const tasks = [];
                    washerCards.forEach(card => {
                        const mid = parseInt(card.id.replace('machine-', ''), 10);
                        if(mid) tasks.push(api.toggleNotifyMe(mid, false));
                    });
                    await Promise.all(tasks); // ❗️ 병목 지점 1
                    localStorage.setItem('washcallRoomSubState', 'false');
                    const masterBtn = document.getElementById('room-subscribe-button');
                    if (masterBtn) {
                        masterBtn.textContent = "🔔 빈자리 알림 받기";
                        masterBtn.classList.remove('subscribed'); 
                    }
                    alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다."); // ❗️ (이 alert는 유지)
                }

                // ... (FCM 토큰 발급 - 이전과 동일) ...
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                const token = tokenOrStatus;

                // ❗️ [수정] 3개의 API를 병렬(동시)로 처리하여 속도 개선
                await Promise.all([
                    api.registerPushToken(token),
                    api.toggleNotifyMe(machineId, true),
                    api.startCourse(machineId, courseName)
                ]);
                
                console.log(`API: 코스 시작 및 알림 구독 성공 (병렬 처리)`);
                
                // ❗️ [수정] alert() 제거
                // alert(`${courseName} 코스 알림이 등록되었습니다.`);

                // (수동 UI 전환)
                if (courseButtonsDiv) courseButtonsDiv.style.display = 'none';
                if (startButton) startButton.style.display = 'none';
                const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
                if (notifyMeButton) {
                    notifyMeButton.style.display = 'block';
                    notifyMeButton.textContent = '✅ 알림 등록됨';
                    notifyMeButton.disabled = true;
                }

            } catch (error) {
                // ... (실패 시 롤백 로직 - 이전과 동일) ...
                console.error("API: 코스 시작/알림 등록 실패:", error);
                alert(`시작 실패: ${error.message}`);
                try {
                    await api.toggleNotifyMe(machineId, false);
                    console.log("롤백: 알림 구독 취소 완료");
                } catch (rollbackError) {
                    console.error("롤백 실패 (구독 취소):", rollbackError);
                }
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
                if (startButton) startButton.style.display = 'block';
                if (courseButtonsDiv) courseButtonsDiv.classList.remove('show-courses');
            }
        };
    });
}

/**
 * ❗️ [수정] "완료 알림 받기" 버튼 로직 (속도 개선)
 */
function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
                // ... (FCM 토큰 발급 - 이전과 동일) ...
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                const token = tokenOrStatus;

                // ❗️ [수정] 2개의 API를 병렬(동시)로 처리
                await Promise.all([
                    api.registerPushToken(token),
                    api.toggleNotifyMe(machineId, true)
                ]);

                btn.textContent = '✅ 알림 등록됨';
                
                // ❗️ [수정] alert() 제거
                // alert('완료 알림이 등록되었습니다.');

            } catch (error) {
                // ... (실패 시 롤백 로직 - 이전과 동일) ...
                console.error("API: '세탁 중' 알림 등록 실패:", error);
                alert(`알림 등록 실패: ${error.message}`);
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
            }
        });
    });
}


// (유틸리티 함수 - 이전과 동일)
function translateStatus(status, machineType = 'washer') {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'DRYING': return '건조 중';
        case 'FINISHED':
            return (machineType === 'dryer') ? '건조 완료' : '세탁 완료'; 
        case 'OFF': return '대기 중';
        default: return status;
    }
}

// ❗️ [삭제] formatTimer 함수는 더 이상 사용되지 않습니다.