/**
 * 화면 캡처 모듈
 * getDisplayMedia를 사용하여 게임 창을 캡처하고 프리뷰를 표시합니다.
 */

const CaptureModule = (function() {
    let mediaStream = null;
    let videoElement = null;
    let previewCanvas = null;
    let previewCtx = null;
    let animationFrameId = null;
    let isCapturing = false;
    
    // 캡처된 비디오의 실제 크기
    let videoWidth = 0;
    let videoHeight = 0;
    
    // 캔버스에 표시되는 스케일 비율
    let scaleRatio = 1;

    /**
     * 모듈 초기화
     */
    function init() {
        videoElement = document.getElementById('sourceVideo');
        previewCanvas = document.getElementById('previewCanvas');
        previewCtx = previewCanvas.getContext('2d');
    }

    /**
     * 화면 캡처 시작
     * @returns {Promise<boolean>} 성공 여부
     */
    async function startCapture() {
        try {
            // 기존 스트림이 있으면 정리
            if (mediaStream) {
                stopCapture();
            }

            // 화면 공유 요청
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'never'
                },
                audio: false
            });

            // 스트림 종료 이벤트 처리
            mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopCapture();
                if (typeof onCaptureEnded === 'function') {
                    onCaptureEnded();
                }
            });

            // 비디오 요소에 스트림 연결
            videoElement.srcObject = mediaStream;
            await videoElement.play();

            // 비디오 크기 가져오기
            videoWidth = videoElement.videoWidth;
            videoHeight = videoElement.videoHeight;

            // 캔버스 크기 설정 (컨테이너에 맞춤)
            const container = previewCanvas.parentElement;
            const containerWidth = container.clientWidth;
            scaleRatio = containerWidth / videoWidth;
            
            previewCanvas.width = containerWidth;
            previewCanvas.height = videoHeight * scaleRatio;

            isCapturing = true;

            // 프리뷰 렌더링 시작
            renderPreview();

            return true;
        } catch (error) {
            console.error('화면 캡처 실패:', error);
            return false;
        }
    }

    /**
     * 화면 캡처 중지
     */
    function stopCapture() {
        isCapturing = false;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }
    }

    /**
     * 프리뷰 캔버스에 렌더링
     */
    function renderPreview() {
        if (!isCapturing || !videoElement) return;

        previewCtx.drawImage(
            videoElement,
            0, 0,
            previewCanvas.width, previewCanvas.height
        );

        animationFrameId = requestAnimationFrame(renderPreview);
    }

    /**
     * 현재 프레임을 캡처하여 ImageData 반환
     * @returns {ImageData|null}
     */
    function captureFrame() {
        if (!isCapturing || !videoElement) return null;

        // 원본 해상도로 캡처하기 위한 임시 캔버스
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoWidth;
        tempCanvas.height = videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
        
        return {
            canvas: tempCanvas,
            ctx: tempCtx,
            width: videoWidth,
            height: videoHeight
        };
    }

    /**
     * 특정 영역을 크롭하여 캔버스 반환
     * @param {Object} region - { x, y, width, height } (원본 좌표)
     * @returns {HTMLCanvasElement|null}
     */
    function cropRegion(region) {
        const frame = captureFrame();
        if (!frame) return null;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = region.width;
        cropCanvas.height = region.height;
        const cropCtx = cropCanvas.getContext('2d');

        cropCtx.drawImage(
            frame.canvas,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
        );

        return cropCanvas;
    }

    /**
     * 화면 좌표를 원본 비디오 좌표로 변환
     * @param {number} x - 화면 X 좌표
     * @param {number} y - 화면 Y 좌표
     * @returns {Object} { x, y } 원본 좌표
     */
    function screenToVideoCoords(x, y) {
        return {
            x: Math.round(x / scaleRatio),
            y: Math.round(y / scaleRatio)
        };
    }

    /**
     * 원본 비디오 좌표를 화면 좌표로 변환
     * @param {number} x - 원본 X 좌표
     * @param {number} y - 원본 Y 좌표
     * @returns {Object} { x, y } 화면 좌표
     */
    function videoToScreenCoords(x, y) {
        return {
            x: Math.round(x * scaleRatio),
            y: Math.round(y * scaleRatio)
        };
    }

    // 캡처 종료 콜백
    let onCaptureEnded = null;

    /**
     * 캡처 종료 콜백 설정
     * @param {Function} callback
     */
    function setOnCaptureEnded(callback) {
        onCaptureEnded = callback;
    }

    /**
     * 캡처 상태 반환
     * @returns {boolean}
     */
    function getIsCapturing() {
        return isCapturing;
    }

    /**
     * 비디오 크기 반환
     * @returns {Object} { width, height }
     */
    function getVideoSize() {
        return { width: videoWidth, height: videoHeight };
    }

    /**
     * 스케일 비율 반환
     * @returns {number}
     */
    function getScaleRatio() {
        return scaleRatio;
    }

    return {
        init,
        startCapture,
        stopCapture,
        captureFrame,
        cropRegion,
        screenToVideoCoords,
        videoToScreenCoords,
        setOnCaptureEnded,
        getIsCapturing,
        getVideoSize,
        getScaleRatio
    };
})();

