"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DID_YOU_MEAN_MIN_LENGTH = void 0;
exports.normalizeSearchTerm = normalizeSearchTerm;
exports.normalizeDidYouMeanValue = normalizeDidYouMeanValue;
exports.levenshteinDistance = levenshteinDistance;
exports.resolveDidYouMeanCandidate = resolveDidYouMeanCandidate;
exports.normalizeSuggestionKey = normalizeSuggestionKey;
exports.isValidSuggestionQuery = isValidSuggestionQuery;
exports.scoreQuerySuggestion = scoreQuerySuggestion;
exports.DID_YOU_MEAN_MIN_LENGTH = 3;
function normalizeSearchTerm(value) {
    return value.trim().replace(/\s+/g, ' ');
}
function normalizeDidYouMeanValue(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function levenshteinDistance(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = 0; i < rows; i += 1)
        matrix[i][0] = i;
    for (let j = 0; j < cols; j += 1)
        matrix[0][j] = j;
    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[rows - 1][cols - 1];
}
function resolveDidYouMeanCandidate(term, suggestions) {
    const normalizedTerm = normalizeDidYouMeanValue(term).replace(/\s+/g, '');
    if (normalizedTerm.length < exports.DID_YOU_MEAN_MIN_LENGTH) {
        return null;
    }
    const maxDistance = normalizedTerm.length <= 6 ? 2 : 3;
    for (const item of suggestions) {
        const normalizedCandidate = normalizeDidYouMeanValue(item.query).replace(/\s+/g, '');
        if (!normalizedCandidate || normalizedCandidate === normalizedTerm) {
            continue;
        }
        const distance = levenshteinDistance(normalizedTerm, normalizedCandidate);
        if (distance > 0 && distance <= maxDistance) {
            return {
                label: item.label || item.query,
                query: item.query
            };
        }
    }
    return null;
}
function normalizeSuggestionKey(value) {
    return normalizeDidYouMeanValue(value).replace(/[^a-z0-9]/g, '');
}
function isValidSuggestionQuery(value) {
    return value.trim().length >= 2 && /[a-z]/i.test(value);
}
function scoreQuerySuggestion(item, normalizedInput) {
    const normalizedQuery = item.query.trim().toLowerCase();
    const normalizedLabel = item.label.trim().toLowerCase();
    let score = 0;
    if (normalizedInput) {
        if (normalizedQuery === normalizedInput) {
            score += 600;
        }
        else if (normalizedQuery.startsWith(normalizedInput)) {
            score += 340;
        }
        else if (normalizedQuery.includes(normalizedInput) || normalizedLabel.includes(normalizedInput)) {
            score += 180;
        }
    }
    if (item.source === 'history')
        score += 140;
    if (item.source === 'recent')
        score += 120;
    if (item.source === 'trending')
        score += 90;
    score += Math.min(item.resultCount, 500) / 10;
    score += Math.min(item.hits, 500) / 10;
    return score;
}
