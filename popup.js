const labels = { name:'个人名字', politicalStatus:'政治身份', school:'院校', major:'专业', education:'学历', birthPlace:'生源地', residence:'现居住地', phone:'手机号', email:'邮箱', projects:'项目经历', awards:'荣誉奖项', campus:'校内经历', certificates:'证书', skills:'技能特长' };
const $ = (selector) => document.querySelector(selector);
let toastTimer;

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function render() {
  const profile = await getProfile();
  const keys = Object.keys(labels);
  const done = keys.filter((key) => profile[key]?.trim()).length;
  $('#fieldCount').textContent = `${done} / ${keys.length} 已完成`;
  $('#profileName').textContent = profile.name || '还没有资料';
  $('#profileMeta').textContent = profile.updatedAt ? `上次更新 ${new Date(profile.updatedAt).toLocaleDateString('zh-CN')}` : '先完善你的基础信息';
  $('#quickFields').innerHTML = keys.map((key) => {
    const filled = profile[key]?.trim();
    return `<div class="field-chip ${filled ? '' : 'empty'}"><span>${labels[key]}</span>${filled ? `<button class="copy" data-key="${key}">复制</button>` : '<small>未填写</small>'}</div>`;
  }).join('');
  document.querySelectorAll('.copy').forEach((button) => {
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(profile[button.dataset.key]);
      toast(`已复制「${labels[button.dataset.key]}」`);
    });
  });
}

$('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#editProfile').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('#fillPage').addEventListener('click', async () => {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  if (!Object.values(profile).some((value) => typeof value === 'string' && value.trim())) {
    toast('请先在资料页填写并保存信息');
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['fill.js'] });
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (profileArg, settingsArg) => globalThis.JobFill?.fillPage(profileArg, settingsArg) || { filled: 0 },
      args: [profile, settings]
    });
    const filled = (result || []).reduce((sum, item) => sum + (item.result?.filled || 0), 0);
    const aiUsed = (result || []).some((item) => item.result?.aiUsed);
    const aiReady = settings.aiEnabled && settings.aiKey;
    toast(filled
      ? `已填充 ${filled} 个字段${aiUsed ? '（AI 识别）' : ''}`
      : aiReady
        ? '未找到可安全填写的字段，请核对资料后重试'
        : settings.aiEnabled
          ? '请先在资料页填写 AI Key'
          : '未识别到字段，可开启 AI 提高识别率');
  } catch (error) {
    toast('当前页面不支持填充');
  }
});

render();
