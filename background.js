async function callDeepSeek(systemPrompt, userText) {
  const data = await chrome.storage.local.get({ settings: { aiKey: '', aiModel: 'deepseek-v4-pro' } });
  const settings = data.settings || {};
  if (!settings.aiKey) throw new Error('尚未填写 DeepSeek API Key');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.aiKey}` },
    body: JSON.stringify({
      model: settings.aiModel || 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8192
    })
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`);
  return String(json?.choices?.[0]?.message?.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

const PARSE_PROMPT = `你是中文简历结构化助手。根据用户提供的简历文本，只输出 JSON：
{"profile":{"name":"","politicalStatus":"","school":"","major":"","education":"","birthPlace":"","residence":"","phone":"","email":"","projects":"","awards":"","campus":"","certificates":"","skills":""}}
规则：只输出 JSON；忠于原文不编造；字段没有内容就省略该键；多段项目/获奖等经历用换行分隔；日期保留原文。`;

const MATCH_PROMPT = `你是招聘网页表单识别助手。用户提供页面字段数组和简历资料。
页面字段：fields=[{index,text,kind}]，text 是该字段周围的标签、占位符或容器文本。
简历资料：resume 是键值对象，只有有内容的键。
任务：判断每个页面字段最可能对应简历中的哪个键；没有把握的 index 不要返回。只输出 JSON：
{"map":{"0":"name","1":"school","2":""}}
简历键只能是 resume 中出现的键。宁缺毋滥：填错比留空严重。`;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || (message.type !== 'AI_RESUME_PARSE' && message.type !== 'AI_FIELD_MATCH')) return undefined;
  (async () => {
    try {
      const prompt = message.type === 'AI_RESUME_PARSE' ? PARSE_PROMPT : MATCH_PROMPT;
      const userText = message.type === 'AI_RESUME_PARSE'
        ? message.resumeText
        : JSON.stringify({ fields: message.fields || [], resume: message.resume || {} });
      const content = await callDeepSeek(prompt, userText);
      let parsed;
      try { parsed = JSON.parse(content); }
      catch { throw new Error('AI 返回的不是合法 JSON'); }
      sendResponse({ ok: true, data: parsed });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});