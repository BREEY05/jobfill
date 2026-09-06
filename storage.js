const DEFAULT_PROFILE = {
  name: '', politicalStatus: '', school: '', major: '', education: '',
  birthPlace: '', residence: '', phone: '', email: '',
  projects: '', awards: '', campus: '', certificates: '', skills: '',
  updatedAt: ''
};
const DEFAULT_SETTINGS = { aiEnabled: false, aiKey: '', aiModel: 'deepseek-v4-pro' };

async function getProfile() {
  const data = await chrome.storage.local.get({ profile: DEFAULT_PROFILE });
  return { ...DEFAULT_PROFILE, ...data.profile };
}
async function saveProfile(profile) {
  await chrome.storage.local.set({ profile: { ...DEFAULT_PROFILE, ...profile, updatedAt: new Date().toISOString() } });
}
async function getSettings() {
  const data = await chrome.storage.local.get({ settings: DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS, ...data.settings };
}
async function saveSettings(settings) {
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
}