import { jsPDF } from "jspdf";

export function generateNotePdf(title: string, content: string): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(title || "Untitled", maxWidth);
  doc.text(titleLines, margin, 25);

  // Content
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const contentY = 25 + titleLines.length * 8 + 5;
  const lines = doc.splitTextToSize(content, maxWidth);

  let y = contentY;
  const lineHeight = 5.5;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
