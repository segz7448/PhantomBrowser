import React, {useState} from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {useTheme} from '../services/Theme';

interface Props {
  url: string;
  size?: number;
  rounded?: number;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function Favicon({url, size = 18, rounded = 5}: Props) {
  const theme = useTheme();
  const domain = getDomain(url);
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    const letter = domain ? domain[0].toUpperCase() : '?';
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: rounded,
            backgroundColor: theme.primarySoft,
          },
        ]}>
        <Text style={[styles.fallbackText, {color: theme.primary, fontSize: size * 0.55}]}>{letter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{uri: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`}}
      style={{width: size, height: size, borderRadius: rounded}}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {alignItems: 'center', justifyContent: 'center'},
  fallbackText: {fontWeight: '700'},
});
