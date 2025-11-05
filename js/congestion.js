// js/congestion.js
// ❗️ (차트 타입을 'line' (선) 그래프로 통일한 수정본)

let myChart; 

function initializeChart() {
  if (typeof api !== 'undefined' && typeof Chart !== 'undefined') {
    startChartDrawing();
  } else {
    console.error('API 또는 Chart.js가 로드되지 않았습니다.');
  }
}

async function startChartDrawing() { 
    const ctx = document.getElementById('congestionChart');
    if (!ctx) {
        console.error("congestion.html에 'congestionChart' ID가 없습니다.");
        return;
    }

    let congestionData;
    try {
        congestionData = await api.getCongestionData();
    } catch (error) {
        console.error('API: 혼잡도 데이터 로드 실패:', error);
        alert('혼잡도 데이터를 불러오는데 실패했습니다. 다시 시도해주세요.');
        return;
    }

    const labels = [];
    for (let i = 9; i <= 21; i++) { // 9시~21시
        labels.push(`${i}시`);
    }

    const initialDay = '월';
    const initialData = congestionData[initialDay].slice(9, 22); // 9시~21시 데이터만 잘라냄
    
    // ❗️ [수정] 모바일 감지 로직을 제거하고 'line'으로 고정
    // const isMobile = window.innerWidth <= 768;
    const chartType = 'line'; // isMobile ? 'line' : 'bar';

    myChart = new Chart(ctx, { 
        type: chartType, // ❗️ 항상 'line' 사용
        data: {
            labels: labels,
            datasets: [{
                label: `${initialDay}요일 평균 사용 대수`, 
                data: initialData, 
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1,
                fill: true, // ❗️ 선 그래프이므로 fill을 true로 설정
                tension: 0.1 
            }]
        },
        options: { 
            scales: {
                y: {
                    beginAtZero: true, 
                    ticks: {
                        stepSize: 1 
                    }
                }
            },
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });

    // 5. 모든 요일 버튼에 클릭 이벤트 리스너 추가
    document.querySelectorAll('.day-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const selectedDay = event.target.dataset.day;
            
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');

            updateChart(selectedDay, congestionData);
        });
    });
}

function updateChart(day, congestionData) { 
    const newData = congestionData[day].slice(9, 22);
    
    myChart.data.datasets[0].label = `${day}요일 평균 사용 대수`;
    myChart.data.datasets[0].data = newData;
    
    myChart.update();
}

document.addEventListener('DOMContentLoaded', initializeChart);