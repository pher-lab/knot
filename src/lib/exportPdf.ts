import { jsPDF } from "jspdf";

interface PdfState {
  doc: jsPDF;
  y: number;
  margin: number;
  maxWidth: number;
  pageHeight: number;
  lineHeight: number;
}

function ensureSpace(s: PdfState, needed: number) {
  if (s.y + needed > s.pageHeight - s.margin) {
    s.doc.addPage();
    s.y = s.margin;
  }
}

function drawLine(s: PdfState, text: string, x: number, width: number) {
  const wrapped = s.doc.splitTextToSize(text, width) as string[];
  for (const line of wrapped) {
    ensureSpace(s, s.lineHeight);
    s.doc.text(line, x, s.y);
    s.y += s.lineHeight;
  }
}

/** Strip simple inline markdown: **bold**, *italic*, `code`, ~~strike~~, [text](url) */
function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // ![alt](url) → alt
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")      // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, "$1")          // **bold**
    .replace(/__(.+?)__/g, "$1")              // __bold__
    .replace(/\*(.+?)\*/g, "$1")              // *italic*
    .replace(/_(.+?)_/g, "$1")                // _italic_
    .replace(/~~(.+?)~~/g, "$1")              // ~~strike~~
    .replace(/`(.+?)`/g, "$1");               // `code`
}

// Cached font base64 — loaded once per session
let cachedFontBase64: string | null = null;

async function loadJapaneseFont(doc: jsPDF): Promise<void> {
  if (!cachedFontBase64) {
    const res = await fetch("/fonts/NotoSansJP-Regular.ttf");
    const buf = await res.arrayBuffer();
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedFontBase64 = btoa(binary);
  }
  doc.addFileToVFS("NotoSansJP-Regular.ttf", cachedFontBase64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
}

export async function generateNotePdf(title: string, content: string): Promise<Uint8Array> {
  const doc = new jsPDF();
  await loadJapaneseFont(doc);

  const fontName = "NotoSansJP";
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 5.5;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title
  doc.setFontSize(18);
  doc.setFont(fontName, "normal");
  const titleLines = doc.splitTextToSize(title || "Untitled", maxWidth);
  doc.text(titleLines, margin, 25);

  const s: PdfState = {
    doc,
    y: 25 + titleLines.length * 8 + 5,
    margin,
    maxWidth,
    pageHeight,
    lineHeight,
  };

  const rawLines = content.split("\n");
  let inCodeBlock = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Code blocks
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        s.y += 2; // small gap before code block
      } else {
        s.y += 2; // small gap after code block
      }
      continue;
    }

    if (inCodeBlock) {
      doc.setFontSize(9.5);
      doc.setFont(fontName, "normal");
      doc.setTextColor(60, 60, 60);
      drawLine(s, line || " ", margin + 4, maxWidth - 8);
      doc.setTextColor(0, 0, 0);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      ensureSpace(s, lineHeight);
      s.y += 2;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, s.y, pageWidth - margin, s.y);
      s.y += 4;
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = stripInline(headingMatch[2]);
      const sizes = [18, 16, 14, 12.5, 11.5, 11];
      doc.setFontSize(sizes[level - 1]);
      doc.setFont(fontName, "normal");
      s.y += level <= 2 ? 4 : 2; // extra spacing before large headings
      drawLine(s, text, margin, maxWidth);
      s.y += 1;
      doc.setFontSize(11);
      doc.setFont(fontName, "normal");
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const text = stripInline(line.replace(/^>+\s*/, ""));
      doc.setFontSize(11);
      doc.setFont(fontName, "normal");
      doc.setTextColor(100, 100, 100);
      drawLine(s, text || " ", margin + 8, maxWidth - 8);
      doc.setFont(fontName, "normal");
      doc.setTextColor(0, 0, 0);
      continue;
    }

    // Task list
    const taskMatch = /^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/.exec(line);
    if (taskMatch) {
      const indent = Math.min(Math.floor(taskMatch[1].length / 2), 3) * 6;
      const checked = taskMatch[3] !== " ";
      const text = stripInline(taskMatch[4]);
      doc.setFontSize(11);
      doc.setFont(fontName, "normal");
      const checkbox = checked ? "[x] " : "[ ] ";
      drawLine(s, checkbox + text, margin + indent + 4, maxWidth - indent - 4);
      continue;
    }

    // Unordered list
    const ulMatch = /^(\s*)([-*+])\s+(.*)$/.exec(line);
    if (ulMatch) {
      const indent = Math.min(Math.floor(ulMatch[1].length / 2), 3) * 6;
      const text = stripInline(ulMatch[3]);
      doc.setFontSize(11);
      doc.setFont(fontName, "normal");
      ensureSpace(s, lineHeight);
      doc.text("\u2022", margin + indent, s.y); // bullet
      drawLine(s, text, margin + indent + 4, maxWidth - indent - 4);
      continue;
    }

    // Ordered list
    const olMatch = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (olMatch) {
      const indent = Math.min(Math.floor(olMatch[1].length / 2), 3) * 6;
      const num = olMatch[2];
      const text = stripInline(olMatch[3]);
      doc.setFontSize(11);
      doc.setFont(fontName, "normal");
      ensureSpace(s, lineHeight);
      doc.text(num + ".", margin + indent, s.y);
      drawLine(s, text, margin + indent + 6, maxWidth - indent - 6);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      s.y += lineHeight * 0.6;
      continue;
    }

    // Normal paragraph text
    doc.setFontSize(11);
    doc.setFont(fontName, "normal");
    drawLine(s, stripInline(line), margin, maxWidth);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
