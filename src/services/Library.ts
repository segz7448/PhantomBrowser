import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LibraryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

const BOOKMARKS_KEY = 'phantom_bookmarks';
const HISTORY_KEY = 'phantom_history';
const MAX_HISTORY = 300;

async function readList(key: string): Promise<LibraryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: LibraryEntry[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export const Library = {
  async getBookmarks(): Promise<LibraryEntry[]> {
    return readList(BOOKMARKS_KEY);
  },

  async isBookmarked(url: string): Promise<boolean> {
    const list = await readList(BOOKMARKS_KEY);
    return list.some(b => b.url === url);
  },

  async toggleBookmark(url: string, title: string): Promise<boolean> {
    const list = await readList(BOOKMARKS_KEY);
    const idx = list.findIndex(b => b.url === url);
    if (idx >= 0) {
      list.splice(idx, 1);
      await writeList(BOOKMARKS_KEY, list);
      return false;
    }
    list.unshift({id: `${Date.now()}`, url, title: title || url, timestamp: Date.now()});
    await writeList(BOOKMARKS_KEY, list);
    return true;
  },

  async removeBookmark(id: string): Promise<void> {
    const list = await readList(BOOKMARKS_KEY);
    await writeList(BOOKMARKS_KEY, list.filter(b => b.id !== id));
  },

  async getHistory(): Promise<LibraryEntry[]> {
    return readList(HISTORY_KEY);
  },

  async addHistory(url: string, title: string): Promise<void> {
    // Skip internal/blank pages from cluttering history
    if (!url || url.startsWith('about:')) return;
    const list = await readList(HISTORY_KEY);
    const filtered = list.filter(h => h.url !== url);
    filtered.unshift({id: `${Date.now()}`, url, title: title || url, timestamp: Date.now()});
    await writeList(HISTORY_KEY, filtered.slice(0, MAX_HISTORY));
  },

  async clearHistory(): Promise<void> {
    await writeList(HISTORY_KEY, []);
  },

  async removeHistoryEntry(id: string): Promise<void> {
    const list = await readList(HISTORY_KEY);
    await writeList(HISTORY_KEY, list.filter(h => h.id !== id));
  },
};

export default Library;
