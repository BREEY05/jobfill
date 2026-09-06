(function () {
  'use strict';

  // 本地关键词规则：只做「很有把握」的兜底，识别不了就留给 AI 或用户。
  // 命中取最长关键词，同长优先靠前的规则；block 命中的直接放弃。
  const RULES = [
    { key: 'name', words: ['真实姓名', '姓名', '名字', 'full name', 'fullname', 'realname', 'name'], block: ['用户名', '昵称', 'nickname', 'username', '公司', '企业', '学校', '院校', '紧急', '证明', '联系人', '导师', '项目', '期望'] },
    { key: 'politicalStatus', words: ['政治面貌', '政治身份', '政治情况'] },
    { key: 'school', words: ['毕业院校', '毕业学校', '就读学校', '最高院校', '院校名称', '学校名称', '毕业学校名称', '院校', '学校', 'university', 'school'], block: ['绩点', '排名', '课程', '要求', '期望', '助理'] },
    { key: 'major', words: ['所学专业', '主修专业', '专业名称', '专业大类', '详细专业', '专业', 'major'], block: ['课程', '要求', '限制', '期望', '名称'] },
    { key: 'education', words: ['最高学历', '学历', '学位', 'degree', 'education'], block: ['要求', '期望', '招聘', '不限', '提升'] },
    { key: 'birthPlace', words: ['生源地', '户籍所在地', '户籍', '籍贯', 'native place'] },
    { key: 'residence', words: ['现居住地', '现居住址', '现居地址', '现居城市', '居住地址', '居住城市', '常驻城市', '所在城市', '通讯地址', '联系地址', '当前住址', '地址', 'address'], block: ['期望', '意向', '紧急', '家庭', '公司', '单位', '收件'] },
    { key: 'phone', words: ['手机号码', '手机号', '联系电话', '联系方式', '手机', '电话', 'mobile', 'phone', 'tel'], block: ['紧急', '证明', '公司', '单位', '固话', '座机', '父', '母', '联系人'] },
    { key: 'email', words: ['电子邮箱', '电子邮件', '邮箱地址', '邮箱', 'email', 'e-mail', 'mail'] },
    { key: 'projects', words: ['项目经历', '项目经验', '项目实践', '主要项目', '项目简介', 'project experience', 'project'], block: ['名称', '描述', '时间', '角色', '职责', '期望', '目标'] },
    { key: 'awards', words: ['荣誉奖项', '获奖经历', '获奖情况', '奖项荣誉', '所获荣誉', '所获奖项', '荣誉奖励', '奖励荣誉', '荣誉', '获奖', '奖项', 'award'], block: ['名称', '时间', '级别', '授予单位'] },
    { key: 'campus', words: ['校内经历', '校园经历', '在校经历', '学生工作', '社团经历', '校园实践', '校内实践'] },
    { key: 'certificates', words: ['证书', '资格证书', '资质证书', '职业证书', '职业技能证书', 'certificate'], block: ['获奖', '荣誉', '奖项', '名称', '时间', '证件'] },
    { key: 'skills', words: ['专业技能', '技能特长', '技能标签', '技能', '技术栈', '个人技能', 'skills', 'skill'], block: ['证书', '要求', '期望', '招聘', '任职'] }
  ];
  const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
  const SKIP_INPUT_TYPES = new Set(['hidden', 'button', 'submit', 'file', 'image', 'reset', 'password', 'range', 'color']);

  function isEditableControl(node) {
    return node && typeof node.matches === 'function' && node.matches(FIELD_SELECTOR);
  }

  function isFieldVisible(el) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch { return true; }
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function pushPart(parts, seen, value) {
    const text = cleanText(value);
    if (text && text.length <= 100 && !seen.has(text)) { seen.add(text); parts.push(text); }
  }

  // 提取页面字段附近的标签文字（对齐 Chaunyoffer 的 fieldLabelBlob 思路，避免整段父容器文本串扰）。
  function fieldLabelBlob(el, root) {
    const parts = [];
    const seen = new Set();
    const doc = (root && typeof root.getElementById === 'function') ? root : document;
    const push = (value) => pushPart(parts, seen, value);

    push(el.getAttribute('aria-label'));
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) labelledBy.split(/\s+/).forEach((id) => push(doc.getElementById(id)?.textContent));
    if (el.id) { try { push(doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent); } catch {} }
    push(el.closest('label')?.textContent);
    push(el.getAttribute('placeholder'));
    push(el.getAttribute('data-placeholder'));

    const pushPrevText = (node) => {
      if (!node || isEditableControl(node) || node.querySelector('input, textarea, select, [contenteditable]')) return;
      const compact = String(node.textContent || '').replace(/\s+/g, '');
      if (compact.length >= 2 && compact.length <= 40 && /[\u4e00-\u9fa5a-zA-Z]/.test(compact)) push(node.textContent);
    };
    pushPrevText(el.previousElementSibling);

    let host = el.parentElement;
    for (let depth = 0; host && depth < 4; depth += 1, host = host.parentElement) {
      const before = parts.length;
      let labelEl = null;
      try { labelEl = host.querySelector(':scope > label'); } catch {}
      const hostClass = String(host.getAttribute('class') || '');
      if (!labelEl && /(form|field|item|group|control|row|cell)/i.test(hostClass)) {
        try { labelEl = host.querySelector(':scope > [class*="label" i], :scope > div > label'); } catch {}
      }
      if (!labelEl) {
        labelEl = [...host.children].find((child) => {
          if (child.contains(el) || isEditableControl(child) || child.querySelector('input, textarea, select, [contenteditable]')) return false;
          const compact = String(child.textContent || '').replace(/\s+/g, '');
          return compact.length >= 2 && compact.length <= 24 && /[\u4e00-\u9fa5a-zA-Z]/.test(compact);
        });
      }
      if (labelEl && !labelEl.contains(el)) push(labelEl.textContent);
      pushPrevText(host.previousElementSibling);
      if (parts.length > before) break;
    }

    // name/id 是弱信号，放在最后兜底，避免把随机的英文 id 当标签。
    push(el.getAttribute('name'));
    push(el.id);
    return parts.join(' ');
  }

  // 单选/复选的“自己的标签”：只看与该控件直接绑定的文字，避免同一组控件互相误勾。
  function choiceOwnText(el) {
    const parts = [];
    const seen = new Set();
    const push = (value) => pushPart(parts, seen, value);
    push(el.getAttribute('aria-label'));
    if (el.id) { try { push(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent); } catch {} }
    if (el.labels) [...el.labels].forEach((label) => push(label.textContent));
    push(el.closest('label')?.textContent);
    const sibling = el.previousElementSibling;
    if (sibling && !isEditableControl(sibling) && !sibling.querySelector('input, textarea, select, [contenteditable]')) {
      push(sibling.textContent);
    }
    const next = el.nextElementSibling;
    if (next && !isEditableControl(next) && !next.querySelector('input, textarea, select, [contenteditable]')) {
      push(next.textContent);
    }
    return parts.join(' ');
  }

  function isEmptyField(el) {
    try {
      if (el instanceof HTMLSelectElement) return !el.value || el.selectedIndex <= 0;
      if (el.type === 'checkbox' || el.type === 'radio') return true;
      if (el.isContentEditable) return !(el.textContent || '').trim();
      return !String(el.value || '').trim();
    } catch { return true; }
  }

  // 扫描整页/整棵 shadow DOM 中「可见、可编辑、未填写且有标签上下文」的字段。
  function collectFields(root) {
    const fields = [];
    const queue = [root];
    while (queue.length) {
      const current = queue.shift();
      current.querySelectorAll(FIELD_SELECTOR).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (el.closest('[data-jfill-ignore]')) return;
        const tag = el.tagName.toLowerCase();
        const inputType = (el.getAttribute('type') || '').toLowerCase();
        if (tag === 'input' && SKIP_INPUT_TYPES.has(inputType)) return;
        if (el.disabled || el.readOnly) return;
        if (!isFieldVisible(el) || !isEmptyField(el)) return;
        const blob = fieldLabelBlob(el, current);
        if (!blob) return;
        let kind = 'text';
        if (tag === 'select') kind = 'select';
        else if (tag === 'textarea') kind = 'textarea';
        else if (el.isContentEditable) kind = 'richtext';
        else if (el.type === 'checkbox' || el.type === 'radio') kind = 'choice';
        fields.push({
          el, kind, blob,
          options: tag === 'select'
            ? [...el.options].map((o) => cleanText(o.textContent) || cleanText(o.value)).filter(Boolean).slice(0, 10)
            : []
        });
      });
      current.querySelectorAll('*').forEach((node) => { if (node.shadowRoot) queue.push(node.shadowRoot); });
    }
    return fields;
  }

  function matchKey(text) {
    const lower = String(text || '').toLowerCase();
    if (!lower) return null;
    let best = null;
    let bestScore = 0;
    for (const rule of RULES) {
      if (rule.block && rule.block.some((word) => lower.includes(word.toLowerCase()))) continue;
      for (const word of rule.words) {
        if (word.length > bestScore && lower.includes(word.toLowerCase())) {
          bestScore = word.length;
          best = rule.key;
        }
      }
    }
    return best;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
  }

  function toDateInputValue(value, type) {
    const v = String(value || '').trim();
    const match = v.match(/^(\d{4})[年./-]\s*(\d{1,2})(?:[月./-]\s*(\d{1,2})日?)?$/);
    if (!match) return '';
    const month = match[2].padStart(2, '0');
    if (type === 'month') return `${match[1]}-${month}`;
    const day = match[3] ? match[3].padStart(2, '0') : '01';
    return `${match[1]}-${month}-${day}`;
  }

  function fillSelect(el, value) {
    const target = String(value || '').trim().toLowerCase();
    const options = [...el.options].filter((o) => cleanText(o.textContent) || cleanText(o.value));
    const hit = options.find((o) => cleanText(o.textContent).toLowerCase() === target || cleanText(o.value).toLowerCase() === target)
      || options.find((o) => {
        const text = cleanText(o.textContent).toLowerCase();
        return text.length >= 2 && (text.includes(target) || target.includes(text));
      });
    if (!hit) return false;
    el.value = hit.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function writeValue(el, value) {
    const v = String(value || '').trim();
    if (!v) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === 'SELECT') return fillSelect(el, v);
    if (el.type === 'checkbox' || el.type === 'radio') {
      const labelContext = choiceOwnText(el).toLowerCase();
      if (!labelContext.includes(v.toLowerCase())) return false;
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlight(el);
      return true;
    }
    if (el.isContentEditable) {
      el.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand('insertText', false, v)) el.textContent = v;
      } catch { el.textContent = v; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlight(el);
      return true;
    }
    const inputType = (el.getAttribute('type') || 'text').toLowerCase();
    if (el.tagName === 'INPUT') {
      if (inputType === 'date' || inputType === 'month') {
        const formatted = toDateInputValue(v, inputType);
        if (!formatted) return false;
        el.focus();
        setNativeValue(el, formatted);
      } else {
        // 单行输入框拒绝多行大段内容，避免把整段项目经历塞进“项目名称”。
        if (v.includes('\n')) return false;
        el.focus();
        setNativeValue(el, v);
      }
    } else {
      el.focus();
      setNativeValue(el, v);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    highlight(el);
    return true;
  }

  function highlight(el) {
    el.style.outline = '2px solid #b8f66b';
    el.style.outlineOffset = '2px';
  }

  function profileEntries(profile) {
    return Object.entries(profile || {}).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => [key, value.trim()]);
  }

  function fillLocal(fields, profile) {
    const entries = profileEntries(profile);
    if (!entries.length) return { count: 0, used: new Set() };
    const values = new Map(entries);
    const used = new Set();
    let count = 0;
    for (const field of fields) {
      const key = matchKey(field.blob);
      if (!key || used.has(key) || !values.has(key)) continue;
      if (writeValue(field.el, values.get(key))) { used.add(key); count += 1; }
    }
    return { count, used };
  }

  async function fillWithAi(fields, profile, localUsed) {
    if (!globalThis.chrome?.runtime?.sendMessage) return 0;
    const remaining = fields.filter((field) => isEmptyField(field.el));
    if (!remaining.length) return 0;
    const resume = {};
    Object.entries(profile || {}).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) resume[key] = value.trim().slice(0, 1200);
    });
    if (!Object.keys(resume).length) return 0;
    const candidates = remaining.map((field, index) => ({
      index,
      label: field.blob.slice(0, 220),
      type: field.kind,
      options: field.options
    }));
    const response = await chrome.runtime.sendMessage({
      type: 'AI_FIELD_MATCH',
      fields: candidates.slice(0, 120),
      resume
    });
    if (!response?.ok || !response.data?.map) return 0;
    const used = new Set(localUsed || []);
    let count = 0;
    Object.entries(response.data.map).forEach(([indexText, key]) => {
      const index = Number(indexText);
      if (!Number.isInteger(index) || index < 0 || index >= remaining.length) return;
      const field = remaining[index];
      if (!field || !resume[key] || used.has(key) || !isEmptyField(field.el)) return;
      if (writeValue(field.el, profile[key])) { used.add(key); count += 1; }
    });
    return count;
  }

  globalThis.JobFill = {
    async fillPage(profile = {}, settings = {}) {
      const fields = collectFields(document);
      const localResult = fillLocal(fields, profile);
      const localCount = localResult.count;
      let aiCount = 0;
      let aiUsed = false;
      if (settings.aiEnabled && settings.aiKey) {
        try {
          aiCount = await fillWithAi(fields, profile, localResult.used);
          aiUsed = true;
        } catch { aiCount = 0; aiUsed = false; }
      }
      return { filled: localCount + aiCount, total: fields.length, aiUsed };
    }
  };
})();
