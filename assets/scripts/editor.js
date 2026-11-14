const root = document.documentElement;
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const themeButton = document.getElementById('theme-toggle');
const copyButton = document.getElementById('copy');
const output = document.getElementById('output');
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
