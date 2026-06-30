import React from 'react';
import {Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions} from 'react-native';

export interface TabSummary {
  id: string;
  title: string;
  url: string;
}

interface Props {
  visible: boolean;
  tabs: TabSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onDismiss: () => void;
}

const {width} = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - CARD_MARGIN * 6) / 2;

export default function TabSwitcher({visible, tabs, activeId, onSelect, onClose, onNewTab, onDismiss}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={tabs}
          numColumns={2}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.grid}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[styles.card, item.id === activeId && styles.cardActive]}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.85}>
              <View style={styles.cardTopBar}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || item.url || 'New Tab'}
                </Text>
                <TouchableOpacity hitSlop={{top: 10, bottom: 10, left: 10, right: 10}} onPress={() => onClose(item.id)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardPreview}>
                <Text style={styles.cardUrl} numberOfLines={2}>
                  {item.url || 'about:blank'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity style={styles.newTabBtn} onPress={onNewTab}>
          <Text style={styles.newTabIcon}>+</Text>
          <Text style={styles.newTabText}>New Tab</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', paddingTop: 48},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '700'},
  doneBtn: {paddingHorizontal: 10, paddingVertical: 6},
  doneText: {color: '#7c3aed', fontSize: 15, fontWeight: '700'},
  grid: {paddingHorizontal: CARD_MARGIN, paddingBottom: 16},
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.15,
    margin: CARD_MARGIN / 2,
    backgroundColor: '#16161f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222230',
    overflow: 'hidden',
  },
  cardActive: {borderColor: '#7c3aed', borderWidth: 2},
  cardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1d1d2b',
  },
  cardTitle: {color: '#fff', fontSize: 12, fontWeight: '600', flex: 1, marginRight: 6},
  closeBtn: {color: '#888', fontSize: 14, fontWeight: '700'},
  cardPreview: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10},
  cardUrl: {color: '#666', fontSize: 11, textAlign: 'center'},
  newTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  newTabIcon: {color: '#7c3aed', fontSize: 20, fontWeight: '700', marginRight: 8},
  newTabText: {color: '#7c3aed', fontSize: 15, fontWeight: '700'},
});
