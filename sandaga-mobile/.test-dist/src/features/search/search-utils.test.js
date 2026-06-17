"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const search_utils_1 = require("./search-utils");
(0, node_test_1.default)('normalizeSearchTerm trims and collapses spaces', () => {
    strict_1.default.equal((0, search_utils_1.normalizeSearchTerm)('  coloc   douala  '), 'coloc douala');
});
(0, node_test_1.default)('normalizeSuggestionKey removes accents and punctuation', () => {
    strict_1.default.equal((0, search_utils_1.normalizeSuggestionKey)('TélÉphone, Douala!'), 'telephonedouala');
});
(0, node_test_1.default)('isValidSuggestionQuery rejects numeric-only and too-short terms', () => {
    strict_1.default.equal((0, search_utils_1.isValidSuggestionQuery)('1'), false);
    strict_1.default.equal((0, search_utils_1.isValidSuggestionQuery)('12'), false);
    strict_1.default.equal((0, search_utils_1.isValidSuggestionQuery)('te'), true);
});
(0, node_test_1.default)('resolveDidYouMeanCandidate returns nearest typo correction', () => {
    const result = (0, search_utils_1.resolveDidYouMeanCandidate)('telephne', [
        { label: 'Téléphone', query: 'telephone' },
        { label: 'Télévision', query: 'television' }
    ]);
    strict_1.default.deepEqual(result, { label: 'Téléphone', query: 'telephone' });
});
(0, node_test_1.default)('resolveDidYouMeanCandidate ignores very short input', () => {
    const result = (0, search_utils_1.resolveDidYouMeanCandidate)('tv', [{ label: 'TV', query: 'tv' }]);
    strict_1.default.equal(result, null);
});
(0, node_test_1.default)('scoreQuerySuggestion prioritizes history prefix over trending infix', () => {
    const historyScore = (0, search_utils_1.scoreQuerySuggestion)({
        label: 'Colocation Douala',
        query: 'colocation douala',
        resultCount: 20,
        hits: 12,
        source: 'history'
    }, 'colo');
    const trendingScore = (0, search_utils_1.scoreQuerySuggestion)({
        label: 'Meilleure colocation',
        query: 'meilleure colocation',
        resultCount: 100,
        hits: 80,
        source: 'trending'
    }, 'colo');
    strict_1.default.equal(historyScore > trendingScore, true);
});
