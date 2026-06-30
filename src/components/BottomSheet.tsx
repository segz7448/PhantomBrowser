import React, {useEffect, useRef} from 'react';
import {Modal, View, TouchableWithoutFeedback, Animated, StyleSheet, Dimensions} from 'react-native';
import {useTheme} from '../services/Theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export default function BottomSheet({visible, onDismiss, children, maxHeightRatio = 0.85}: Props) {
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
        }),
        Animated.timing(overlayOpacity, {toValue: 1, duration: 180, useNativeDriver: true}),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true}),
        Animated.timing(overlayOpacity, {toValue: 0, duration: 180, useNativeDriver: true}),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <Animated.View style={[styles.overlay, {opacity: overlayOpacity, backgroundColor: theme.overlay}]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceElevated,
              maxHeight: SCREEN_HEIGHT * maxHeightRatio,
              transform: [{translateY}],
            },
          ]}>
          <View style={[styles.grabber, {backgroundColor: theme.border}]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  overlay: {...StyleSheet.absoluteFillObject},
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
});
