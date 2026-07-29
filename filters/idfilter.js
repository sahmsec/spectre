class IdCardFilter {
    constructor() {

        this.provinceCodes = {
            '11': 'Beijing', '12': 'Tianjin', '13': 'Hebei', '14': 'Shanxi', '15': 'Inner Mongolia',
            '21': 'Liaoning', '22': 'Jilin', '23': 'Heilongjiang',
            '31': 'Shanghai', '32': 'Jiangsu', '33': 'Zhejiang', '34': 'Anhui', '35': 'Fujian', '36': 'Jiangxi', '37': 'Shandong',
            '41': 'Henan', '42': 'Hubei', '43': 'Hunan', '44': 'Guangdong', '45': 'Guangxi', '46': 'Hainan',
            '50': 'Chongqing', '51': 'Sichuan', '52': 'Guizhou', '53': 'Yunnan', '54': 'Tibet',
            '61': 'Shaanxi', '62': 'Gansu', '63': 'Qinghai', '64': 'Ningxia', '65': 'Xinjiang',
            '71': 'Taiwan', '81': 'Hong Kong', '82': 'Macau'
        };


        this.weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];

        this.checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    }


    validate(idCard) {
        if (!idCard) {
            return { valid: false, error: 'ID card number cannot be empty' };
        }


        idCard = idCard.replace(/\s/g, '').toUpperCase();


        if (idCard.length !== 15 && idCard.length !== 18) {
            return { valid: false, error: 'Incorrect ID card number length' };
        }


        if (idCard.length === 15) {
            return this.validate15(idCard);
        } else {
            return this.validate18(idCard);
        }
    }


    validate15(idCard) {

        if (!/^\d{15}$/.test(idCard)) {
            return { valid: false, error: '15-digit ID card number format is invalid' };
        }


        const provinceCode = idCard.substring(0, 2);
        if (!this.provinceCodes[provinceCode]) {
            return { valid: false, error: 'Invalid province code' };
        }


        const year = parseInt('19' + idCard.substring(6, 8));
        const month = parseInt(idCard.substring(8, 10));
        const day = parseInt(idCard.substring(10, 12));

        if (!this.isValidDate(year, month, day)) {
            return { valid: false, error: 'Invalid date of birth' };
        }

        return {
            valid: true,
            type: '15-digit ID card',
            province: this.provinceCodes[provinceCode],
            birthDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            gender: parseInt(idCard.charAt(14)) % 2 === 0 ? 'Female' : 'Male'
        };
    }


    validate18(idCard) {

        if (!/^\d{17}[\dX]$/.test(idCard)) {
            return { valid: false, error: '18-digit ID card number format is invalid' };
        }


        const provinceCode = idCard.substring(0, 2);
        if (!this.provinceCodes[provinceCode]) {
            return { valid: false, error: 'Invalid province code' };
        }


        const year = parseInt(idCard.substring(6, 10));
        const month = parseInt(idCard.substring(10, 12));
        const day = parseInt(idCard.substring(12, 14));

        if (!this.isValidDate(year, month, day)) {
            return { valid: false, error: 'Invalid date of birth' };
        }


        if (!this.validateCheckCode(idCard)) {
            return { valid: false, error: 'Invalid checksum digit' };
        }

        return {
            valid: true,
            type: '18-digit ID card',
            province: this.provinceCodes[provinceCode],
            birthDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            gender: parseInt(idCard.charAt(16)) % 2 === 0 ? 'Female' : 'Male'
        };
    }


    isValidDate(year, month, day) {

        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear) {
            return false;
        }


        if (month < 1 || month > 12) {
            return false;
        }


        const daysInMonth = new Date(year, month, 0).getDate();
        if (day < 1 || day > daysInMonth) {
            return false;
        }

        return true;
    }


    validateCheckCode(idCard) {
        let sum = 0;
        for (let i = 0; i < 17; i++) {
            sum += parseInt(idCard.charAt(i)) * this.weights[i];
        }
        const checkCodeIndex = sum % 11;
        const expectedCheckCode = this.checkCodes[checkCodeIndex];
        return idCard.charAt(17) === expectedCheckCode;
    }


    extractIdCards(text) {
        if (!text) return [];

        const idCards = [];


        const regex18 = /\b\d{17}[\dX]\b/g;

        const regex15 = /\b\d{15}\b/g;

        let matches;


        while ((matches = regex18.exec(text)) !== null) {
            const idCard = matches[0];
            const result = this.validate(idCard);
            if (result.valid) {
                idCards.push({
                    value: idCard,
                    position: matches.index,
                    ...result
                });
            }
        }


        while ((matches = regex15.exec(text)) !== null) {
            const idCard = matches[0];
            const result = this.validate(idCard);
            if (result.valid) {
                idCards.push({
                    value: idCard,
                    position: matches.index,
                    ...result
                });
            }
        }

        return idCards;
    }


    hasIdCard(text) {
        return this.extractIdCards(text).length > 0;
    }


    maskIdCard(idCard, maskChar = '*') {
        if (!idCard) return '';

        const result = this.validate(idCard);
        if (!result.valid) return idCard;

        if (idCard.length === 15) {

            return idCard.substring(0, 6) + maskChar.repeat(6) + idCard.substring(12);
        } else {

            return idCard.substring(0, 6) + maskChar.repeat(8) + idCard.substring(14);
        }
    }
}


const idCardFilter = new IdCardFilter();


if (typeof module !== 'undefined' && module.exports) {
    module.exports = idCardFilter;
} else if (typeof window !== 'undefined') {
    window.idCardFilter = idCardFilter;
}