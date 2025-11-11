// js/main.js
// ❗️ (Error 2, 3이 모두 수정된 최종본)

let connectionStatusElement;

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
            loadCongestionTip() // (아이디어 2)
        ]);

        renderMachines(machines); 
        tryConnect(); 
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
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
        console.warn("혼잡도 팁을 불러오는 데 실패했습니다:", error);
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

        // 1. 1분마다 타이머 동기화 (배열 순회)
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    const isSubscribed = machine.isusing === 1;
                    updateMachineCard(machine.machine_id, machine.status, machine.timer, isSubscribed);
                }
            }
            return; 
        }

        // 2. 개별 상태 변경
        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 

        if (message.type === 'room_status' || message.type === 'notify') {
            if (message.type === 'notify') {
                const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
                alert(msg); 
            }
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed); 
        }

        // 3. FINISHED 상태일 때 후처리
        if (newStatus === 'FINISHED') {
            
            console.log(`알림 완료: ${machineId}번 세탁기 자동 구독을 취소합니다.`);
            try {
                await api.toggleNotifyMe(machineId, false);
            } catch (e) {
                console.warn(`자동 구독 취소 실패 (Machine ${machineId}):`, e.message);
            }
            
            const STORAGE_KEY = 'washcallRoomSubState';
            if (localStorage.getItem(STORAGE_KEY) === 'true') {
                localStorage.setItem(STORAGE_KEY, 'false'); 
                const masterBtn = document.getElementById('room-subscribe-button');
                if (masterBtn) {
                    masterBtn.textContent = "🔔 세탁실 알림 받기";
                    masterBtn.classList.remove('subscribed'); 
                }
            }
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}


/**
 * ❗️ [핵심 수정] updateMachineCard (활성화/내용 버그 수정)
 * (FINISHED 상태일 때 버튼 활성화(disabled=false) 및 텍스트를 리셋)
 */
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed) {
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
        timerSpan.textContent = formatTimer(newTimer, newStatus);
    }

    // [수정] 버튼 비활성화/숨김 로직
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    // (시나리오 A 버튼)
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    // (시나리오 B 버튼)
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    
    // ❗️ (버그 수정용) 코스 버튼 목록을 미리 찾아둠
    const courseButtons = card.querySelectorAll('.course-btn');

    if (shouldBeDisabled) {
        // 1. 작동 중일 때 (시나리오 B)
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block'; 

            if (isSubscribed === true) {
                notifyMeButton.textContent = '✅ 알림 등록됨';
                notifyMeButton.disabled = true;
            } else if (isSubscribed === false) {
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
            }
        }
        
    } else {
        // 2. 대기/완료 상태일 때 (시나리오 A)
        if (startButton) startButton.style.display = 'block'; 
        if (courseButtonsDiv) {
            courseButtonsDiv.classList.remove('show-courses'); 
            courseButtonsDiv.style.display = ''; // (Error 3: 목록 안 뜸 해결)
        }
        if (notifyMeButton) notifyMeButton.style.display = 'none'; 
        
        // ❗️ [버그 수정] "활성화" 및 "내용" 리셋 (Error 1, 2 해결)
        // (FINISHED/OFF가 되면 버튼 상태를 완전히 초기화)
        if (courseButtons) {
            courseButtons.forEach(btn => {
                btn.disabled = false; // "활성화"
                btn.textContent = btn.dataset.courseName; // "내용" (예: "✅ 알림 등록됨" -> "표준")
            });
        }
    }
}
/**
 * ❗️ [수정] renderMachines (UI 변경)
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
        
        const displayTimerText = formatTimer(machine.timer, machine.status);
        
        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING');
        const isSubscribed = (machine.isusing === 1);
        
        const hideWhenDisabled = isDisabled ? 'style="display: none;"' : '';
        const showWhenDisabled = isDisabled ? '' : 'style="display: none;"';
        const scenarioB_DisabledAttr = isSubscribed ? 'disabled' : '';
        const scenarioB_Text = isSubscribed ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';

        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" ${hideWhenDisabled}>
                🔔 알림 받고 시작
            </button>
            <div class="course-buttons" ${hideWhenDisabled}>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="강력">강력</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
            </div>

            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" ${showWhenDisabled} ${scenarioB_DisabledAttr}>
                ${scenarioB_Text}
            </button>
        `;
        container.appendChild(machineDiv);
    });

    // 이벤트 리스너 연결
    addNotifyStartLogic(); // (시나리오 A - 세탁 전)
    addCourseButtonLogic(); // (시나리오 A - 세탁 전)
    addNotifyMeDuringWashLogic(); // (시나리오 B - 세탁 중)
}

/**
 * ❗️ [수정] "알림 받고 시작" 버튼 로직 (세로 정렬용)
 */
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;
            const courseButtonsDiv = card.querySelector('.course-buttons');
            
            if (courseButtonsDiv) {
                // ❗️ 'show-courses' 클래스 (CSS가 display: flex/column 적용)
                courseButtonsDiv.classList.add('show-courses');
            }
            btn.style.display = 'none'; // ❗️ '시작' 버튼은 숨김
        });
    });
}


/**
 * ❗️ [수정] 코스 버튼 로직 (Error 2: UI 즉시 변경 '제거')
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = clickedBtn.closest('.machine-card');
            if (!card) return;

            // 1. "취소 안되게"
            const allButtonsOnCard = card.querySelectorAll('.course-btn');
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // 2. FCM 토큰 발급 (push.js 함수 호출)
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // 3. 토큰 등록 및 알림 구독
                const token = tokenOrStatus;
                await api.registerPushToken(token); 
                await api.toggleNotifyMe(machineId, true); 
                
                // 4. 코스 시작 (서버에 코스 이름만 전송)
                await api.startCourse(machineId, courseName); 
                
                console.log(`API: 코스 시작 및 알림 구독 성공 (서버가 /update를 보낼 때까지 대기)`);
                
                // 5. ❗️ [수정] UI를 즉시 변경하지 않음 (Error 2 해결)
                // updateMachineCard(machineId, "WASHING", response.timer, true); // ❗️ 제거됨
                
                // ❗️ 대신, 버튼 텍스트만 변경하고 비활성화 상태 유지
                clickedBtn.textContent = '✅ 알림 등록됨';

                alert(`${courseName} 코스 알림이 등록되었습니다.`);

            } catch (error) {
                // 6. 실패 시 롤백
                console.error("API: 코스 시작/알림 등록 실패:", error);
                alert(`시작 실패: ${error.message}`);
                
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
                
                const startButton = card.querySelector('.notify-start-btn');
                if (startButton) startButton.style.display = 'block';
                const courseButtonsDiv = card.querySelector('.course-buttons');
                if (courseButtonsDiv) courseButtonsDiv.classList.remove('show-courses');
            }
        };
    });
}

/**
 * ❗️ [신규] "완료 알림 받기" 버튼 로직 (시나리오 B)
 */
function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
                // 2. FCM 토큰 발급 (push.js 함수 호출)
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // 3. 토큰 등록 및 알림 구독
                const token = tokenOrStatus;
                await api.registerPushToken(token); 
                await api.toggleNotifyMe(machineId, true); 

                // 4. (성공) UI 업데이트
                btn.textContent = '✅ 알림 등록됨';
                // (disabled=true 상태 유지)

                alert('완료 알림이 등록되었습니다.');

            } catch (error) {
                // 5. (실패) 롤백
                console.error("API: '세탁 중' 알림 등록 실패:", error);
                alert(`알림 등록 실패: ${error.message}`);
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
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

// [수정 없음] 타이머 표시 헬퍼 함수
function formatTimer(timerValue, status) {
    if (status === 'WASHING' || status === 'SPINNING') {
        if (timerValue === null || timerValue === undefined) {
            return '시간 계산 중...'; 
        }
        if (timerValue <= 0) {
            return '마무리 중...'; 
        }
        return `약 ${timerValue}분 남음`;
    } else if (status === 'FINISHED') {
        return '세탁 완료!';
    } else { 
        return '대기 중';
    }
}