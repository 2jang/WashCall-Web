// js/main.js
// ❗️ (타이머 로직이 '복원'된 최종본)
// ❗️ ('일회성 알림' + 'WASHING/클릭 시 비활성화' + '5초 재연결' + '개별 팝업')

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
        renderMachines(machines); 
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
 * ❗️ [핵심 수정] WebSocket 메시지 처리 (타이머 로직 '복원')
 */
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;
        
        // ❗️ [복원] 타이머 값을 파싱합니다. (null일 수도 있습니다)
        const newTimer = (message.timer !== undefined) ? message.timer : null; 

        if (message.type === 'room_status') {
            updateMachineCard(machineId, newStatus, newTimer); // ❗️ newTimer 인자 추가
        } 
        else if (message.type === 'notify') {
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
            updateMachineCard(machineId, newStatus, newTimer); // ❗️ newTimer 인자 추가
        }

        // ❗️ [수정 없음] 'FINISHED'일 때 '개별 토글'을 자동으로 끈다
        if (newStatus === 'FINISHED') {
            await turnOffToggle(machineId, false); // (서버에 알릴 필요 없음)
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

/**
 * ❗️ [수정 없음] 토글 자동 끄기 헬퍼 (일회성 알림)
 */
async function turnOffToggle(machineId, notifyServer) {
    const toggle = document.querySelector(`.notify-me-toggle[data-machine-id="${machineId}"]`);
    if (toggle && toggle.checked) {
        console.log(`알림 완료: ${machineId}번 세탁기 토글을 자동으로 끕니다.`);
        toggle.checked = false;
        
        if (notifyServer) {
            try {
                await api.toggleNotifyMe(machineId, false);
            } catch (error) {
                console.error(`토글 ${machineId} 자동 끄기 서버 전송 실패:`, error);
            }
        }
    }
}


/**
 * ❗️ [핵심 수정] updateMachineCard (타이머 로직 '복원')
 */
function updateMachineCard(machineId, newStatus, newTimer) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    card.className = 'machine-card'; 
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    // ❗️ [수정] 타이머 헬퍼 함수를 사용하여 텍스트 업데이트
    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        timerSpan.textContent = formatTimer(newTimer, newStatus);
    }

    // [수정 없음] 버튼 비활성화 로직 (Case 1: WASHING이면 비활성화)
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
 * ❗️ [핵심 수정] renderMachines (타이머 로직 '복원')
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
        
        // ❗️ [수정] /load에서 받은 machine.timer 값을 사용
        const displayTimerText = formatTimer(machine.timer, machine.status);

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
            <div class="course-buttons" style="${isDisabled ? 'display: none;' : 'display: flex;'}">
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

// [수정 없음] 코스 버튼 로직 (Case 2: 클릭 시 즉시 비활성화)
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
                // ❗️ [수정] API 호출 시 타이머 값을 받아옵니다.
                const response = await api.startCourse(machineId, courseName);
                console.log(`API: 코스 시작 요청 성공 (서버에 알림)`);
                
                // ❗️ [수정] 서버가 보낸 타이머 값으로 즉시 UI 업데이트
                updateMachineCard(machineId, "WASHING", response.timer);

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

/**
 * ❗️ [수정] 개별 토글 로직 (기능은 동일, push.js와의 연동 로직 추가)
 * (이 함수는 '이전' 답변에서 이미 수정되었습니다. 타이머와는 직접 관련 없습니다.)
 */
function addNotifyMeLogic() {
    document.querySelectorAll('.notify-me-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (event) => {
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const shouldSubscribe = event.target.checked; 

            if (shouldSubscribe) {
                // --- 1. 토글을 켰을 때 (구독 신청) ---
                try {
                    // ❗️ [신규] 중복 방지: '세탁실 알림'이 켜져 있으면 끈다.
                    const roomSubState = localStorage.getItem('washcallRoomSubState');
                    if (roomSubState === 'true') {
                        console.log("중복 방지: '세탁실 알림'을 끕니다.");
                        
                        // (push.js의 끄기 로직을 여기서도 수행)
                        // 1. API 끄기
                        const allToggles = document.querySelectorAll('.notify-me-toggle');
                        
                        const tasks = [];
                        allToggles.forEach(t => {
                            const mid = parseInt(t.dataset.machineId, 10);
                            if (mid) tasks.push(api.toggleNotifyMe(mid, false));
                        });
                        await Promise.all(tasks);
                        
                        // 2. localStorage 끄기
                        localStorage.setItem('washcallRoomSubState', 'false');
                        
                        // 3. 마스터 버튼 UI 끄기
                        const masterBtn = document.getElementById('room-subscribe-button');
                        if (masterBtn) masterBtn.textContent = "🔔 세탁실 알림 받기";
                        
                        alert("'세탁실 전체 알림'이 꺼지고, '개별 알림'이 켜집니다.");
                    }
                    
                    // (기존 '개별' 켜기 로직)
                    const tokenOrStatus = await requestPermissionAndGetToken();

                    if (tokenOrStatus === 'denied') {
                        alert("알림이 '차단' 상태입니다.\n\n주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                        throw new Error('알림 권한이 차단되었습니다.'); 
                    
                    } else if (tokenOrStatus === null) {
                        throw new Error('알림 권한이 거부되었습니다.'); 
                    
                    } else {
                        const token = tokenOrStatus;
                        await api.registerPushToken(token);
                        await api.toggleNotifyMe(machineId, true);
                    }

                } catch (error) {
                    alert(`알림 등록 실패: ${error.message}`);
                    event.target.checked = false; // 롤백
                }
            } else {
                // --- 2. 토글을 껐을 때 (구독 취소) ---
                try {
                    await turnOffToggle(machineId, true); // (서버에 알림)
                } catch (error) {
                    alert(`알림 해제 실패: ${error.message}`);
                    event.target.checked = true; // 롤백
                }
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

/**
 * ❗️ [신규] 타이머 표시 헬퍼 함수
 */
function formatTimer(timerValue, status) {
    // timerValue는 '분' 단위의 숫자 (e.g., 25) 또는 null
    
    if (status === 'WASHING' || status === 'SPINNING') {
        if (timerValue === null || timerValue === undefined) {
            return '작동 중...'; // (서버가 타이머 계산을 못한 경우)
        }
        
        // ❗️ [수정] 0분일 때 "마무리 중" 표시
        if (timerValue <= 0) {
            return '마무리 중...'; 
        }
        
        return `약 ${timerValue}분 남음`;
    
    } else if (status === 'FINISHED') {
        return '세탁 완료!';
    
    } else { // 'OFF' 또는 'EXT_VIBE' 등
        return '대기 중';
    }
}