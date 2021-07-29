/**
 * @param {Function} f
 * @returns {boolean}
 */
export default function isFunctionEmpty(f) {
    return f.toString() === '(toLog) => {}'
}
