/**
 * 자동 영역 감지 모듈 (템플릿 매칭 + 화면 비율 방식)
 * 아이콘 위치는 템플릿 매칭으로, 영역 크기는 화면 비율로 계산합니다.
 */

const AutoDetect = (function() {
    // 상태 콜백
    let onStatusChange = null;
    let onDetectionComplete = null;

    // 템플릿 이미지
    let expTemplate = null;
    let goldTemplate = null;
    let templatesLoaded = false;

    // 기준 해상도 (템플릿 이미지가 캡처된 해상도)
    const BASE_WIDTH = 2942;
    
    // 기준 해상도에서의 영역 크기 (사용자 제공 데이터 기반)
    const BASE_REGION_SIZE = {
        exp: { width: 280, height: 60 },
        gold: { width: 369, height: 63 }
    };

    /**
     * 상태 업데이트
     */
    function updateStatus(status) {
        if (typeof onStatusChange === 'function') {
            onStatusChange(status);
        }
        console.log('[AutoDetect]', status);
    }

    /**
     * OpenCV.js 로드 대기
     */
    function waitForOpenCV(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            function check() {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('OpenCV.js 로드 타임아웃'));
                } else {
                    setTimeout(check, 100);
                }
            }
            check();
        });
    }

    /**
     * 템플릿 이미지 로드
     */
    async function loadTemplates() {
        if (templatesLoaded) return true;

        updateStatus('템플릿 이미지 로드 중...');

        try {
            expTemplate = await loadImage('assets/exp_icon.png');
            console.log('[AutoDetect] EXP 템플릿 로드됨:', expTemplate.width, 'x', expTemplate.height);

            goldTemplate = await loadImage('assets/gold_icon.png');
            console.log('[AutoDetect] Gold 템플릿 로드됨:', goldTemplate.width, 'x', goldTemplate.height);

            templatesLoaded = true;
            updateStatus('템플릿 이미지 로드 완료');
            return true;
        } catch (error) {
            console.error('템플릿 로드 실패:', error);
            updateStatus('템플릿 로드 실패');
            return false;
        }
    }

    /**
     * 이미지 로드 헬퍼
     */
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
            img.src = src + '?v=' + Date.now();
        });
    }

    /**
     * 이미지를 Canvas로 변환
     */
    function imageToCanvas(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    /**
     * 이미지 리사이즈
     */
    function resizeImage(img, scale) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    /**
     * 빠른 템플릿 매칭 (제한된 스케일만 시도)
     */
    function findTemplateFast(sourceCanvas, templateImg, threshold = 0.5) {
        try {
            const src = cv.imread(sourceCanvas);
            
            // 화면 크기 기반 예상 스케일 계산
            const estimatedScale = sourceCanvas.width / BASE_WIDTH;
            
            // 예상 스케일 근처에서만 시도 (3개 스케일)
            const scales = [
                estimatedScale * 0.8,
                estimatedScale,
                estimatedScale * 1.2
            ];

            let bestMatch = null;
            let bestScore = threshold;

            for (const scale of scales) {
                if (scale < 0.2 || scale > 3.0) continue;
                
                const scaledCanvas = resizeImage(templateImg, scale);
                
                if (scaledCanvas.width > src.cols || scaledCanvas.height > src.rows) {
                    continue;
                }

                const templ = cv.imread(scaledCanvas);
                const result = new cv.Mat();
                const mask = new cv.Mat();

                cv.matchTemplate(src, templ, result, cv.TM_CCOEFF_NORMED, mask);
                const minMax = cv.minMaxLoc(result, mask);

                if (minMax.maxVal > bestScore) {
                    bestScore = minMax.maxVal;
                    bestMatch = {
                        x: minMax.maxLoc.x,
                        y: minMax.maxLoc.y,
                        width: scaledCanvas.width,
                        height: scaledCanvas.height,
                        scale: scale,
                        confidence: minMax.maxVal
                    };
                }

                templ.delete();
                result.delete();
                mask.delete();
            }

            src.delete();

            if (bestMatch) {
                console.log('[AutoDetect] 매칭 결과 - 스케일:', bestMatch.scale.toFixed(2),
                    '위치:', bestMatch.x, bestMatch.y,
                    '신뢰도:', bestMatch.confidence.toFixed(3));
            }

            return bestMatch;
        } catch (error) {
            console.error('[AutoDetect] 템플릿 매칭 오류:', error);
            return null;
        }
    }

    /**
     * 화면 크기에 비례한 영역 크기 계산
     */
    function calculateRegionSize(screenWidth, type) {
        const scale = screenWidth / BASE_WIDTH;
        const baseSize = BASE_REGION_SIZE[type];
        
        return {
            width: Math.round(baseSize.width * scale),
            height: Math.round(baseSize.height * scale)
        };
    }

    /**
     * 전체 화면에서 모든 영역 자동 감지
     */
    async function detectAll(fullScreenCanvas) {
        updateStatus('OpenCV.js 로드 대기 중...');
        
        try {
            await waitForOpenCV();
            
            const loaded = await loadTemplates();
            if (!loaded) {
                throw new Error('템플릿 로드 실패');
            }

            const screenWidth = fullScreenCanvas.width;
            const results = { exp: null, gold: null };

            // 1. EXP 영역 감지
            updateStatus('EXP 아이콘 검색 중...');
            const expMatch = findTemplateFast(fullScreenCanvas, expTemplate, 0.5);
            if (expMatch) {
                const regionSize = calculateRegionSize(screenWidth, 'exp');
                results.exp = {
                    x: expMatch.x + expMatch.width - 5,  // 왼쪽으로 약간 이동
                    y: expMatch.y - 5,
                    width: regionSize.width,
                    height: regionSize.height
                };
                console.log('[AutoDetect] EXP 영역:', results.exp);
            } else {
                console.log('[AutoDetect] EXP 아이콘을 찾지 못함');
            }

            // 2. 메소 영역 감지
            updateStatus('메소 아이콘 검색 중...');
            const goldMatch = findTemplateFast(fullScreenCanvas, goldTemplate, 0.5);
            if (goldMatch) {
                const regionSize = calculateRegionSize(screenWidth, 'gold');
                results.gold = {
                    x: goldMatch.x + goldMatch.width + 5,
                    y: goldMatch.y - 3,
                    width: regionSize.width,
                    height: regionSize.height
                };
                console.log('[AutoDetect] 메소 영역:', results.gold);
            } else {
                console.log('[AutoDetect] 메소 아이콘을 찾지 못함');
            }

            updateStatus('자동 감지 완료');

            if (typeof onDetectionComplete === 'function') {
                onDetectionComplete(results);
            }

            return results;
        } catch (error) {
            console.error('자동 감지 오류:', error);
            updateStatus('자동 감지 실패: ' + error.message);
            return { exp: null, gold: null };
        }
    }

    /**
     * OpenCV 준비 상태 확인
     */
    function isOpenCVReady() {
        return typeof cv !== 'undefined' && cv.Mat;
    }

    function setOnStatusChange(callback) {
        onStatusChange = callback;
    }

    function setOnDetectionComplete(callback) {
        onDetectionComplete = callback;
    }

    return {
        detectAll,
        loadTemplates,
        isOpenCVReady,
        waitForOpenCV,
        setOnStatusChange,
        setOnDetectionComplete
    };
})();
