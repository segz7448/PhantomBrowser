import React, {useState, useEffect, useCallback} from 'react';
import {Modal, View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import SitePermissions, {PermissionDecision, PermissionKind} from '../services/SitePermissions';
import {LockIcon} from './Icon';
import theme from '../theme';

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
            <LockIcon size={20} color={isConnected ? theme.colors.success : theme.colors.danger} />
            <Text style={styles.origin} numberOfLines={1}>{origin}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.dot, {backgroundColor: isConnected ? theme.colors.success : theme.colors.danger}]} />
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
                  perms[key] === 'allow' && styles.permBadgeAllow,
                  perms[key] === 'deny' && styles.permBadgeDeny,
                ]}>
                <Text style={styles.permBadgeText}>{perms[key]}</Text>
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

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', paddingTop: 90, paddingHorizontal: 16},
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8},
  origin: {color: theme.colors.text, fontSize: 15, fontWeight: '700', flex: 1},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8},
  dot: {width: 7, height: 7, borderRadius: 4},
  statusText: {color: theme.colors.textDim, fontSize: 12, flex: 1},
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  permIcon: {fontSize: 16, marginRight: 10},
  permLabel: {color: theme.colors.text, fontSize: 13, flex: 1},
  permBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  permBadgeAllow: {backgroundColor: '#14532d'},
  permBadgeDeny: {backgroundColor: '#450a0a'},
  permBadgeText: {color: theme.colors.textDim, fontSize: 11, fontWeight: '600', textTransform: 'capitalize'},
  doneBtn: {marginTop: 16, alignItems: 'center', paddingVertical: 10},
  doneBtnText: {color: theme.colors.accent, fontWeight: '700', fontSize: 14},
});
