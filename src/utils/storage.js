const read = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ } };
export const getList = () => read('cinora:list:v1', []);
export const saveList = (items) => write('cinora:list:v1', items);
export const getProgress = () => read('cinora:progress:v1', []);
export const saveProgress = (items) => write('cinora:progress:v1', items);
export function toggleList(item) {
  const list = getList();
  const exists = list.some((entry) => entry.id === item.id && entry.media_type === item.media_type);
  const next = exists ? list.filter((entry) => !(entry.id === item.id && entry.media_type === item.media_type)) : [item, ...list];
  saveList(next); return !exists;
}
export function trackProgress(item, season = null, episode = null) {
  const progress = getProgress().filter((entry) => !(entry.id === item.id && entry.media_type === item.media_type));
  progress.unshift({ ...item, season, episode, updatedAt: Date.now() });
  saveProgress(progress.slice(0, 20));
}
