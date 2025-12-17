/**
 * 데이터 분석 모듈
 * EXP/골드 변화량 계산 및 레벨업 감지
 */

const Analyzer = (function() {
    // 시작 시점 데이터
    let startData = {
        exp: null,
        percent: null,
        gold: null,
        timestamp: null
    };

    // 이전 분석 데이터 (레벨업 감지용)
    let prevData = {
        exp: null,
        percent: null,
        gold: null
    };

    // 마지막 유효한 메소 값 (인벤토리 닫힘 감지용)
    let lastValidGold = null;

    // 현재 분석 결과
    let currentResult = {
        exp: {
            current: null,
            percent: null,
            change: null,
            percentChange: null,
            perHour: null,
            totalRequired: null,
            remaining: null,
            timeToLevel: null
        },
        gold: {
            current: null,
            change: null,
            perHour: null
        },
        elapsed: 0,
        isLevelUp: false
    };

    // 레벨업 감지 콜백
    let onLevelUp = null;

    /**
     * 분석 시작 (기준값 설정)
     * @param {Object} data - { exp, percent, gold }
     */
    function start(data) {
        startData = {
            exp: data.exp,
            percent: data.percent,
            gold: data.gold,
            timestamp: Date.now()
        };

        prevData = {
            exp: data.exp,
            percent: data.percent,
            gold: data.gold
        };

        // 메소 초기값 설정 (시작 시점의 메소가 기준)
        if (data.gold !== null && data.gold > 0) {
            lastValidGold = data.gold;
            console.log('메소 초기값 설정:', lastValidGold);
        }

        console.log('분석 시작 - 기준값:', startData);
    }

    /**
     * 데이터 분석
     * @param {Object} data - { exp, percent, gold }
     * @returns {Object} 분석 결과
     */
    function analyze(data) {
        if (!startData.timestamp) {
            // 시작되지 않은 경우 현재 데이터로 시작
            start(data);
            return currentResult;
        }

        // 레벨업 감지 (퍼센트가 50% 이상 급감)
        if (prevData.percent !== null && data.percent !== null) {
            const percentDrop = prevData.percent - data.percent;
            if (percentDrop > 50) {
                console.log('레벨업 감지! 기준값 리셋');
                currentResult.isLevelUp = true;
                
                // 콜백 호출
                if (typeof onLevelUp === 'function') {
                    onLevelUp();
                }

                // 기준값 리셋
                start(data);
                prevData = { ...data };
                return currentResult;
            }
        }

        currentResult.isLevelUp = false;

        // 경과 시간 (밀리초)
        const elapsed = Date.now() - startData.timestamp;
        const elapsedHours = elapsed / 3600000;
        currentResult.elapsed = elapsed;

        // EXP 분석
        if (data.exp !== null) {
            currentResult.exp.current = data.exp;
            currentResult.exp.percent = data.percent;
            
            if (startData.exp !== null) {
                currentResult.exp.change = data.exp - startData.exp;
                
                if (elapsedHours > 0) {
                    currentResult.exp.perHour = Math.round(currentResult.exp.change / elapsedHours);
                }
            }

            if (startData.percent !== null && data.percent !== null) {
                currentResult.exp.percentChange = data.percent - startData.percent;
            }

            // 총 필요 경험치 역산 (현재 EXP / 퍼센트)
            if (data.percent !== null && data.percent > 0) {
                currentResult.exp.totalRequired = Math.round(data.exp / (data.percent / 100));
                currentResult.exp.remaining = currentResult.exp.totalRequired - data.exp;

                // 레벨업까지 예상 시간 계산
                if (currentResult.exp.perHour && currentResult.exp.perHour > 0) {
                    const hoursToLevel = currentResult.exp.remaining / currentResult.exp.perHour;
                    currentResult.exp.timeToLevel = hoursToLevel * 3600000; // 밀리초로 변환
                }
            }
        }

        // 메소 분석
        // 메소는 사냥 중 줄어들지 않는다고 가정
        // 항상 최대값(가장 큰 값)을 유지
        if (data.gold !== null && data.gold > 0) {
            // 현재 인식된 값이 마지막 유효값보다 크거나 같으면 업데이트
            if (lastValidGold === null || data.gold >= lastValidGold) {
                lastValidGold = data.gold;
                console.log('메소 업데이트:', lastValidGold);
            } else {
                // 값이 줄어들면 무시 (인벤토리 닫힘 또는 잘못된 인식)
                console.log('메소 감소 무시 - 유효값 유지:', lastValidGold, '(인식값:', data.gold + ')');
            }
        }

        // 유효한 메소 값이 있으면 결과에 반영
        if (lastValidGold !== null) {
            currentResult.gold.current = lastValidGold;
            
            if (startData.gold !== null) {
                currentResult.gold.change = lastValidGold - startData.gold;
                
                if (elapsedHours > 0) {
                    currentResult.gold.perHour = Math.round(currentResult.gold.change / elapsedHours);
                }
            }
        }

        // 이전 데이터 업데이트
        prevData = {
            exp: data.exp,
            percent: data.percent,
            gold: data.gold
        };

        return currentResult;
    }

    /**
     * 분석 리셋
     */
    function reset() {
        startData = {
            exp: null,
            percent: null,
            gold: null,
            timestamp: null
        };

        prevData = {
            exp: null,
            percent: null,
            gold: null
        };

        lastValidGold = null;

        currentResult = {
            exp: {
                current: null,
                percent: null,
                change: null,
                percentChange: null,
                perHour: null,
                totalRequired: null,
                remaining: null,
                timeToLevel: null
            },
            gold: {
                current: null,
                change: null,
                perHour: null
            },
            elapsed: 0,
            isLevelUp: false
        };
    }

    /**
     * 경과 시간 포맷팅
     * @param {number} ms - 밀리초
     * @returns {string} HH:MM:SS
     */
    function formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
    }

    /**
     * 시간 포맷팅 (예상 시간용)
     * @param {number} ms - 밀리초
     * @returns {string}
     */
    function formatTimeEstimate(ms) {
        if (ms === null || ms === undefined || !isFinite(ms) || ms < 0) {
            return '-';
        }

        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            return `약 ${days}일 ${remainHours}시간`;
        } else if (hours > 0) {
            return `약 ${hours}시간 ${minutes}분`;
        } else {
            return `약 ${minutes}분`;
        }
    }

    /**
     * 숫자 포맷팅 (쉼표 추가)
     * @param {number} num
     * @returns {string}
     */
    function formatNumber(num) {
        if (num === null || num === undefined) return '-';
        return num.toLocaleString('ko-KR');
    }

    /**
     * 변화량 포맷팅 (+/- 표시)
     * @param {number} num
     * @returns {string}
     */
    function formatChange(num) {
        if (num === null || num === undefined) return '-';
        const prefix = num >= 0 ? '+' : '';
        return prefix + num.toLocaleString('ko-KR');
    }

    /**
     * 레벨업 콜백 설정
     * @param {Function} callback
     */
    function setOnLevelUp(callback) {
        onLevelUp = callback;
    }

    /**
     * 현재 결과 가져오기
     * @returns {Object}
     */
    function getCurrentResult() {
        return currentResult;
    }

    /**
     * 시작 데이터 가져오기
     * @returns {Object}
     */
    function getStartData() {
        return { ...startData };
    }

    /**
     * 분석 시작 여부
     * @returns {boolean}
     */
    function isStarted() {
        return startData.timestamp !== null;
    }

    return {
        start,
        analyze,
        reset,
        formatElapsed,
        formatTimeEstimate,
        formatNumber,
        formatChange,
        setOnLevelUp,
        getCurrentResult,
        getStartData,
        isStarted
    };
})();

