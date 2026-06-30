import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet} from 'react-native';
import {useTheme} from '../services/Theme';

interface Props {
  loading: boolean;
}

export default function ProgressBar({loading}: Props) {
  const theme = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      widthAnim.setValue(0);
      opacityAnim.setValue(1);
      Animated.timing(widthAnim, {
        toValue: 0.85,
        duration: 900,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(widthAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          delay: 80,
          useNativeDriver: false,
        }).start(() => widthAnim.setValue(0));
      });
    }
  }, [loading, widthAnim, opacityAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.track, {opacity: opacityAnim, backgroundColor: theme.primarySoft}]}>
      <Animated.View style={[styles.fill, {width, backgroundColor: theme.primary}]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {height: 2.5, width: '100%', overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 2},
});
