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
    let goldIgnoreCount = 0; // 메소 무시 연속 카운터

    // 마지막 유효한 EXP 값 (OCR 오류 필터링용)
    let lastValidExp = null;
    let lastValidPercent = null;

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

        // EXP 초기값 설정
        if (data.exp !== null) {
            lastValidExp = data.exp;
            lastValidPercent = data.percent;
            console.log('EXP 초기값 설정:', lastValidExp, '(', lastValidPercent, '%)');
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

        currentResult.isLevelUp = false;

        // 경과 시간 (밀리초)
        const elapsed = Date.now() - startData.timestamp;
        const elapsedHours = elapsed / 3600000;
        currentResult.elapsed = elapsed;

        // EXP 분석 (OCR 오류 필터링 적용)
        let validExp = data.exp;
        let validPercent = data.percent;

        if (data.exp !== null && lastValidExp !== null) {
            // 급격한 변화 감지: 이전 값 대비 50% 이상 감소 또는 2배 이상 증가
            const changeRatio = data.exp / lastValidExp;
            if (changeRatio < 0.5 || changeRatio > 2) {
                console.log('OCR 오류 감지 (EXP 급변) - 무시:', data.exp, '(이전값:', lastValidExp + ')');
                validExp = lastValidExp;
                validPercent = lastValidPercent;
            }
        }

        // 퍼센트 급변 감지 (OCR 오류)
        if (validPercent !== null && lastValidPercent !== null) {
            const percentChange = Math.abs(validPercent - lastValidPercent);
            // 한 번에 10% 이상 변하는 건 비정상 (일반적으로 0.01~0.1% 씩 증가)
            if (percentChange > 10) {
                console.log('OCR 오류 감지 (퍼센트 급변) - 무시:', validPercent, '(이전값:', lastValidPercent + ')');
                validPercent = lastValidPercent;
            }
        }

        // 유효한 값 업데이트
        if (validExp !== null) {
            lastValidExp = validExp;
        }
        if (validPercent !== null) {
            lastValidPercent = validPercent;
        }

        // EXP 결과 반영
        if (validExp !== null) {
            currentResult.exp.current = validExp;
            currentResult.exp.percent = validPercent;
            
            if (startData.exp !== null) {
                currentResult.exp.change = validExp - startData.exp;
                
                if (elapsedHours > 0) {
                    currentResult.exp.perHour = Math.round(currentResult.exp.change / elapsedHours);
                }
            }

            if (startData.percent !== null && validPercent !== null) {
                currentResult.exp.percentChange = validPercent - startData.percent;
            }

            // 총 필요 경험치 역산 (현재 EXP / 퍼센트)
            if (validPercent !== null && validPercent > 0) {
                currentResult.exp.totalRequired = Math.round(validExp / (validPercent / 100));
                currentResult.exp.remaining = currentResult.exp.totalRequired - validExp;

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
                goldIgnoreCount = 0; // 카운터 리셋
                console.log('메소 업데이트:', lastValidGold);
            } else {
                // 값이 줄어들면 무시 (인벤토리 닫힘 또는 잘못된 인식)
                goldIgnoreCount++;
                console.log('메소 감소 무시 - 유효값 유지:', lastValidGold, '(인식값:', data.gold, ', 무시횟수:', goldIgnoreCount + ')');
                
                // 5번 연속 무시되면 기존 값이 잘못됐다고 판단, 새 값 채택
                if (goldIgnoreCount >= 5) {
                    console.log('메소 5회 연속 무시 - 새 값으로 교체:', data.gold);
                    lastValidGold = data.gold;
                    goldIgnoreCount = 0;
                }
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
        goldIgnoreCount = 0;
        lastValidExp = null;
        lastValidPercent = null;

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

    /**
     * 날짜/시간 포맷팅
     * @param {number} timestamp
     * @returns {string} YYYY-MM-DD HH:mm:ss
     */
    function formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 현재 세션 기록 생성
     * @returns {Object|null} 기록 객체 또는 null (유효하지 않은 경우)
     */
    function createSessionRecord() {
        if (!startData.timestamp) {
            console.log('세션 기록 생성 실패: 시작 데이터 없음');
            return null;
        }

        const endTime = Date.now();
        const durationMs = endTime - startData.timestamp;
        const durationMinutes = Math.floor(durationMs / 60000);

        // 최소 10초 이상이어야 기록 (테스트용, 실제 운영시 1분으로 변경 권장)
        const durationSeconds = Math.floor(durationMs / 1000);
        if (durationSeconds < 10) {
            console.log('세션 기록 생성 실패: 사냥 시간이 10초 미만');
            return null;
        }

        const record = {
            id: startData.timestamp, // 시작 시간을 고유 ID로 사용
            startTime: formatDateTime(startData.timestamp),
            endTime: formatDateTime(endTime),
            duration: durationMinutes,
            durationSeconds: durationSeconds, // 초 단위 시간 추가
            exp: {
                start: startData.exp,
                end: currentResult.exp.current,
                gained: currentResult.exp.change || 0,
                perHour: currentResult.exp.perHour || 0
            },
            meso: {
                start: startData.gold,
                end: currentResult.gold.current,
                gained: currentResult.gold.change || 0,
                perHour: currentResult.gold.perHour || 0
            },
            memo: '' // 메모 필드 추가
        };

        console.log('세션 기록 생성:', record);
        return record;
    }

    /**
     * 숫자 축약 포맷 (K, M, B)
     * @param {number} num
     * @returns {string}
     */
    function formatCompact(num) {
        if (num === null || num === undefined) return '-';
        
        const absNum = Math.abs(num);
        const sign = num >= 0 ? '+' : '-';
        
        // 한국어 스타일: 만, 억 단위 사용
        if (absNum >= 100000000) {
            // 1억 이상: 억 단위
            return sign + (absNum / 100000000).toFixed(1) + '억';
        } else if (absNum >= 10000) {
            // 1만 이상: 만 단위 (소수점 없이 10만 단위까지 표시)
            const man = Math.round(absNum / 10000);
            return sign + man + '만';
        } else if (absNum >= 1000) {
            // 1천 이상: K 단위
            return sign + (absNum / 1000).toFixed(1) + 'K';
        }
        return sign + absNum.toString();
    }

    return {
        start,
        analyze,
        reset,
        formatElapsed,
        formatTimeEstimate,
        formatNumber,
        formatChange,
        formatCompact,
        formatDateTime,
        setOnLevelUp,
        getCurrentResult,
        getStartData,
        isStarted,
        createSessionRecord
    };
})();

