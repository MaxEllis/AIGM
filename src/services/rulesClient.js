/**
 * Rules Client Service
 * 
 * Handles communication with the backend rules API endpoint.
 * Provides a simple interface for asking questions about game rules.
 */

/**
 * Ask a question about game rules
 * @param {string} question - The question to ask
 * @param {Object} options - Options object
 * @param {string} options.gameId - The game ID (default: 'catan-base')
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function askRulebook(question, { gameId = 'catan-base' } = {}) {
  try {
    const res = await fetch('/api/rules/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, question }),
    });

    if (!res.ok) {
      console.error('[Rules Client] API error:', res.status, res.statusText);
      return {
        answer: "I couldn't reach the rules engine. Please try again.",
        sources: [],
      };
    }

    return res.json();
  } catch (error) {
    console.error('[Rules Client] Network error:', error);
    return {
      answer: "I couldn't reach the rules engine. Please check your connection and try again.",
      sources: [],
    };
  }
}

