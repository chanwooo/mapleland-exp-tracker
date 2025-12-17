/**
 * 영역 선택 모듈
 * 마우스 드래그로 EXP/골드 영역을 선택합니다.
 */

const RegionSelector = (function() {
    let overlay = null;
    let selectionBox = null;
    let indicatorsContainer = null;
    let previewCanvas = null;
    
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let currentType = null; // 'exp' or 'gold'
    
    // 선택된 영역 (원본 비디오 좌표 기준)
    let regions = {
        exp: null,
        gold: null
    };

    // 선택 완료 콜백
    let onRegionSelected = null;

    /**
     * 모듈 초기화
     */
    function init() {
        overlay = document.getElementById('selectionOverlay');
        selectionBox = document.getElementById('selectionBox');
        indicatorsContainer = document.getElementById('regionIndicators');
        previewCanvas = document.getElementById('previewCanvas');

        // 마우스 이벤트 바인딩
        overlay.addEventListener('mousedown', handleMouseDown);
        overlay.addEventListener('mousemove', handleMouseMove);
        overlay.addEventListener('mouseup', handleMouseUp);
        overlay.addEventListener('mouseleave', handleMouseUp);
    }

    /**
     * 영역 선택 모드 시작
     * @param {string} type - 'exp' or 'gold'
     */
    function startSelection(type) {
        if (!CaptureModule.getIsCapturing()) {
            alert('먼저 화면을 선택해주세요.');
            return;
        }

        currentType = type;
        overlay.classList.remove('hidden');
        selectionBox.style.display = 'none';
        
        // 버튼 상태 업데이트
        updateButtonStates();
    }

    /**
     * 영역 선택 모드 종료
     */
    function endSelection() {
        currentType = null;
        overlay.classList.add('hidden');
        selectionBox.style.display = 'none';
        updateButtonStates();
    }

    /**
     * 마우스 다운 핸들러
     */
    function handleMouseDown(e) {
        if (!currentType) return;

        isSelecting = true;
        const rect = previewCanvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    }

    /**
     * 마우스 이동 핸들러
     */
    function handleMouseMove(e) {
        if (!isSelecting) return;

        const rect = previewCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startX;
        const height = currentY - startY;

        // 음수 방향도 지원
        if (width < 0) {
            selectionBox.style.left = currentX + 'px';
            selectionBox.style.width = Math.abs(width) + 'px';
        } else {
            selectionBox.style.left = startX + 'px';
            selectionBox.style.width = width + 'px';
        }

        if (height < 0) {
            selectionBox.style.top = currentY + 'px';
            selectionBox.style.height = Math.abs(height) + 'px';
        } else {
            selectionBox.style.top = startY + 'px';
            selectionBox.style.height = height + 'px';
        }
    }

    /**
     * 마우스 업 핸들러
     */
    function handleMouseUp(e) {
        if (!isSelecting) return;

        isSelecting = false;

        const rect = previewCanvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        // 최소 크기 체크
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        if (width < 10 || height < 10) {
            alert('영역이 너무 작습니다. 더 큰 영역을 선택해주세요.');
            selectionBox.style.display = 'none';
            return;
        }

        // 화면 좌표를 원본 비디오 좌표로 변환
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        
        const videoStart = CaptureModule.screenToVideoCoords(x, y);
        const videoEnd = CaptureModule.screenToVideoCoords(x + width, y + height);

        const region = {
            x: videoStart.x,
            y: videoStart.y,
            width: videoEnd.x - videoStart.x,
            height: videoEnd.y - videoStart.y
        };

        // 영역 저장
        regions[currentType] = region;

        // 인디케이터 업데이트
        updateIndicators();

        // 선택 완료 콜백 호출
        if (typeof onRegionSelected === 'function') {
            onRegionSelected(currentType, region);
        }

        // 선택 모드 종료
        endSelection();
    }

    /**
     * 영역 인디케이터 업데이트
     */
    function updateIndicators() {
        indicatorsContainer.innerHTML = '';

        Object.entries(regions).forEach(([type, region]) => {
            if (!region) return;

            const screenCoords = CaptureModule.videoToScreenCoords(region.x, region.y);
            const screenSize = {
                width: region.width * CaptureModule.getScaleRatio(),
                height: region.height * CaptureModule.getScaleRatio()
            };

            const indicator = document.createElement('div');
            indicator.className = `region-indicator ${type}`;
            indicator.style.left = screenCoords.x + 'px';
            indicator.style.top = screenCoords.y + 'px';
            indicator.style.width = screenSize.width + 'px';
            indicator.style.height = screenSize.height + 'px';
            indicator.textContent = type === 'exp' ? 'EXP' : 'GOLD';

            indicatorsContainer.appendChild(indicator);
        });
    }

    /**
     * 버튼 상태 업데이트
     */
    function updateButtonStates() {
        const btnSelectExp = document.getElementById('btnSelectExp');
        const btnSelectGold = document.getElementById('btnSelectGold');

        if (currentType === 'exp') {
            btnSelectExp.classList.add('selecting');
            btnSelectGold.classList.remove('selecting');
        } else if (currentType === 'gold') {
            btnSelectExp.classList.remove('selecting');
            btnSelectGold.classList.add('selecting');
        } else {
            btnSelectExp.classList.remove('selecting');
            btnSelectGold.classList.remove('selecting');
        }
    }

    /**
     * 영역 설정
     * @param {string} type - 'exp' or 'gold'
     * @param {Object} region - { x, y, width, height }
     */
    function setRegion(type, region) {
        regions[type] = region;
        updateIndicators();
    }

    /**
     * 영역 가져오기
     * @param {string} type - 'exp' or 'gold'
     * @returns {Object|null}
     */
    function getRegion(type) {
        return regions[type];
    }

    /**
     * 모든 영역 가져오기
     * @returns {Object}
     */
    function getAllRegions() {
        return { ...regions };
    }

    /**
     * 영역 초기화
     */
    function clearRegions() {
        regions = { exp: null, gold: null };
        indicatorsContainer.innerHTML = '';
    }

    /**
     * 선택 완료 콜백 설정
     * @param {Function} callback
     */
    function setOnRegionSelected(callback) {
        onRegionSelected = callback;
    }

    /**
     * 모든 영역이 설정되었는지 확인 (EXP는 필수, 골드는 옵션)
     * @returns {boolean}
     */
    function areAllRegionsSet() {
        return regions.exp !== null;
    }

    /**
     * 메소 영역이 설정되었는지 확인
     * @returns {boolean}
     */
    function isGoldRegionSet() {
        return regions.gold !== null;
    }

    return {
        init,
        startSelection,
        endSelection,
        setRegion,
        getRegion,
        getAllRegions,
        clearRegions,
        setOnRegionSelected,
        areAllRegionsSet,
        isGoldRegionSet,
        updateIndicators
    };
})();

