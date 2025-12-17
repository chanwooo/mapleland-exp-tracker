/**
 * OCR 모듈
 * Tesseract.js를 사용하여 EXP와 골드 값을 인식합니다.
 */

const OCRModule = (function() {
    let worker = null;
    let isInitialized = false;
    let isInitializing = false;

    // 상태 변경 콜백
    let onStatusChange = null;

    /**
     * Tesseract Worker 초기화
     * @returns {Promise<boolean>}
     */
    async function init() {
        if (isInitialized) return true;
        if (isInitializing) return false;

        isInitializing = true;
        updateStatus('OCR 초기화 중...');

        try {
            worker = await Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        // 인식 진행률 (필요시 사용)
                    }
                }
            });

            isInitialized = true;
            isInitializing = false;
            updateStatus('준비됨');
            return true;
        } catch (error) {
            console.error('OCR 초기화 실패:', error);
            isInitializing = false;
            updateStatus('초기화 실패');
            return false;
        }
    }

    /**
     * 상태 업데이트
     * @param {string} status
     */
    function updateStatus(status) {
        if (typeof onStatusChange === 'function') {
            onStatusChange(status);
        }
    }

    /**
     * 이미지 전처리 (이진화)
     * @param {HTMLCanvasElement} canvas
     * @param {number} threshold - 이진화 임계값 (0-255)
     * @returns {HTMLCanvasElement}
     */
    function preprocessImage(canvas, threshold = 128) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 그레이스케일 + 이진화
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 그레이스케일 변환
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // 이진화 (흰색 글자 기준으로 반전)
            const binary = gray > threshold ? 255 : 0;
            
            data[i] = binary;
            data[i + 1] = binary;
            data[i + 2] = binary;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * 이미지 스케일 업 (OCR 정확도 향상)
     * @param {HTMLCanvasElement} canvas
     * @param {number} scale
     * @returns {HTMLCanvasElement}
     */
    function scaleUp(canvas, scale = 2) {
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;
        
        const ctx = scaledCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        
        return scaledCanvas;
    }

    /**
     * EXP 영역 OCR
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<Object>} { exp: number, percent: number, raw: string }
     */
    async function recognizeExp(canvas) {
        if (!isInitialized) {
            throw new Error('OCR이 초기화되지 않았습니다.');
        }

        try {
            // 전처리: 스케일업 + 이진화
            let processed = scaleUp(canvas, 3);
            processed = preprocessImage(processed, 100);

            // OCR 실행
            const result = await worker.recognize(processed, {
                tessedit_char_whitelist: '0123456789.()[]%EXP '
            });

            const text = result.data.text.trim();
            console.log('EXP OCR 원본:', text);

            // 파싱
            return parseExpText(text);
        } catch (error) {
            console.error('EXP OCR 실패:', error);
            return { exp: null, percent: null, raw: '' };
        }
    }

    /**
     * 골드 영역 OCR
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<Object>} { gold: number, raw: string }
     */
    async function recognizeGold(canvas) {
        if (!isInitialized) {
            throw new Error('OCR이 초기화되지 않았습니다.');
        }

        try {
            // 전처리: 스케일업 + 이진화
            let processed = scaleUp(canvas, 3);
            processed = preprocessImage(processed, 100);

            // OCR 실행
            const result = await worker.recognize(processed, {
                tessedit_char_whitelist: '0123456789,'
            });

            const text = result.data.text.trim();
            console.log('골드 OCR 원본:', text);

            // 파싱
            return parseGoldText(text);
        } catch (error) {
            console.error('골드 OCR 실패:', error);
            return { gold: null, raw: '' };
        }
    }

    /**
     * EXP 텍스트 파싱
     * 예: "EXP 55289816 [19.79%]" 또는 "55289816 (19.79%)"
     * @param {string} text
     * @returns {Object}
     */
    function parseExpText(text) {
        // 다양한 형식 지원
        // 형식 1: 55289816 [19.79%]
        // 형식 2: 55289816 (19.79%)
        // 형식 3: EXP 55289816 19.79%
        
        let exp = null;
        let percent = null;

        // 숫자만 추출 (첫 번째 큰 숫자 = EXP)
        const numbers = text.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            // 가장 큰 숫자를 EXP로 간주
            exp = Math.max(...numbers.map(n => parseInt(n, 10)));
        }

        // 퍼센트 추출
        const percentMatch = text.match(/(\d+\.?\d*)\s*%/);
        if (percentMatch) {
            percent = parseFloat(percentMatch[1]);
        } else {
            // 소수점이 있는 숫자를 퍼센트로 간주
            const decimalMatch = text.match(/(\d+\.\d+)/);
            if (decimalMatch) {
                const val = parseFloat(decimalMatch[1]);
                if (val < 100) {
                    percent = val;
                }
            }
        }

        return { exp, percent, raw: text };
    }

    /**
     * 골드 텍스트 파싱
     * 예: "78,972,001"
     * @param {string} text
     * @returns {Object}
     */
    function parseGoldText(text) {
        // 쉼표 제거 후 숫자 추출
        const cleanText = text.replace(/,/g, '').replace(/\s/g, '');
        const match = cleanText.match(/\d+/);
        
        const gold = match ? parseInt(match[0], 10) : null;
        
        return { gold, raw: text };
    }

    /**
     * 상태 변경 콜백 설정
     * @param {Function} callback
     */
    function setOnStatusChange(callback) {
        onStatusChange = callback;
    }

    /**
     * 초기화 상태 확인
     * @returns {boolean}
     */
    function getIsInitialized() {
        return isInitialized;
    }

    /**
     * Worker 종료
     */
    async function terminate() {
        if (worker) {
            await worker.terminate();
            worker = null;
            isInitialized = false;
        }
    }

    return {
        init,
        recognizeExp,
        recognizeGold,
        preprocessImage,
        setOnStatusChange,
        getIsInitialized,
        terminate
    };
})();

