import React, {useEffect, useRef} from 'react';
import {Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions, Animated} from 'react-native';
import {useTheme, elevation} from '../services/Theme';
import Favicon from './Favicon';
import SwipeableTabCard from './SwipeableTabCard';
import haptics from '../services/haptics';

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
  const theme = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      rise.setValue(16);
      Animated.parallel([
        Animated.timing(fade, {toValue: 1, duration: 220, useNativeDriver: true}),
        Animated.spring(rise, {toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180}),
      ]).start();
    }
  }, [visible, fade, rise]);

  const handleClose = (id: string) => {
    haptics.light();
    onClose(id);
  };

  const styles = makeStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
          </Text>
          <TouchableOpacity onPress={onDismiss} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{flex: 1, opacity: fade, transform: [{translateY: rise}]}}>
          <FlatList
            data={tabs}
            numColumns={2}
            keyExtractor={t => t.id}
            contentContainerStyle={styles.grid}
            renderItem={({item}) => (
              <SwipeableTabCard onSwipeClose={() => handleClose(item.id)} style={styles.cardWrap}>
                <TouchableOpacity
                  style={[styles.card, item.id === activeId && styles.cardActive]}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.85}>
                  <View style={styles.cardTopBar}>
                    <Favicon url={item.url} size={14} rounded={4} />
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title || item.url || 'New Tab'}
                    </Text>
                    <TouchableOpacity
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      onPress={() => handleClose(item.id)}>
                      <Text style={styles.closeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardPreview}>
                    <Favicon url={item.url} size={36} rounded={10} />
                    <Text style={styles.cardUrl} numberOfLines={2}>
                      {item.url || 'about:blank'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </SwipeableTabCard>
            )}
          />
        </Animated.View>

        <TouchableOpacity style={styles.newTabBtn} onPress={onNewTab}>
          <Text style={styles.newTabIcon}>+</Text>
          <Text style={styles.newTabText}>New Tab</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.background, paddingTop: 48},
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    headerTitle: {color: theme.text, fontSize: 18, fontWeight: '700'},
    doneBtn: {paddingHorizontal: 10, paddingVertical: 6},
    doneText: {color: theme.primary, fontSize: 15, fontWeight: '700'},
    grid: {paddingHorizontal: CARD_MARGIN, paddingBottom: 16},
    cardWrap: {width: CARD_WIDTH, margin: CARD_MARGIN / 2},
    card: {
      height: CARD_WIDTH * 1.15,
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      overflow: 'hidden',
      ...elevation(theme, 1),
    },
    cardActive: {borderColor: theme.primary, borderWidth: 2},
    cardTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: theme.surfaceElevated,
      gap: 6,
    },
    cardTitle: {color: theme.text, fontSize: 12, fontWeight: '600', flex: 1, marginHorizontal: 6},
    closeBtn: {color: theme.textMuted, fontSize: 14, fontWeight: '700'},
    cardPreview: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8},
    cardUrl: {color: theme.textMuted, fontSize: 11, textAlign: 'center'},
    newTabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      margin: 16,
      backgroundColor: theme.primarySoft,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    newTabIcon: {color: theme.primary, fontSize: 20, fontWeight: '700', marginRight: 8},
    newTabText: {color: theme.primary, fontSize: 15, fontWeight: '700'},
  });
