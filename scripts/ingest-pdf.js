/**
 * PDF Ingestion Script
 * 
 * Extracts text from the Catan rulebook PDF and generates
 * catanRulebookChunks.json with properly chunked content.
 * 
 * Usage: node scripts/ingest-pdf.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// pdf-parse exports the function directly
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_PATH = path.join(__dirname, '..', 'rulebooks', 'catan-rulebook.pdf');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'rules', 'catanRulebookChunks.json');

/**
 * Chunk text intelligently by detecting sections and maintaining context
 */
function chunkText(text, maxChunkSize = 1200) {
  const chunks = [];
  
  // Split into paragraphs first (double newlines)
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim().replace(/\s+/g, ' ')).filter(p => p.length > 20);
  
  // Convert back to lines for processing, but keep paragraph structure
  const lines = [];
  for (const para of paragraphs) {
    // If paragraph is short and looks like a heading, treat as single line
    if (para.length < 100 && /^[A-Z][A-Z\s]{2,}$/.test(para)) {
      lines.push(para);
    } else {
      // Split long paragraphs into sentences
      const sentences = para.split(/([.!?]+\s+)/);
      let currentLine = '';
      for (let i = 0; i < sentences.length; i++) {
        currentLine += sentences[i];
        if (currentLine.length > 150 || i === sentences.length - 1) {
          if (currentLine.trim().length > 0) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
        }
      }
    }
  }
  
  // Section detection patterns
  const sectionPatterns = [
    /^OBJECTIVE/i,
    /^SETUP/i,
    /^HOW TO PLAY/i,
    /^GAME COMPONENTS/i,
    /^VICTORY POINTS/i,
    /^RESOURCES/i,
    /^TRADING/i,
    /^BUILDING/i,
    /^ROADS/i,
    /^SETTLEMENTS/i,
    /^CITIES/i,
    /^DEVELOPMENT CARDS/i,
    /^THE ROBBER/i,
    /^ROBBER/i,
    /^SPECIAL BUILDING COSTS/i,
    /^LONGEST ROAD/i,
    /^LARGEST ARMY/i,
    /^TURN STRUCTURE/i,
    /^WINNING/i,
    /^[0-9]+\s*[\.\)]\s*[A-Z]/,
    /^[A-Z][A-Z\s]{3,30}$/, // All caps short lines (likely headings)
  ];
  
  let currentChunk = '';
  let currentSection = 'Introduction';
  let pageNumber = 1;
  let chunkId = 1;
  let lineCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineCount++;
    
    // Estimate page breaks (roughly every 40-50 lines)
    if (lineCount > 0 && lineCount % 45 === 0) {
      pageNumber = Math.min(pageNumber + 1, 12);
    }
    
    // Check if this line is a section heading
    let isSection = false;
    let sectionName = currentSection;
    
    // Check for common section keywords in the line
    const sectionKeywords = ['OBJECTIVE', 'SETUP', 'COMPONENTS', 'VICTORY POINT', 'RESOURCE', 'TRADE', 'BUILD', 'ROAD', 'SETTLEMENT', 'CITY', 'DEVELOPMENT CARD', 'ROBBER', 'LONGEST', 'LARGEST', 'WINNING', 'TURN', 'ACTION', 'PRODUCTION'];
    
    for (const keyword of sectionKeywords) {
      if (line.toUpperCase().includes(keyword) && line.length < 100) {
        // Extract the section name (first part of line or keyword)
        const match = line.match(new RegExp(`(${keyword}[^.]*)`, 'i'));
        if (match) {
          isSection = true;
          sectionName = match[1].trim();
          break;
        }
      }
    }
    
    // Check patterns
    for (const pattern of sectionPatterns) {
      if (pattern.test(line) && line.length < 100 && line.length > 3) {
        isSection = true;
        sectionName = line.substring(0, 60).trim();
        break;
      }
    }
    
    // Also check for numbered sections (e.g., "1. Setup", "2. Trading")
    if (!isSection && /^[0-9]+[\.\)]\s+[A-Z]/.test(line) && line.length < 80) {
      isSection = true;
      sectionName = line.substring(0, 60).trim();
    }
    
    // If it's a section heading and we have content, save current chunk
    if (isSection && currentChunk.trim().length > 100) {
      chunks.push({
        id: `catan-${chunkId++}`,
        gameId: 'catan-base',
        page: pageNumber,
        section: currentSection,
        text: currentChunk.trim()
      });
      
      currentSection = sectionName;
      currentChunk = line + '\n\n';
    } else {
      // Add line to current chunk
      const newChunk = currentChunk + line + '\n';
      
      // If adding this line would exceed max size, save current chunk
      if (newChunk.length > maxChunkSize && currentChunk.length > 300) {
        chunks.push({
          id: `catan-${chunkId++}`,
          gameId: 'catan-base',
          page: pageNumber,
          section: currentSection,
          text: currentChunk.trim()
        });
        
        // Start new chunk (keep some context from previous)
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const context = sentences.slice(-2).join('. ') + '.';
        currentChunk = context + '\n\n' + line + '\n';
      } else {
        currentChunk = newChunk;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 50) {
    chunks.push({
      id: `catan-${chunkId++}`,
      gameId: 'catan-base',
      page: pageNumber,
      section: currentSection,
      text: currentChunk.trim()
    });
  }
  
  return chunks;
}

/**
 * Refine chunks by detecting actual page numbers and better section detection
 */
function refineChunks(chunks, fullText) {
  // Try to detect actual page numbers from text
  const pageMatches = fullText.match(/Page\s+(\d+)/gi);
  
  // Improve section detection
  return chunks.map((chunk, index) => {
    // Try to extract a better section name from the chunk text
    const lines = chunk.text.split('\n');
    const firstLine = lines[0]?.trim();
    
    // If first line looks like a heading (short, all caps, or starts with number)
    if (firstLine && (
      firstLine.length < 60 &&
      (firstLine === firstLine.toUpperCase() || /^[0-9]+\./.test(firstLine))
    )) {
      chunk.section = firstLine;
    }
    
    // Estimate page number better based on position
    const estimatedPage = Math.floor((index / chunks.length) * 20) + 1;
    chunk.page = estimatedPage;
    
    return chunk;
  });
}

async function ingestPDF() {
  try {
    console.log('📖 Reading PDF from:', PDF_PATH);
    
    // Check if PDF exists
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF not found at: ${PDF_PATH}`);
    }
    
    // Read PDF file
    const dataBuffer = fs.readFileSync(PDF_PATH);
    
    console.log('📄 Extracting text from PDF...');
    const pdfData = await pdfParse(dataBuffer);
    
    console.log(`✅ Extracted ${pdfData.text.length} characters from ${pdfData.numpages} pages`);
    
    // Clean up the text
    let text = pdfData.text;
    
    // Remove copyright and repeated headers
    text = text.replace(/©\s*\d{4}\s*C\s*ATAN\s*GmbH/gi, '');
    text = text.replace(/CN\d+\s*CATAN[^\n]*/gi, '');
    text = text.replace(/K\s*L\s*A\s*U\s*S\s*T\s*E\s*U\s*B\s*E\s*R/gi, '');
    text = text.replace(/LARGEST ARMY LONGEST ROUTE[^\n]*/gi, '');
    text = text.replace(/3:1\s*2:1\s*2:1\s*6\s*5\s*5\s*4/gi, '');
    
    // Remove excessive whitespace but preserve structure
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
    text = text.replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double
    
    // Chunk the text
    console.log('✂️  Chunking text...');
    let chunks = chunkText(text, 1200);
    
    // Refine chunks
    console.log('🔧 Refining chunks...');
    chunks = refineChunks(chunks, text);
    
    // Filter out very short chunks
    chunks = chunks.filter(chunk => chunk.text.length > 100);
    
    console.log(`✅ Generated ${chunks.length} chunks`);
    
    // Write to JSON file
    console.log('💾 Writing to:', OUTPUT_PATH);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chunks, null, 2), 'utf8');
    
    console.log('✅ Successfully generated catanRulebookChunks.json!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Total chunks: ${chunks.length}`);
    console.log(`   - Total characters: ${chunks.reduce((sum, c) => sum + c.text.length, 0)}`);
    console.log(`   - Average chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)} chars`);
    
    // Show sample chunks
    console.log(`\n📝 Sample chunks:`);
    chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`\n   ${i + 1}. [${chunk.section}] (Page ${chunk.page})`);
      console.log(`      ${chunk.text.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error ingesting PDF:', error);
    process.exit(1);
  }
}

// Run the ingestion
ingestPDF();

