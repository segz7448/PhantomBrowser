import AsyncStorage from '@react-native-async-storage/async-storage';

export type PermissionDecision = 'allow' | 'deny' | 'ask';
export type PermissionKind = 'camera' | 'microphone' | 'location';

interface SitePermissionRecord {
  camera: PermissionDecision;
  microphone: PermissionDecision;
  location: PermissionDecision;
}

const STORAGE_KEY = 'phantom_site_permissions';
const DEFAULT_RECORD: SitePermissionRecord = {camera: 'ask', microphone: 'ask', location: 'ask'};

async function readAll(): Promise<Record<string, SitePermissionRecord>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeAll(data: Record<string, SitePermissionRecord>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const SitePermissions = {
  async get(origin: string): Promise<SitePermissionRecord> {
    const all = await readAll();
    return all[origin] ?? DEFAULT_RECORD;
  },

  async set(origin: string, kind: PermissionKind, decision: PermissionDecision): Promise<void> {
    const all = await readAll();
    const current = all[origin] ?? {...DEFAULT_RECORD};
    all[origin] = {...current, [kind]: decision};
    await writeAll(all);
  },
};

export default SitePermissions;
