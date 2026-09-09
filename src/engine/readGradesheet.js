import { parseGradesheet } from "./gradesheet.mjs";

export async function readGradesheet(file, studentId) {
  if (!file || !/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error("Choose a PDF grade sheet smaller than 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("This file is not a PDF.");
  const { getDocument, PDFWorker } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const port = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url), { type: "module" });
  const worker = new PDFWorker({ port });
  const task = getDocument({ data: bytes, worker, isEvalSupported: false, stopAtErrors: true });
  task.onPassword = () => { task.destroy(); };
  let document;
  try {
    document = await task.promise;
    if (document.numPages > 20) throw new Error("Please choose a grade sheet with no more than 20 pages.");
    const lines = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const rows = [];
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const y = item.transform[5];
        let row = rows.find(value => Math.abs(value.y - y) < 2);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x: item.transform[4], text: item.str });
      }
      lines.push(...rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim()));
      page.cleanup();
    }
    return parseGradesheet(lines, studentId);
  } finally {
    try { await task.destroy(); } finally { worker.destroy(); port.terminate(); }
  }
}
