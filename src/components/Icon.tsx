import React from 'react';
import {View} from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

export function ChevronIcon({size = 20, color = '#fff', direction = 'left'}: IconProps & {direction?: 'left' | 'right'}) {
  const rotate = direction === 'left' ? '225deg' : '45deg';
  return (
    <View
      style={{
        width: size * 0.45,
        height: size * 0.45,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{rotate}],
      }}
    />
  );
}

export function PlusIcon({size = 20, color = '#fff'}: IconProps) {
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{position: 'absolute', width: size * 0.7, height: 2, backgroundColor: color, borderRadius: 1}} />
      <View style={{position: 'absolute', width: 2, height: size * 0.7, backgroundColor: color, borderRadius: 1}} />
    </View>
  );
}

export function CloseIcon({size = 16, color = '#fff'}: IconProps) {
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.75,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{rotate: '45deg'}],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.75,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{rotate: '-45deg'}],
        }}
      />
    </View>
  );
}

export function DotsIcon({size = 20, color = '#fff'}: IconProps) {
  const dot = (
    <View style={{width: 4, height: 4, borderRadius: 2, backgroundColor: color}} />
  );
  return (
    <View style={{width: size, flexDirection: 'row', justifyContent: 'center', gap: 3}}>
      {dot}
      {dot}
      {dot}
    </View>
  );
}

export function ReloadIcon({size = 20, color = '#fff'}: IconProps) {
  return (
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderRadius: size * 0.3,
        borderWidth: 2,
        borderColor: color,
        borderRightColor: 'transparent',
        transform: [{rotate: '20deg'}],
      }}
    />
  );
}

export function LockIcon({size = 14, color = '#22c55e'}: IconProps) {
  return (
    <View style={{alignItems: 'center'}}>
      <View
        style={{
          width: size * 0.6,
          height: size * 0.45,
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0,
          borderTopLeftRadius: size * 0.3,
          borderTopRightRadius: size * 0.3,
        }}
      />
      <View
        style={{
          width: size * 0.85,
          height: size * 0.55,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

export function StarIcon({size = 18, color = '#fbbf24', filled = false}: IconProps & {filled?: boolean}) {
  // Simple diamond-cross approximation; avoids needing an SVG lib for a 5-point star.
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.75,
          backgroundColor: filled ? color : 'transparent',
          borderWidth: filled ? 0 : 1.5,
          borderColor: color,
          transform: [{rotate: '45deg'}],
          borderRadius: 2,
        }}
      />
    </View>
  );
}
