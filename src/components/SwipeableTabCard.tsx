import React, {useRef} from 'react';
import {Animated, PanResponder} from 'react-native';

interface Props {
  onSwipeClose: () => void;
  children: React.ReactNode;
  style?: any;
}

const SWIPE_THRESHOLD = 90;

export default function SwipeableTabCard({onSwipeClose, children, style}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
        opacity.setValue(1 - Math.min(Math.abs(g.dx) / 220, 0.75));
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: g.dx > 0 ? 600 : -600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onSwipeClose());
        } else {
          Animated.parallel([
            Animated.spring(translateX, {toValue: 0, useNativeDriver: true, damping: 16, stiffness: 200}),
            Animated.timing(opacity, {toValue: 1, duration: 150, useNativeDriver: true}),
          ]).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View style={[style, {transform: [{translateX}], opacity}]} {...panResponder.panHandlers}>
      {children}
    </Animated.View>
  );
}
