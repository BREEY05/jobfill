const FIELDS = [
  ['name','个人名字','input'],['politicalStatus','政治身份','input'],['school','院校','input'],['major','专业','input'],['education','学历','input'],['birthPlace','生源地','input'],['residence','现居住地','input'],['phone','手机号','input'],['email','邮箱','input'],
  ['projects','项目经历','textarea full'],['awards','荣誉奖项 / 获奖','textarea full'],['campus','校内经历','textarea full'],['certificates','证书','textarea full'],['skills','技能特长','textarea full']
];
const BASIC_KEYS = new Set(['name','politicalStatus','school','major','education','birthPlace','residence','phone','email']);
const TEXT_KEYS = new Set(['projects','awards','campus','certificates','skills']);
const $ = (selector) => document.querySelector(selector);

function setStatus(text, isError = false) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
  el.classList.toggle('error', isError);
}

function render(profile) {
  const make = ([key, label, type]) => {
    const input = type === 'textarea'
      ? `<textarea id="${key}" placeholder="可填写多条内容，每条一行"></textarea>`
      : `<input id="${key}" type="text" placeholder="填写${label}">`;
    return `<div class="field ${type.includes('full') ? 'full' : ''}"><label for="${key}">${label}</label>${input}</div>`;
  };
  $('#basic').innerHTML = FIELDS.filter(([key]) => BASIC_KEYS.has(key)).map(make).join('');
  $('#experience').innerHTML = FIELDS.filter(([key]) => TEXT_KEYS.has(key)).map(make).join('');
  FIELDS.forEach(([key]) => { const el = document.getElementById(key); if (el) el.value = profile[key] || ''; });
}

async function saveProfileForm() {
  const profile = await getProfile();
  FIELDS.forEach(([key]) => { profile[key] = document.getElementById(key).value.trim(); });
  await saveProfile(profile);
  const button = $('#save');
  button.textContent = '已保存 ✓';
  setTimeout(() => { button.textContent = '保存资料'; }, 1600);
}

async function saveSettingsForm() {
  await saveSettings({
    aiEnabled: $('#aiEnabled').checked,
    aiKey: $('#aiKey').value.trim(),
    aiModel: $('#aiModel').value.trim() || 'deepseek-v4-pro'
  });
}

function localParse(text) {
  const profile = {};
  const lines = text.replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const whole = lines.join('\n');
  const fieldPatterns = {
    name: /(?:姓名|真实姓名|名字)\s*[:：]?\s*([^\s，,；;]{1,24})/,
    politicalStatus: /(?:政治面貌|政治身份)\s*[:：]?\s*([^\n]+)/,
    school: /(?:毕业院校|毕业学校|学校名称|院校|学校)\s*[:：]?\s*([^\n]+)/,
    major: /(?:专业名称|所学专业|专业)\s*[:：]?\s*([^\n]+)/,
    education: /(?:最高学历|学历|学位)\s*[:：]?\s*([^\n]+)/,
    birthPlace: /(?:生源地|籍贯)\s*[:：]?\s*([^\n]+)/,
    residence: /(?:现居住地|现居地址|现居城市|居住地|居住地址|通讯地址|联系地址|所在城市)\s*[:：]?\s*([^\n]+)/,
    phone: /(?:手机号码|联系电话|手机号|联系方式|手机|电话)\s*[:：]?\s*(1[3-9]\d{9})/,
    email: /(?:电子邮箱|邮箱|email|e-mail)\s*[:：]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i
  };
  Object.entries(fieldPatterns).forEach(([key, regex]) => {
    const hit = whole.match(regex);
    if (hit) profile[key] = hit[1].trim().replace(/[，,;；]$/, '');
  });

  const SECTION_HEADERS = {
    projects: /^(项目经历|项目经验|项目与作品|项目作品|项目实践)(?:[:：]?\s*)?$/i,
    awards: /^(荣誉奖项|荣誉与奖项|获奖经历|获奖情况|奖项荣誉|所获荣誉|所获奖项|荣誉奖励)(?:[:：]?\s*)?$/i,
    campus: /^(校内经历|校园经历|在校经历|学生工作|社团经历|校园实践|校内实践)(?:[:：]?\s*)?$/i,
    certificates: /^(证书|资格证书|证书资质|职业技能证书|获得证书|主要证书)(?:[:：]?\s*)?$/i,
    skills: /^(专业技能|技能特长|技能|技术栈|个人技能|专业能力)(?:[:：]?\s*)?$/i
  };
  const headerOrder = Object.keys(SECTION_HEADERS).map((key) => ({ key, regex: SECTION_HEADERS[key] }));
  headerOrder.forEach(({ key, regex }, index) => {
    const startIndex = lines.findIndex((line) => regex.test(line.replace(/[:：].*$/, '').trim()));
    if (startIndex < 0) return;
    const nextIndexes = headerOrder.slice(index + 1).map((next) => lines.findIndex((line) => next.regex.test(line.replace(/[:：].*$/, '').trim()))).filter((i) => i > startIndex);
    const endIndex = nextIndexes.length ? Math.min(...nextIndexes) : lines.length;
    const section = lines.slice(startIndex + 1, endIndex).filter((line) => !/^(教育经历|教育背景|实习经历|工作经历|自我评价)/i.test(line));
    if (section.length) profile[key] = section.join('\n');
  });

  // 兜底：简历靠前位置若只有一行纯中文短文本且不是常见标题，视为姓名。
  if (!profile.name) {
    const topName = lines.slice(0, 8).find((line) => {
      if (!/^[\u4e00-\u9fa5·]{2,6}$/.test(line)) return false;
      return !/^(个人简历|中文简历|简历|求职简历|我的简历|基本信息|教育背景|联系方式|求职意向|自我评价|项目经历|实习经历|工作经历|校园经历|技能|证书|获奖)/.test(line);
    });
    if (topName) profile.name = topName;
  }
  if (!profile.phone) {
    const hit = whole.match(/(^|[^\d])(1[3-9]\d{9})(?!\d)/);
    if (hit) profile.phone = hit[2];
  }
  if (!profile.email) {
    const hit = whole.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (hit) profile.email = hit[0];
  }
  return profile;
}

function mergeProfiles(localProfile, aiProfile = {}) {
  const merged = { ...localProfile };
  // AI 补充的字段也要保留（本地规则漏掉的经历/证书等，不能因为本地没有该键而被丢弃）。
  FIELDS.forEach(([key]) => {
    const aiValue = aiProfile && typeof aiProfile[key] === 'string' ? aiProfile[key].trim() : '';
    if (aiValue) merged[key] = aiValue;
  });
  return merged;
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    if (!globalThis.mammoth) throw new Error('Word 解析库未加载');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }
  if (name.endsWith('.txt')) return await file.text();
  if (name.endsWith('.doc')) throw new Error('暂不支持旧版 .doc，请在 Word 中另存为 .docx 或纯文本');
  if (name.endsWith('.pdf')) throw new Error('暂不支持扫描版/PDF 简历，请另存为 .docx 或纯文本');
  return await file.text();
}

async function handleImport(file) {
  setStatus(`正在读取「${file.name}」…`);
  try {
    const text = await extractFileText(file);
    if (!text.trim()) throw new Error('未能从文件中提取到文本');
    const localProfile = localParse(text);
    let finalProfile = localProfile;
    const settings = await getSettings();
    if (settings.aiEnabled && settings.aiKey) {
      setStatus('正在调用 DeepSeek 智能解析简历…');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'AI_RESUME_PARSE', resumeText: text.slice(0, 12000) });
        if (response?.ok) finalProfile = mergeProfiles(localProfile, response.data?.profile || {});
        else throw new Error(response?.error || 'AI 解析失败');
      } catch (error) {
        setStatus(`AI 解析失败，已使用本地解析：${error.message}`, true);
      }
    }
    const profile = await getProfile();
    Object.assign(profile, finalProfile);
    await saveProfile(profile);
    render(profile);
    const recognized = Object.values(finalProfile).filter((value) => typeof value === 'string' && value.trim()).length;
    setStatus(`已读取「${file.name}」，本地识别 ${recognized} 项${settings.aiEnabled && settings.aiKey ? '，并经过 AI 优化' : '（开启 AI 可提高识别率）'}。请核对后保存。`);
  } catch (error) {
    setStatus(`导入失败：${error.message}`, true);
  }
}

async function loadAll() {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  render(profile);
  $('#aiEnabled').checked = !!settings.aiEnabled;
  $('#aiKey').value = settings.aiKey || '';
  $('#aiModel').value = settings.aiModel || 'deepseek-v4-pro';
}

$('#save').addEventListener('click', async () => { await saveProfileForm(); await saveSettingsForm(); setStatus('资料和 AI 设置已保存'); });
$('#resumeFile').addEventListener('change', (event) => { if (event.target.files[0]) handleImport(event.target.files[0]); });
loadAll();
