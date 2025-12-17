/**
 * 메이플랜드 EXP 트래커 - 메인 앱
 * 모든 모듈을 통합하고 5초 주기 분석 루프를 관리합니다.
 */

const App = (function() {
    // 상태
    let isAnalyzing = false;
    let analysisInterval = null;
    let currentInterval = 1000; // 기본 1초

    // DOM 요소
    let elements = {};

    /**
     * 모바일 기기 감지
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || (window.innerWidth <= 768 && 'ontouchstart' in window);
    }

    /**
     * 앱 초기화
     */
    async function init() {
        console.log('🍁 메이플랜드 EXP 트래커 초기화 중...');

        // 모바일 감지
        if (isMobileDevice()) {
            document.getElementById('mobileNotice').classList.add('active');
            document.querySelector('.page-wrapper').classList.add('hidden');
            console.log('📱 모바일 기기 감지 - PC 접속 안내 표시');
            return; // 초기화 중단
        }

        // DOM 요소 캐싱
        cacheElements();

        // 모듈 초기화
        CaptureModule.init();
        RegionSelector.init();
        PIPModule.init();

        // OCR 초기화 (비동기)
        initOCR();

        // 이벤트 리스너 등록
        bindEvents();

        // 저장된 설정 복원
        restoreSettings();

        // PIP 대기 화면 렌더링
        PIPModule.renderWaiting();

        // 기록 테이블 렌더링
        renderHistoryTable();

        console.log('🍁 초기화 완료');
    }

    /**
     * DOM 요소 캐싱
     */
    function cacheElements() {
        elements = {
            btnSelectScreen: document.getElementById('btnSelectScreen'),
            btnSelectExp: document.getElementById('btnSelectExp'),
            btnSelectGold: document.getElementById('btnSelectGold'),
            btnStart: document.getElementById('btnStart'),
            btnStop: document.getElementById('btnStop'),
            btnReset: document.getElementById('btnReset'),
            btnPip: document.getElementById('btnPip'),
            previewWrapper: document.querySelector('.preview-wrapper'),
            previewPlaceholder: document.getElementById('previewPlaceholder'),
            expRegionInfo: document.getElementById('expRegionInfo'),
            goldRegionInfo: document.getElementById('goldRegionInfo'),
            statusText: document.getElementById('statusText'),
            elapsedTime: document.getElementById('elapsedTime'),
            ocrStatus: document.getElementById('ocrStatus'),
            currentExp: document.getElementById('currentExp'),
            expChange: document.getElementById('expChange'),
            expPerHour: document.getElementById('expPerHour'),
            timeToLevel: document.getElementById('timeToLevel'),
            currentGold: document.getElementById('currentGold'),
            goldChange: document.getElementById('goldChange'),
            goldPerHour: document.getElementById('goldPerHour'),
            intervalSelect: document.getElementById('intervalSelect'),
            btnClearAll: document.getElementById('btnClearAll'),
            // 기록 패널
            historyTableBody: document.getElementById('historyTableBody'),
            historyEmpty: document.getElementById('historyEmpty'),
            btnClearHistory: document.getElementById('btnClearHistory'),
            historyTableWrapper: document.querySelector('.history-table-wrapper')
        };
    }

    /**
     * OCR 초기화
     */
    async function initOCR() {
        OCRModule.setOnStatusChange((status) => {
            elements.ocrStatus.textContent = status;
        });

        const success = await OCRModule.init();
        if (!success) {
            alert('OCR 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        }
    }

    /**
     * 이벤트 리스너 등록
     */
    function bindEvents() {
        // 화면 선택
        elements.btnSelectScreen.addEventListener('click', handleSelectScreen);

        // 영역 선택
        elements.btnSelectExp.addEventListener('click', () => {
            RegionSelector.startSelection('exp');
        });

        elements.btnSelectGold.addEventListener('click', () => {
            RegionSelector.startSelection('gold');
        });

        // 영역 선택 완료 콜백
        RegionSelector.setOnRegionSelected((type, region) => {
            Storage.saveRegion(type, region);
            updateRegionInfo();
            updateButtonStates();
        });

        // 분석 시작/중지
        elements.btnStart.addEventListener('click', startAnalysis);
        elements.btnStop.addEventListener('click', stopAnalysis);

        // 리셋 (기준값만 초기화)
        elements.btnReset.addEventListener('click', handleReset);

        // 전체 초기화 (모든 설정 삭제)
        elements.btnClearAll.addEventListener('click', handleClearAll);

        // PIP
        elements.btnPip.addEventListener('click', handlePIP);

        // PIP 버튼 연결
        PIPModule.setOnToggle(() => {
            if (isAnalyzing) {
                stopAnalysis();
            } else {
                startAnalysis();
            }
        });
        PIPModule.setOnReset(() => {
            Analyzer.reset();
            updateStatus('리셋됨 - 분석 재시작');
            // 즉시 새 분석 시작
            if (isAnalyzing) {
                runAnalysis();
            }
        });

        // 레벨업 감지 콜백
        Analyzer.setOnLevelUp(() => {
            updateStatus('레벨업 감지! 추적 재시작');
        });

        // 캡처 종료 콜백
        CaptureModule.setOnCaptureEnded(() => {
            stopAnalysis();
            elements.previewWrapper.classList.remove('active');
            elements.previewPlaceholder.classList.remove('hidden');
            updateButtonStates();
            updateStatus('화면 캡처 종료됨');
        });

        // 갱신 주기 변경
        elements.intervalSelect.addEventListener('change', (e) => {
            currentInterval = parseInt(e.target.value, 10);
            console.log('갱신 주기 변경:', currentInterval + 'ms');
            
            // 분석 중이면 새 주기로 재시작
            if (isAnalyzing) {
                clearInterval(analysisInterval);
                analysisInterval = setInterval(runAnalysis, currentInterval);
                updateStatus(`분석 중... (${currentInterval / 1000}초 주기)`);
            }
        });

        // 기록 전체 삭제
        elements.btnClearHistory.addEventListener('click', handleClearHistory);
    }

    /**
     * 화면 선택 핸들러
     */
    async function handleSelectScreen() {
        updateStatus('화면 선택 중...');
        
        // 먼저 프리뷰 영역을 보이게 설정 (크기 측정을 위해)
        elements.previewWrapper.classList.add('active');
        elements.previewPlaceholder.classList.add('hidden');
        
        const success = await CaptureModule.startCapture();
        
        if (success) {
            updateStatus('화면 캡처 중');
            
            // 저장된 영역이 있으면 인디케이터 업데이트
            RegionSelector.updateIndicators();
        } else {
            // 실패 시 다시 숨김
            elements.previewWrapper.classList.remove('active');
            elements.previewPlaceholder.classList.remove('hidden');
            updateStatus('화면 선택 취소됨');
        }
        
        updateButtonStates();
    }

    /**
     * 분석 시작
     */
    function startAnalysis() {
        if (!CaptureModule.getIsCapturing()) {
            alert('먼저 화면을 선택해주세요.');
            return;
        }

        if (!RegionSelector.areAllRegionsSet()) {
            alert('EXP 영역을 선택해주세요.');
            return;
        }

        if (!OCRModule.getIsInitialized()) {
            alert('OCR이 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        isAnalyzing = true;
        Analyzer.reset();
        updateButtonStates();
        updateStatus(`분석 중... (${currentInterval / 1000}초 주기)`);
        elements.statusText.classList.add('analyzing');

        // Media Session 상태 업데이트
        PIPModule.updateMediaSessionState(true);

        // 즉시 첫 분석 실행
        runAnalysis();

        // 선택된 주기로 분석
        analysisInterval = setInterval(runAnalysis, currentInterval);
    }

    /**
     * 분석 중지
     */
    function stopAnalysis() {
        // 세션 기록 저장 (중지 전에)
        const record = Analyzer.createSessionRecord();
        if (record) {
            Storage.saveRecord(record);
            console.log('📝 사냥 기록 저장됨:', record);
            // 기록 테이블 업데이트
            renderHistoryTable();
        }

        isAnalyzing = false;
        
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
        }

        // Media Session 상태 업데이트
        PIPModule.updateMediaSessionState(false);

        updateButtonStates();
        updateStatus('분석 중지됨');
        elements.statusText.classList.remove('analyzing');
    }

    /**
     * 분석 실행 (5초마다)
     */
    async function runAnalysis() {
        if (!isAnalyzing) return;

        try {
            const regions = RegionSelector.getAllRegions();
            
            // EXP 영역 OCR
            const expCanvas = CaptureModule.cropRegion(regions.exp);
            const expResult = await OCRModule.recognizeExp(expCanvas);

            // 메소 영역 OCR (영역이 설정된 경우에만)
            let goldResult = { gold: null, raw: '' };
            if (regions.gold) {
                const goldCanvas = CaptureModule.cropRegion(regions.gold);
                goldResult = await OCRModule.recognizeGold(goldCanvas);
            }

            // 분석
            const analysisResult = Analyzer.analyze({
                exp: expResult.exp,
                percent: expResult.percent,
                gold: goldResult.gold
            });

            // UI 업데이트
            updateResultsUI(analysisResult);

            // PIP 업데이트
            PIPModule.render(analysisResult);

            // 경과 시간 업데이트
            elements.elapsedTime.textContent = Analyzer.formatElapsed(analysisResult.elapsed);

        } catch (error) {
            console.error('분석 오류:', error);
            PIPModule.renderError('분석 오류');
        }
    }

    /**
     * 결과 UI 업데이트
     */
    function updateResultsUI(result) {
        // EXP
        if (result.exp.current !== null) {
            let expText = Analyzer.formatNumber(result.exp.current);
            if (result.exp.percent !== null) {
                expText += ` (${result.exp.percent.toFixed(2)}%)`;
            }
            elements.currentExp.textContent = expText;
        }
        
        elements.expChange.textContent = Analyzer.formatChange(result.exp.change);
        elements.expChange.style.color = result.exp.change >= 0 ? '#00c853' : '#ff5252';
        
        elements.expPerHour.textContent = Analyzer.formatNumber(result.exp.perHour);
        elements.timeToLevel.textContent = Analyzer.formatTimeEstimate(result.exp.timeToLevel);

        // 메소 (영역이 설정된 경우에만)
        const goldCard = document.querySelector('.gold-card');
        if (result.gold.current !== null) {
            if (goldCard) goldCard.style.display = 'block';
            elements.currentGold.textContent = Analyzer.formatNumber(result.gold.current);
            elements.goldChange.textContent = Analyzer.formatChange(result.gold.change);
            elements.goldChange.style.color = result.gold.change >= 0 ? '#00c853' : '#ff5252';
            elements.goldPerHour.textContent = Analyzer.formatNumber(result.gold.perHour);
        } else {
            if (goldCard) goldCard.style.display = 'none';
        }
    }

    /**
     * 리셋 핸들러 (기준값만 초기화 - PIP와 동일)
     */
    function handleReset() {
        Analyzer.reset();
        
        // UI 초기화
        elements.elapsedTime.textContent = '00:00:00';
        elements.currentExp.textContent = '-';
        elements.expChange.textContent = '-';
        elements.expPerHour.textContent = '-';
        elements.timeToLevel.textContent = '-';
        elements.currentGold.textContent = '-';
        elements.goldChange.textContent = '-';
        elements.goldPerHour.textContent = '-';

        updateStatus('리셋됨 - 기준값 초기화');
        
        // 분석 중이면 즉시 새 분석 시작
        if (isAnalyzing) {
            runAnalysis();
        }
    }

    /**
     * 전체 초기화 핸들러 (모든 설정 삭제)
     */
    function handleClearAll() {
        if (confirm('영역 설정을 초기화하시겠습니까?')) {
            stopAnalysis();
            Analyzer.reset();
            RegionSelector.clearRegions();
            Storage.clear();
            
            // UI 초기화
            elements.expRegionInfo.textContent = '미설정';
            elements.goldRegionInfo.textContent = '미설정';
            elements.elapsedTime.textContent = '00:00:00';
            elements.currentExp.textContent = '-';
            elements.expChange.textContent = '-';
            elements.expPerHour.textContent = '-';
            elements.timeToLevel.textContent = '-';
            elements.currentGold.textContent = '-';
            elements.goldChange.textContent = '-';
            elements.goldPerHour.textContent = '-';

            PIPModule.renderWaiting();
            updateStatus('전체 초기화됨');
            updateButtonStates();
        }
    }

    /**
     * PIP 핸들러
     */
    async function handlePIP() {
        if (PIPModule.isPIPOpen()) {
            await PIPModule.closePIP();
        } else {
            const success = await PIPModule.openPIP();
            if (!success) {
                alert('PIP 창을 열 수 없습니다. 브라우저가 PIP를 지원하는지 확인해주세요.');
            }
        }
    }

    /**
     * 버튼 상태 업데이트
     */
    function updateButtonStates() {
        const isCapturing = CaptureModule.getIsCapturing();
        const allRegionsSet = RegionSelector.areAllRegionsSet();
        const ocrReady = OCRModule.getIsInitialized();

        elements.btnSelectExp.disabled = !isCapturing;
        elements.btnSelectGold.disabled = !isCapturing;
        elements.btnStart.disabled = !isCapturing || !allRegionsSet || !ocrReady || isAnalyzing;
        elements.btnStop.disabled = !isAnalyzing;
        elements.btnPip.disabled = false;
    }

    /**
     * 상태 텍스트 업데이트
     */
    function updateStatus(text) {
        elements.statusText.textContent = text;
    }

    /**
     * 영역 정보 업데이트
     */
    function updateRegionInfo() {
        const regions = RegionSelector.getAllRegions();

        if (regions.exp) {
            elements.expRegionInfo.textContent = 
                `${regions.exp.width}x${regions.exp.height} @ (${regions.exp.x}, ${regions.exp.y})`;
        } else {
            elements.expRegionInfo.textContent = '미설정';
        }

        if (regions.gold) {
            elements.goldRegionInfo.textContent = 
                `${regions.gold.width}x${regions.gold.height} @ (${regions.gold.x}, ${regions.gold.y})`;
        } else {
            elements.goldRegionInfo.textContent = '미설정';
        }
    }

    /**
     * 기록 테이블 렌더링
     */
    function renderHistoryTable() {
        const history = Storage.loadHistory();
        
        if (history.length === 0) {
            elements.historyTableBody.innerHTML = '';
            elements.historyEmpty.classList.add('active');
            if (elements.historyTableWrapper) {
                elements.historyTableWrapper.style.display = 'none';
            }
            return;
        }

        elements.historyEmpty.classList.remove('active');
        if (elements.historyTableWrapper) {
            elements.historyTableWrapper.style.display = 'block';
        }

        elements.historyTableBody.innerHTML = history.map(record => {
            // 날짜 포맷: MM/DD HH:mm
            const startDate = new Date(record.id);
            const dateStr = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')} ${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
            
            // 시간 포맷 (분 단위가 0이면 초 단위로 표시)
            let durationStr;
            if (record.duration >= 60) {
                durationStr = `${Math.floor(record.duration / 60)}시간 ${record.duration % 60}분`;
            } else if (record.duration > 0) {
                durationStr = `${record.duration}분`;
            } else {
                // 1분 미만인 경우 (10초 이상)
                durationStr = '1분 미만';
            }

            // EXP/메소 포맷
            const expStr = Analyzer.formatCompact(record.exp.gained);
            const expPerHourStr = record.exp.perHour ? Analyzer.formatCompact(record.exp.perHour) : '-';
            const mesoStr = record.meso.gained ? Analyzer.formatCompact(record.meso.gained) : '-';
            const mesoPerHourStr = record.meso.perHour ? Analyzer.formatCompact(record.meso.perHour) : '-';

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td class="duration">${durationStr}</td>
                    <td class="exp-value">${expStr}</td>
                    <td class="exp-value">${expPerHourStr}</td>
                    <td class="meso-value">${mesoStr}</td>
                    <td class="meso-value">${mesoPerHourStr}</td>
                    <td>
                        <button class="delete-btn" data-id="${record.id}" title="삭제">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');

        // 삭제 버튼 이벤트 바인딩
        elements.historyTableBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                if (confirm('이 기록을 삭제하시겠습니까?')) {
                    Storage.deleteRecord(id);
                    renderHistoryTable();
                }
            });
        });
    }

    /**
     * 전체 기록 삭제
     */
    function handleClearHistory() {
        if (confirm('모든 사냥 기록을 삭제하시겠습니까?')) {
            Storage.clearHistory();
            renderHistoryTable();
        }
    }

    /**
     * 저장된 설정 복원
     */
    function restoreSettings() {
        const regions = Storage.loadAllRegions();

        if (regions.exp) {
            RegionSelector.setRegion('exp', regions.exp);
        }

        if (regions.gold) {
            RegionSelector.setRegion('gold', regions.gold);
        }

        updateRegionInfo();
        updateButtonStates();

        if (Storage.hasSettings()) {
            console.log('저장된 설정 복원됨');
        }
    }

    // DOM 로드 완료 시 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        startAnalysis,
        stopAnalysis,
        isAnalyzing: () => isAnalyzing
    };
})();

