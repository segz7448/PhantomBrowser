import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import {v4 as uuidv4} from 'uuid';
import Toast from 'react-native-toast-message';

interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  password: string;
  createdAt: string;
}

const STORAGE_KEY = 'phantom_passwords';

export default function PasswordScreen() {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [form, setForm] = useState({site: '', username: '', password: ''});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const raw = await EncryptedStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {}
  };

  const saveEntries = async (list: PasswordEntry[]) => {
    await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setEntries(list);
  };

  const openAdd = () => {
    setEditEntry(null);
    setForm({site: '', username: '', password: ''});
    setModalVisible(true);
  };

  const openEdit = (entry: PasswordEntry) => {
    setEditEntry(entry);
    setForm({site: entry.site, username: entry.username, password: entry.password});
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.site.trim() || !form.username.trim()) {
      Toast.show({type: 'error', text1: 'Site and username required'});
      return;
    }
    let updated: PasswordEntry[];
    if (editEntry) {
      updated = entries.map(e =>
        e.id === editEntry.id ? {...editEntry, ...form} : e,
      );
    } else {
      const newEntry: PasswordEntry = {
        id: uuidv4(),
        ...form,
        createdAt: new Date().toISOString(),
      };
      updated = [newEntry, ...entries];
    }
    await saveEntries(updated);
    setModalVisible(false);
    Toast.show({type: 'success', text1: editEntry ? 'Updated' : 'Saved'});
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this password?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = entries.filter(e => e.id !== id);
          await saveEntries(updated);
        },
      },
    ]);
  };

  const filtered = entries.filter(
    e =>
      e.site.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Vault</Text>
      <Text style={styles.subtitle}>Encrypted on-device storage</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔐</Text>
            <Text style={styles.emptyText}>No passwords saved yet</Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.entryCard}>
            <View style={styles.entryLeft}>
              <Text style={styles.entrySite}>{item.site}</Text>
              <Text style={styles.entryUser}>{item.username}</Text>
              <Text style={styles.entryPass}>
                {showPasswords[item.id] ? item.password : '••••••••'}
              </Text>
            </View>
            <View style={styles.entryActions}>
              <TouchableOpacity
                onPress={() => setShowPasswords(s => ({...s, [item.id]: !s[item.id]}))}
                style={styles.actionBtn}>
                <Text style={styles.actionIcon}>{showPasswords[item.id] ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editEntry ? 'Edit Password' : 'Add Password'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Site (e.g. github.com)"
              placeholderTextColor="#444"
              value={form.site}
              onChangeText={v => setForm(f => ({...f, site: v}))}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Username / Email"
              placeholderTextColor="#444"
              value={form.username}
              onChangeText={v => setForm(f => ({...f, username: v}))}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#444"
              value={form.password}
              onChangeText={v => setForm(f => ({...f, password: v}))}
              secureTextEntry
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', padding: 16},
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8},
  subtitle: {color: '#6b7280', fontSize: 12, marginBottom: 16},
  searchRow: {flexDirection: 'row', marginBottom: 12, gap: 8},
  searchInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  addBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: {color: '#fff', fontWeight: '700'},
  entryCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  entryLeft: {flex: 1},
  entrySite: {color: '#fff', fontSize: 15, fontWeight: '600'},
  entryUser: {color: '#9ca3af', fontSize: 12, marginTop: 2},
  entryPass: {color: '#6b7280', fontSize: 12, marginTop: 2, fontFamily: 'monospace'},
  entryActions: {flexDirection: 'row'},
  actionBtn: {padding: 6},
  actionIcon: {fontSize: 16},
  empty: {alignItems: 'center', marginTop: 60},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {color: '#6b7280', fontSize: 14},
  modalOverlay: {flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end'},
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalTitle: {color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16},
  input: {
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalBtns: {flexDirection: 'row', gap: 12, marginTop: 8},
  cancelBtn: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {color: '#9ca3af', fontWeight: '600'},
  saveBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {color: '#fff', fontWeight: '700'},
});
