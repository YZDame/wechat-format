const root = document.documentElement;
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const themeButton = document.getElementById('theme-toggle');
const copyButton = document.getElementById('copy');
const output = document.getElementById('output');
const previewPane = output.parentElement;
const statusMessage = document.getElementById('status');
const workspace = document.querySelector('.workspace');
const splitter = document.getElementById('splitter');

function setDarkMode(dark) {
  root.dataset.theme = dark ? 'dark' : 'light';
  const label = dark ? '切换浅色模式' : '切换深色模式';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
}

setDarkMode(systemTheme.matches);
systemTheme.addEventListener('change', event => setDarkMode(event.matches));
themeButton.addEventListener('click', () => setDarkMode(root.dataset.theme !== 'dark'));

const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
  mode: { name: 'markdown', highlightFormatting: true },
  theme: 'flexoki',
  lineWrapping: true,
});
editor.getInputField().setAttribute('aria-label', 'Markdown 正文');

// Sync vertical progress across different content heights and ignore reflected scroll events.
let expectedEditorTop;
let expectedPreviewTop;

function scrollProgress(top, total, viewport) {
  return total > viewport ? top / (total - viewport) : 0;
}

editor.on('scroll', () => {
  const { top, height, clientHeight } = editor.getScrollInfo();
  if (expectedEditorTop !== undefined && Math.abs(top - expectedEditorTop) < 2) {
    expectedEditorTop = undefined;
    return;
  }
  expectedEditorTop = undefined;

  const previewRange = previewPane.scrollHeight - previewPane.clientHeight;
  const target = scrollProgress(top, height, clientHeight) * previewRange;
  if (Math.abs(previewPane.scrollTop - target) >= 1) {
    previewPane.scrollTop = target;
    expectedPreviewTop = previewPane.scrollTop;
  }
});

previewPane.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = previewPane;
  if (expectedPreviewTop !== undefined && Math.abs(scrollTop - expectedPreviewTop) < 2) {
    expectedPreviewTop = undefined;
    return;
  }
  expectedPreviewTop = undefined;

  const { top, height, clientHeight: editorHeight } = editor.getScrollInfo();
  const target = scrollProgress(scrollTop, scrollHeight, clientHeight) * Math.max(0, height - editorHeight);
  if (Math.abs(top - target) >= 1) {
    expectedEditorTop = target;
    editor.scrollTo(null, target);
  }
}, { passive: true });

const renderer = new WxRenderer({
  theme: yanqiTheme,
  fonts: yanqiTheme.bodyFont,
  size: '16px',
});

function render() {
  output.innerHTML = marked(editor.getValue(), { renderer: renderer.getRenderer() });
  if (renderer.hasFootnotes()) {
    output.insertAdjacentHTML('beforeend', renderer.buildFootnotes());
  }
  copyButton.disabled = !output.children.length;
}

editor.on('change', render);
render();

fetch('assets/default-content.md')
  .then(response => {
    if (!response.ok) throw new Error('Sample unavailable');
    return response.text();
  })
  .then(markdown => {
    if (editor.isClean()) editor.setValue(markdown);
  })
  .catch(() => {});

const minShare = 25;
const maxShare = 75;
let editorShare = 100 / ((1 + Math.sqrt(5)) / 2);
let resizeFrame;

function setEditorShare(share) {
  editorShare = Math.max(minShare, Math.min(maxShare, share));
  workspace.style.setProperty('--editor-track', editorShare + 'fr');
  workspace.style.setProperty('--preview-track', (100 - editorShare) + 'fr');
  splitter.setAttribute('aria-valuenow', String(Math.round(editorShare)));
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => editor.refresh());
}

function trackPointer(event) {
  const workspaceRect = workspace.getBoundingClientRect();
  const handleWidth = splitter.getBoundingClientRect().width;
  const availableWidth = workspaceRect.width - handleWidth;
  setEditorShare(100 * (event.clientX - workspaceRect.left - handleWidth / 2) / availableWidth);
}

splitter.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  splitter.setPointerCapture(event.pointerId);
  workspace.classList.add('is-resizing');
});

splitter.addEventListener('pointermove', event => {
  if (splitter.hasPointerCapture(event.pointerId)) trackPointer(event);
});

splitter.addEventListener('lostpointercapture', () => workspace.classList.remove('is-resizing'));

splitter.addEventListener('keydown', event => {
  const shares = {
    ArrowLeft: editorShare - 2,
    ArrowRight: editorShare + 2,
    Home: minShare,
    End: maxShare,
  };
  if (!Object.hasOwn(shares, event.key)) return;
  event.preventDefault();
  setEditorShare(shares[event.key]);
});

let statusTimeout;
function reportStatus(text) {
  statusMessage.textContent = text;
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => { statusMessage.textContent = ''; }, 2400);
}

function copyWithEvent(html, text) {
  function handleCopy(event) {
    event.clipboardData.setData('text/html', html);
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
  }
  document.addEventListener('copy', handleCopy);
  try {
    return document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', handleCopy);
  }
}

copyButton.addEventListener('click', async () => {
  const html = output.innerHTML;
  const text = output.innerText;
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
  } catch {
    try {
      if (!copyWithEvent(html, text)) throw new Error('Copy unavailable');
    } catch {
      reportStatus('复制失败，请重试');
      return;
    }
  }
  reportStatus('已复制');
});
