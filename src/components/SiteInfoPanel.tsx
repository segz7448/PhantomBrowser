import React, {useState, useEffect, useCallback} from 'react';
import {Modal, View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import SitePermissions, {PermissionDecision, PermissionKind} from '../services/SitePermissions';
import {useTheme, elevation} from '../services/Theme';
import haptics from '../services/haptics';

interface Props {
  visible: boolean;
  origin: string;
  isConnected: boolean;
  exitIP?: string;
  onDismiss: () => void;
}

const PERMISSION_LABELS: {key: PermissionKind; label: string; icon: string}[] = [
  {key: 'camera', label: 'Camera', icon: '📷'},
  {key: 'microphone', label: 'Microphone', icon: '🎙️'},
  {key: 'location', label: 'Location', icon: '📍'},
];

const DECISIONS: PermissionDecision[] = ['ask', 'allow', 'deny'];

export default function SiteInfoPanel({visible, origin, isConnected, exitIP, onDismiss}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [perms, setPerms] = useState<Record<PermissionKind, PermissionDecision>>({
    camera: 'ask',
    microphone: 'ask',
    location: 'ask',
  });

  const refresh = useCallback(async () => {
    if (!origin) return;
    const rec = await SitePermissions.get(origin);
    setPerms({camera: rec.camera, microphone: rec.microphone, location: rec.location});
  }, [origin]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const cycleDecision = async (kind: PermissionKind) => {
    haptics.light();
    const current = perms[kind];
    const next = DECISIONS[(DECISIONS.indexOf(current) + 1) % DECISIONS.length];
    setPerms(p => ({...p, [kind]: next}));
    await SitePermissions.set(origin, kind, next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.lockIcon, {color: isConnected ? theme.success : theme.danger}]}>🔒</Text>
            <Text style={styles.origin} numberOfLines={1}>{origin}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.dot, {backgroundColor: isConnected ? theme.success : theme.danger}]} />
            <Text style={styles.statusText}>
              {isConnected ? `Traffic routed via proxy${exitIP ? ` · ${exitIP}` : ''}` : 'Not routed through proxy'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>SITE PERMISSIONS</Text>
          {PERMISSION_LABELS.map(({key, label, icon}) => (
            <TouchableOpacity key={key} style={styles.permRow} onPress={() => cycleDecision(key)}>
              <Text style={styles.permIcon}>{icon}</Text>
              <Text style={styles.permLabel}>{label}</Text>
              <View
                style={[
                  styles.permBadge,
                  perms[key] === 'allow' && {backgroundColor: theme.success},
                  perms[key] === 'deny' && {backgroundColor: theme.danger},
                ]}>
                <Text style={[styles.permBadgeText, perms[key] !== 'ask' && {color: theme.onPrimary}]}>
                  {perms[key]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.doneBtn} onPress={onDismiss}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-start', paddingTop: 90, paddingHorizontal: 16},
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      ...elevation(theme, 3),
    },
    header: {flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8},
    lockIcon: {fontSize: 16},
    origin: {color: theme.text, fontSize: 15, fontWeight: '700', flex: 1},
    statusRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8},
    dot: {width: 7, height: 7, borderRadius: 4},
    statusText: {color: theme.textMuted, fontSize: 12, flex: 1},
    sectionLabel: {color: theme.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8},
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    permIcon: {fontSize: 16, marginRight: 10},
    permLabel: {color: theme.text, fontSize: 13, flex: 1},
    permBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.surfaceElevated},
    permBadgeText: {color: theme.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'capitalize'},
    doneBtn: {marginTop: 16, alignItems: 'center', paddingVertical: 10},
    doneBtnText: {color: theme.primary, fontWeight: '700', fontSize: 14},
  });
