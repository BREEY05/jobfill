const DEFAULT_PROFILE = {
  name: '', politicalStatus: '', school: '', major: '', education: '',
  birthPlace: '', residence: '', phone: '', email: '',
  projects: '', awards: '', campus: '', certificates: '', skills: '',
  resumeText: '', resumeName: '', updatedAt: ''
};

async function getProfile() {
  const data = await chrome.storage.local.get({ profile: DEFAULT_PROFILE });
  return { ...DEFAULT_PROFILE, ...data.profile };
}
async function saveProfile(profile) {
  await chrome.storage.local.set({ profile: { ...DEFAULT_PROFILE, ...profile, updatedAt: new Date().toISOString() } });
}
