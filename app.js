// --- 1. KHỞI TẠO CHIA MÀN HÌNH (SPLIT.JS) ---
Split(['#left-pane', '#right-pane'], {
  sizes: [50, 50],
  minSize: 250,
  gutterSize: 6,
  cursor: 'col-resize'
});

// --- 2. KHỞI TẠO FABRIC.JS CANVAS (VẼ & NOTE) ---
let canvas;
window.addEventListener('load', () => {
  const wrapper = document.getElementById('canvas-wrapper');
  canvas = new fabric.Canvas('note-canvas', {
    width: wrapper.clientWidth,
    height: wrapper.clientHeight,
    isDrawingMode: false
  });

  // Tự động điều chỉnh kích thước khi resize cửa sổ
  window.addEventListener('resize', () => {
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    canvas.renderAll();
  });
});

// Điều khiển Toolbar nét vẽ
const toolSelect = document.getElementById('tool-select');
const toolPen = document.getElementById('tool-pen');
const toolHighlighter = document.getElementById('tool-highlighter');
const toolEraser = document.getElementById('tool-eraser');
const toolColor = document.getElementById('tool-color');
const toolRect = document.getElementById('tool-rect');
const toolCircle = document.getElementById('tool-circle');
const toolClear = document.getElementById('tool-clear');

function resetActiveTool() {
  document.querySelectorAll('.absolute button').forEach(btn => btn.classList.remove('active-tool'));
}

toolSelect.addEventListener('click', () => {
  resetActiveTool();
  toolSelect.classList.add('active-tool');
  canvas.isDrawingMode = false;
});

toolPen.addEventListener('click', () => {
  resetActiveTool();
  toolPen.classList.add('active-tool');
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.color = toolColor.value;
  canvas.freeDrawingBrush.width = 3;
  canvas.freeDrawingBrush.opacity = 1;
});

toolHighlighter.addEventListener('click', () => {
  resetActiveTool();
  toolHighlighter.classList.add('active-tool');
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.color = toolColor.value + '66'; // Opacity mờ
  canvas.freeDrawingBrush.width = 18;
});

toolEraser.addEventListener('click', () => {
  resetActiveTool();
  toolEraser.classList.add('active-tool');
  canvas.isDrawingMode = false;
  // Eraser bằng cách xoá object được click
  canvas.on('mouse:down', function(options) {
    if (options.target && toolEraser.classList.contains('active-tool')) {
      canvas.remove(options.target);
    }
  });
});

toolColor.addEventListener('input', (e) => {
  if (canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush.color = e.target.value;
  }
});

toolRect.addEventListener('click', () => {
  const rect = new fabric.Rect({
    left: 100, top: 100, fill: 'transparent',
    stroke: toolColor.value, strokeWidth: 2, width: 80, height: 60
  });
  canvas.add(rect);
});

toolCircle.addEventListener('click', () => {
  const circle = new fabric.Circle({
    left: 120, top: 120, fill: 'transparent',
    stroke: toolColor.value, strokeWidth: 2, radius: 40
  });
  canvas.add(circle);
});

toolClear.addEventListener('click', () => {
  if (confirm('Bạn có chắc muốn xóa toàn bộ nét vẽ?')) {
    canvas.clear();
  }
});


// --- 3. ĐỌC FILE PDF (PDF.JS ENGINE) ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null;
const scale = 1.2;
const pdfCanvas = document.getElementById('pdf-render-canvas');
const ctx = pdfCanvas.getContext('2d');

function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: scale });
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = { canvasContext: ctx, viewport: viewport };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(() => {
      pageRendering = false;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });
  document.getElementById('pdf-page-num').textContent = num;
}

document.getElementById('pdf-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    document.getElementById('pdf-filename').textContent = file.name;
    const fileReader = new FileReader();
    fileReader.onload = function() {
      const typedarray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
        pdfDoc = pdf;
        document.getElementById('pdf-page-count').textContent = pdf.numPages;
        document.getElementById('pdf-placeholder').classList.add('hidden');
        pdfCanvas.classList.remove('hidden');
        pageNum = 1;
        renderPage(pageNum);
      });
    };
    fileReader.readAsArrayBuffer(file);
  }
});

document.getElementById('pdf-prev').addEventListener('click', () => {
  if (pageNum <= 1) return;
  pageNum--;
  renderPage(pageNum);
});

document.getElementById('pdf-next').addEventListener('click', () => {
  if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
  pageNum++;
  renderPage(pageNum);
});


// --- 4. FLOATING CASIO CALCULATOR & DRAGGABLE LOGIC ---
const casioWidget = document.getElementById('casio-widget');
const btnToggleCalc = document.getElementById('btn-toggle-calc');
const casioClose = document.getElementById('casio-close');
const display = document.getElementById('casio-display');
const historyLog = document.getElementById('casio-history');

btnToggleCalc.addEventListener('click', () => casioWidget.classList.toggle('hidden'));
casioClose.addEventListener('click', () => casioWidget.classList.add('hidden'));

// Drag & Drop Máy tính
const casioHeader = document.getElementById('casio-header');
let isDragging = false, offsetX, offsetY;

casioHeader.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - casioWidget.offsetLeft;
  offsetY = e.clientY - casioWidget.offsetTop;
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    casioWidget.style.left = `${e.clientX - offsetX}px`;
    casioWidget.style.top = `${e.clientY - offsetY}px`;
  }
});
document.addEventListener('mouseup', () => isDragging = false);

// Logic bấm máy tính
let currentExpr = '';
document.querySelectorAll('.calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.innerText;
    if (val === 'AC') {
      currentExpr = '';
      display.innerText = '0';
    } else if (val === 'DEL') {
      currentExpr = currentExpr.slice(0, -1);
      display.innerText = currentExpr || '0';
    } else {
      if (display.innerText === '0') currentExpr = '';
      currentExpr += val === '÷' ? '/' : val === '×' ? '*' : val;
      display.innerText = currentExpr;
    }
  });
});

document.getElementById('calc-equals').addEventListener('click', () => {
  try {
    historyLog.innerText = currentExpr + ' =';
    const result = eval(currentExpr);
    display.innerText = result;
    currentExpr = result.toString();
  } catch (err) {
    display.innerText = 'Error';
  }
});
