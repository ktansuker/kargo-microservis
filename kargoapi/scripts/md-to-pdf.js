/**
 * Basit markdown -> PDF dönüştürücü.
 *
 * Chromium/puppeteer gerektirmez; markdown-it (parse) + pdfkit (çizim) kullanır.
 * Türkçe karakterler için Windows Arial / Consolas fontlarını gömer; bulunamazsa
 * PDF standart fontlarına düşer.
 *
 * Kullanım: node scripts/md-to-pdf.js <girdi.md> <cikti.pdf>
 */
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const PDFDocument = require('pdfkit');

const inPath = process.argv[2] || 'docs/KULLANIM.md';
const outPath = process.argv[3] || 'docs/KULLANIM.pdf';

const MARGIN = 56;

function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {
      /* yoksay */
    }
  }
  return null;
}

function resolveFonts() {
  const dir = process.env.WINDIR
    ? path.join(process.env.WINDIR, 'Fonts')
    : 'C:/Windows/Fonts';
  return {
    regular: firstExisting([path.join(dir, 'arial.ttf')]),
    bold: firstExisting([path.join(dir, 'arialbd.ttf')]),
    italic: firstExisting([path.join(dir, 'ariali.ttf')]),
    boldItalic: firstExisting([path.join(dir, 'arialbi.ttf')]),
    mono: firstExisting([path.join(dir, 'consola.ttf'), path.join(dir, 'cour.ttf')]),
  };
}

function registerFonts(doc) {
  const f = resolveFonts();
  doc.registerFont('F', f.regular || 'Helvetica');
  doc.registerFont('F-Bold', f.bold || 'Helvetica-Bold');
  doc.registerFont('F-Italic', f.italic || 'Helvetica-Oblique');
  doc.registerFont('F-BoldItalic', f.boldItalic || 'Helvetica-BoldOblique');
  doc.registerFont('Mono', f.mono || 'Courier');
  if (!f.regular) {
    console.warn(
      '[uyari] Arial bulunamadi, PDF standart fontuna dusuldu; ' +
        'bazi Turkce karakterler hatali gorunebilir.',
    );
  }
}

/** inline token -> stil bilgili "run" dizisi */
function buildRuns(inline) {
  const runs = [];
  if (!inline || !inline.children) return runs;
  let strong = 0;
  let em = 0;
  let link = 0;
  for (const c of inline.children) {
    switch (c.type) {
      case 'text':
        if (c.content) runs.push({ text: c.content, strong: strong > 0, em: em > 0, link: link > 0 });
        break;
      case 'code_inline':
        runs.push({ text: c.content, code: true, link: link > 0 });
        break;
      case 'strong_open':
        strong++;
        break;
      case 'strong_close':
        strong--;
        break;
      case 'em_open':
        em++;
        break;
      case 'em_close':
        em--;
        break;
      case 'link_open':
        link++;
        break;
      case 'link_close':
        link--;
        break;
      case 'softbreak':
        runs.push({ text: ' ' });
        break;
      case 'hardbreak':
        runs.push({ text: '\n' });
        break;
      default:
        if (c.content) runs.push({ text: c.content, strong: strong > 0, em: em > 0 });
        break;
    }
  }
  return runs;
}

function fontFor(run) {
  if (run.code) return 'Mono';
  if (run.strong && run.em) return 'F-BoldItalic';
  if (run.strong) return 'F-Bold';
  if (run.em) return 'F-Italic';
  return 'F';
}

function renderRuns(doc, runs, size, baseColor) {
  if (!runs.length) {
    doc.text('', { continued: false });
    return;
  }
  runs.forEach((run, idx) => {
    const isLast = idx === runs.length - 1;
    let color = baseColor || '#111827';
    if (run.code) color = '#b30059';
    if (run.link) color = '#1a56db';
    doc.font(fontFor(run)).fontSize(size).fillColor(color);
    doc.text(run.text, { continued: !isLast });
  });
}

function renderHeading(doc, level, inline) {
  const sizes = { 1: 20, 2: 15, 3: 12.5, 4: 11, 5: 10, 6: 10 };
  const size = sizes[level] || 11;
  doc.x = MARGIN;
  doc.moveDown(level <= 2 ? 0.7 : 0.45);
  const runs = buildRuns(inline).map((r) => ({ ...r, strong: true }));
  renderRuns(doc, runs, size, level === 1 ? '#0b3d91' : '#111827');
  if (level <= 2) {
    const y = doc.y + 2;
    const width = doc.page.width - MARGIN * 2;
    doc.save().moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.6).strokeColor('#c7ccd1').stroke().restore();
    doc.y = y + 4;
  }
  doc.moveDown(0.25);
}

function renderParagraph(doc, inline) {
  doc.x = MARGIN;
  renderRuns(doc, buildRuns(inline), 11, '#1f2937');
  doc.moveDown(0.5);
}

function renderCodeBlock(doc, content) {
  const size = 8.5;
  const padding = 7;
  const x = MARGIN;
  const width = doc.page.width - MARGIN * 2;
  const text = content.replace(/\n+$/, '');
  const opts = { width: width - padding * 2, lineGap: 1.5 };

  doc.font('Mono').fontSize(size);
  const textHeight = doc.heightOfString(text, opts);
  const boxHeight = textHeight + padding * 2;

  if (doc.y + boxHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const y = doc.y;
  doc.save().rect(x, y, width, boxHeight).fill('#f4f4f5').restore();
  doc.save().rect(x, y, width, boxHeight).lineWidth(0.5).strokeColor('#e0e0e0').stroke().restore();
  doc.font('Mono').fontSize(size).fillColor('#1f2937').text(text, x + padding, y + padding, opts);
  doc.x = MARGIN;
  doc.y = y + boxHeight;
  doc.moveDown(0.6);
}

function renderHr(doc) {
  doc.moveDown(0.3);
  const y = doc.y;
  const width = doc.page.width - MARGIN * 2;
  doc.save().moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.6).strokeColor('#c7ccd1').stroke().restore();
  doc.y = y + 6;
  doc.moveDown(0.3);
}

function listStart(token) {
  if (token.attrs) {
    const a = token.attrs.find((x) => x[0] === 'start');
    if (a) return Number(a[1]) - 1;
  }
  return 0;
}

function renderList(doc, tokens, start, ordered, depth) {
  let i = start + 1;
  let counter = ordered ? listStart(tokens[start]) : 0;
  const closeType = ordered ? 'ordered_list_close' : 'bullet_list_close';
  const indent = MARGIN + depth * 16;

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === 'list_item_open') {
      counter++;
      const marker = ordered ? `${counter}.` : '•';
      i++;
      let firstBlock = true;
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        const t = tokens[i];
        if (t.type === 'paragraph_open' || t.type === 'inline') {
          const inline = t.type === 'inline' ? t : tokens[i + 1];
          doc.x = indent;
          if (firstBlock) {
            doc.font('F-Bold').fontSize(11).fillColor('#1f2937');
            doc.text(`${marker}  `, indent, doc.y, { continued: true });
          }
          renderRuns(doc, buildRuns(inline), 11, '#1f2937');
          firstBlock = false;
          i += t.type === 'inline' ? 1 : 3;
        } else if (t.type === 'bullet_list_open') {
          i = renderList(doc, tokens, i, false, depth + 1);
        } else if (t.type === 'ordered_list_open') {
          i = renderList(doc, tokens, i, true, depth + 1);
        } else {
          i++;
        }
      }
      i++; // list_item_close
      doc.moveDown(0.15);
    } else {
      i++;
    }
  }
  doc.x = MARGIN;
  doc.moveDown(0.35);
  return i + 1; // list close sonrası
}

function inlineText(inline) {
  if (!inline) return '';
  if (!inline.children) return inline.content || '';
  return inline.children
    .map((c) => (c.type === 'softbreak' || c.type === 'hardbreak' ? ' ' : c.content || ''))
    .join('');
}

function renderTable(doc, tokens, start) {
  // 1) Hücreleri topla
  const header = [];
  const rows = [];
  let current = null;
  let inHeader = false;
  let i = start + 1;
  while (i < tokens.length && tokens[i].type !== 'table_close') {
    const t = tokens[i];
    if (t.type === 'thead_open') inHeader = true;
    else if (t.type === 'thead_close') inHeader = false;
    else if (t.type === 'tr_open') current = [];
    else if (t.type === 'tr_close') {
      if (inHeader) header.push(...current);
      else rows.push(current);
      current = null;
    } else if (t.type === 'th_open' || t.type === 'td_open') {
      current.push(inlineText(tokens[i + 1]));
    }
    i++;
  }

  const cols = Math.max(1, header.length);
  const pageWidth = doc.page.width - MARGIN * 2;
  const pad = 4;
  const size = 8.5;

  // 2) Sütun genişlikleri: ölçülen doğal genişlik; alan sütunları içeriğe göre
  //    (bir tavana kadar), son sütun (açıklama) kalan alanı esneyerek doldurur.
  let widths;
  if (cols === 1) {
    widths = [pageWidth];
  } else {
    const natural = [];
    for (let c = 0; c < cols; c++) {
      doc.font('F-Bold').fontSize(size);
      let w = doc.widthOfString(header[c] || '');
      doc.font('F').fontSize(size);
      for (const r of rows) w = Math.max(w, doc.widthOfString(r[c] || ''));
      // +3pt: tam sığan tek kelimelik başlıkların (ör. "Zorunlu") satır kaymasını önler
      natural.push(Math.ceil(w) + 2 * pad + 3);
    }
    const MAX_FIELD = 165; // alan sütunları için üst sınır
    const MIN_LAST = 150; // açıklama sütunu için alt sınır
    const last = cols - 1;
    let head = natural.slice(0, last).map((w) => Math.min(w, MAX_FIELD));
    const headSum = head.reduce((a, b) => a + b, 0);
    let lastW = pageWidth - headSum;
    if (lastW < MIN_LAST) {
      const scale = (pageWidth - MIN_LAST) / headSum;
      head = head.map((w) => w * scale);
      lastW = MIN_LAST;
    }
    widths = [...head, lastW];
  }

  const measureRow = (cells, font) => {
    doc.font(font).fontSize(size);
    let h = 0;
    for (let c = 0; c < cols; c++) {
      const hh = doc.heightOfString(cells[c] || '', { width: widths[c] - 2 * pad });
      if (hh > h) h = hh;
    }
    return h + 2 * pad;
  };

  const drawRow = (cells, y, h, font, bg, color) => {
    let x = MARGIN;
    for (let c = 0; c < cols; c++) {
      const w = widths[c];
      if (bg) doc.save().rect(x, y, w, h).fill(bg).restore();
      doc.save().rect(x, y, w, h).lineWidth(0.5).strokeColor('#d0d5da').stroke().restore();
      doc.font(font).fontSize(size).fillColor(color);
      doc.text(cells[c] || '', x + pad, y + pad, { width: w - 2 * pad, lineGap: 1 });
      x += w;
    }
  };

  const bottom = doc.page.height - doc.page.margins.bottom;
  const headerH = measureRow(header, 'F-Bold');
  if (doc.y + headerH > bottom) doc.addPage();
  let y = doc.y;
  drawRow(header, y, headerH, 'F-Bold', '#eef1f4', '#0b3d91');
  y += headerH;

  for (const row of rows) {
    const h = measureRow(row, 'F');
    if (y + h > bottom) {
      doc.addPage();
      y = doc.y;
      drawRow(header, y, headerH, 'F-Bold', '#eef1f4', '#0b3d91');
      y += headerH;
    }
    drawRow(row, y, h, 'F', null, '#1f2937');
    y += h;
  }

  doc.x = MARGIN;
  doc.y = y;
  doc.moveDown(0.7);
  return i + 1; // table_close sonrası
}

function render(doc, tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    switch (t.type) {
      case 'heading_open':
        renderHeading(doc, Number(t.tag.slice(1)), tokens[i + 1]);
        i += 3;
        break;
      case 'paragraph_open':
        renderParagraph(doc, tokens[i + 1]);
        i += 3;
        break;
      case 'fence':
      case 'code_block':
        renderCodeBlock(doc, t.content);
        i += 1;
        break;
      case 'bullet_list_open':
        i = renderList(doc, tokens, i, false, 0);
        break;
      case 'ordered_list_open':
        i = renderList(doc, tokens, i, true, 0);
        break;
      case 'table_open':
        i = renderTable(doc, tokens, i);
        break;
      case 'hr':
        renderHr(doc);
        i += 1;
        break;
      default:
        i += 1;
        break;
    }
  }
}

function main() {
  if (!fs.existsSync(inPath)) {
    console.error(`Girdi bulunamadi: ${inPath}`);
    process.exit(1);
  }
  const markdown = fs.readFileSync(inPath, 'utf8');
  const md = new MarkdownIt({ html: false, linkify: true });
  const tokens = md.parse(markdown, {});

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  registerFonts(doc);
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.font('F').fontSize(11).fillColor('#1f2937');

  render(doc, tokens);

  doc.end();
  stream.on('finish', () => console.log(`PDF olusturuldu: ${outPath}`));
  stream.on('error', (err) => {
    console.error('PDF yazma hatasi:', err);
    process.exit(1);
  });
}

main();
