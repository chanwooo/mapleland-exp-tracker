/**
 * LocalStorage 관리 모듈
 * 설정값(좌표, 기준값 등)을 저장하고 복원합니다.
 */

const Storage = (function() {
    const STORAGE_KEY = 'mapleland_exp_tracker';

    /**
     * 기본 설정값
     */
    const defaultSettings = {
        regions: {
            exp: null,
            gold: null
        },
        lastUpdated: null
    };

    /**
     * 설정 저장
     * @param {Object} settings
     */
    function save(settings) {
        try {
            const data = {
                ...settings,
                lastUpdated: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            console.log('설정 저장됨:', data);
            return true;
        } catch (error) {
            console.error('설정 저장 실패:', error);
            return false;
        }
    }

    /**
     * 설정 불러오기
     * @returns {Object}
     */
    function load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                console.log('설정 불러옴:', parsed);
                return { ...defaultSettings, ...parsed };
            }
        } catch (error) {
            console.error('설정 불러오기 실패:', error);
        }
        return { ...defaultSettings };
    }

    /**
     * 영역 저장
     * @param {string} type - 'exp' or 'gold'
     * @param {Object} region - { x, y, width, height }
     */
    function saveRegion(type, region) {
        const settings = load();
        settings.regions[type] = region;
        save(settings);
    }

    /**
     * 영역 불러오기
     * @param {string} type - 'exp' or 'gold'
     * @returns {Object|null}
     */
    function loadRegion(type) {
        const settings = load();
        return settings.regions[type];
    }

    /**
     * 모든 영역 불러오기
     * @returns {Object}
     */
    function loadAllRegions() {
        const settings = load();
        return settings.regions;
    }

    /**
     * 설정 초기화
     */
    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('설정 초기화됨');
            return true;
        } catch (error) {
            console.error('설정 초기화 실패:', error);
            return false;
        }
    }

    /**
     * 저장된 설정이 있는지 확인
     * @returns {boolean}
     */
    function hasSettings() {
        const settings = load();
        return settings.regions.exp !== null || settings.regions.gold !== null;
    }

    return {
        save,
        load,
        saveRegion,
        loadRegion,
        loadAllRegions,
        clear,
        hasSettings
    };
})();

