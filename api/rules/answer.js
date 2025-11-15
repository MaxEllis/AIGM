/**
 * RAG-lite Rules Answer Endpoint
 * 
 * This endpoint implements a simplified RAG (Retrieval-Augmented Generation) flow:
 * 1. Receives a question about game rules
 * 2. Retrieves relevant rulebook chunks using keyword matching
 * 3. Sends chunks + question to LLM (OpenAI) for context-aware answer
 * 
 * Future enhancement: Replace static JSON chunks with:
 * - PDF ingestion → text extraction → chunking
 * - Vector embeddings → semantic search (e.g., using OpenAI embeddings)
 * - Persistent storage (database/vector DB) instead of static files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple keyword-based chunk scoring
 * Scores chunks by counting matching words between question and chunk text
 */
function scoreChunk(question, chunk) {
  const questionWords = question.toLowerCase().split(/\s+/);
  const chunkWords = chunk.text.toLowerCase().split(/\s+/);
  
  let score = 0;
  questionWords.forEach(qWord => {
    if (qWord.length > 2) { // Ignore very short words
      const matches = chunkWords.filter(cWord => cWord.includes(qWord) || qWord.includes(cWord));
      score += matches.length;
    }
  });
  
  // Bonus for title/section matches
  const sectionLower = chunk.section.toLowerCase();
  questionWords.forEach(qWord => {
    if (sectionLower.includes(qWord)) {
      score += 2;
    }
  });
  
  return score;
}

/**
 * Retrieve top N chunks for a given question
 */
function retrieveChunks(question, chunks, topN = 5) {
  const scored = chunks.map(chunk => ({
    chunk,
    score: scoreChunk(question, chunk)
  }));
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.chunk);
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ answer: 'Method not allowed', sources: [] });
  }

  try {
    const { gameId, question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ answer: 'Question is required', sources: [] });
    }

    if (!gameId) {
      return res.status(400).json({ answer: 'Game ID is required', sources: [] });
    }

    // Load rulebook chunks
    // Note: In Vercel, we need to use the correct path relative to the project root
    const chunksPath = path.join(process.cwd(), 'src', 'rules', 'catanRulebookChunks.json');
    let chunks;
    
    try {
      const chunksData = fs.readFileSync(chunksPath, 'utf8');
      const allChunks = JSON.parse(chunksData);
      // Filter by gameId
      chunks = allChunks.filter(chunk => chunk.gameId === gameId);
    } catch (error) {
      console.error('[Rules API] Error loading chunks:', error);
      return res.status(500).json({
        answer: 'I had trouble loading the rulebook. Please try again.',
        sources: []
      });
    }

    if (chunks.length === 0) {
      return res.status(404).json({
        answer: `No rulebook found for game: ${gameId}`,
        sources: []
      });
    }

    // Retrieve relevant chunks
    const relevantChunks = retrieveChunks(question, chunks, 5);

    if (relevantChunks.length === 0) {
      return res.status(200).json({
        answer: "I couldn't find relevant information in the rulebook excerpts for that question. Please check the physical rulebook or try rephrasing your question.",
        sources: []
      });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[Rules API] OPENAI_API_KEY not configured');
      return res.status(200).json({
        answer: "The rules engine is currently unavailable. Please check your connection or try again later.",
        sources: []
      });
    }

    // Build context from chunks
    const context = relevantChunks.map(chunk => 
      `[Page ${chunk.page}, Section: ${chunk.section}]\n${chunk.text}`
    ).join('\n\n---\n\n');

    // Call OpenAI API
    const systemPrompt = `You are a board game rules expert for Catan. You may only answer from the rulebook excerpts provided in the context. If the answer is not clearly in the context, say you are not sure and suggest checking the physical rulebook. Keep your answer under 3 short sentences. Do not invent new rules.`;

    const userPrompt = `Question: ${question}\n\nContext from rulebook:\n${context}`;

    let openaiResponse;
    try {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 150,
          temperature: 0.3
        })
      });

      if (!openaiRes.ok) {
        const errorData = await openaiRes.text();
        console.error('[Rules API] OpenAI error:', openaiRes.status, errorData);
        throw new Error(`OpenAI API error: ${openaiRes.status}`);
      }

      openaiResponse = await openaiRes.json();
    } catch (error) {
      console.error('[Rules API] Error calling OpenAI:', error);
      return res.status(200).json({
        answer: "I had trouble reaching the rules engine. Please check your connection or try again.",
        sources: []
      });
    }

    const answer = openaiResponse.choices?.[0]?.message?.content?.trim() || 
      "I couldn't generate an answer. Please try again.";

    // Extract sources
    const sources = relevantChunks.map(chunk => ({
      page: chunk.page,
      section: chunk.section
    }));

    return res.status(200).json({
      answer,
      sources
    });

  } catch (error) {
    console.error('[Rules API] Unexpected error:', error);
    return res.status(500).json({
      answer: 'I had trouble processing your question. Please try again.',
      sources: []
    });
  }
}

