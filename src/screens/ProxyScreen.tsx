import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useProxy, ProxyConfig} from '../services/ProxyContext';
import Toast from 'react-native-toast-message';

export default function ProxyScreen() {
  const {config, isConnected, isConnecting, chain, error, connect, disconnect, recheckIP} =
    useProxy();

  const [server, setServer] = useState(config?.server ?? '');
  const [port, setPort] = useState(config?.port?.toString() ?? '1080');
  const [username, setUsername] = useState(config?.username ?? '');
  const [password, setPassword] = useState(config?.password ?? '');
  const [showPassword, setShowPassword] = useState(false);

  // FIX: sync form fields when config loads from storage
  useEffect(() => {
    if (config) {
      setServer(config.server);
      setPort(config.port.toString());
      setUsername(config.username);
      setPassword(config.password);
    }
  }, [config]);

  const handleConnect = async () => {
    if (!server.trim()) {
      Toast.show({type: 'error', text1: 'Server required'});
      return;
    }
    const parsedPort = parseInt(port, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      Toast.show({type: 'error', text1: 'Invalid port (1–65535)'});
      return;
    }
    const cfg: ProxyConfig = {
      server: server.trim(),
      port: parsedPort,
      username: username.trim(),
      password,
    };
    const ok = await connect(cfg);
    if (ok) {
      // FIX: chain may not be updated in state yet right after connect resolves;
      // the exitIP comes back in the result so we use the toast from ProxyContext's state refresh.
      Toast.show({type: 'success', text1: 'Proxy connected'});
    } else {
      Toast.show({type: 'error', text1: 'Connection failed', text2: error ?? 'Check credentials'});
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    Toast.show({type: 'info', text1: 'Proxy disconnected'});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SOCKS5 Proxy</Text>

      {/* Connection Chain Visualization */}
      {isConnected && chain && (
        <View style={styles.chainCard}>
          <Text style={styles.chainTitle}>🔗 Connection Chain</Text>
          <View style={styles.chain}>
            <ChainNode label="Your App" sub="PhantomBrowser" color="#7c3aed" />
            <Arrow />
            <ChainNode label="Local Bridge" sub={chain.localBridge} color="#2563eb" />
            <Arrow />
            <ChainNode label="SOCKS5 Server" sub={chain.socks5Server} color="#0891b2" />
            <Arrow />
            <ChainNode label="Internet" sub={`Exit: ${chain.exitIP}`} color="#16a34a" />
          </View>
          <View style={styles.chainMeta}>
            <MetaRow label="DNS Mode" value={chain.dnsMode} good={true} />
            <MetaRow label="Latency" value={`${chain.latency.toFixed(0)}ms`} good={chain.latency < 500} />
            <MetaRow label="WebRTC" value="Blocked" good={true} />
            <MetaRow label="QUIC" value="Disabled" good={true} />
          </View>
          <TouchableOpacity style={styles.recheckBtn} onPress={recheckIP}>
            <Text style={styles.recheckText}>↻ Re-check IP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Config Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Proxy Configuration</Text>

        <Text style={styles.label}>Server Host</Text>
        <TextInput
          style={styles.input}
          value={server}
          onChangeText={setServer}
          placeholder="proxy.example.com"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isConnected}
        />

        <Text style={styles.label}>Port</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder="1080"
          placeholderTextColor="#444"
          keyboardType="numeric"
          editable={!isConnected}
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="(optional)"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isConnected}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, {flex: 1, marginBottom: 0}]}
            value={password}
            onChangeText={setPassword}
            placeholder="(optional)"
            placeholderTextColor="#444"
            secureTextEntry={!showPassword}
            editable={!isConnected}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(s => !s)}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {error && !isConnected && (
          <Text style={styles.errorText}>⚠ {error}</Text>
        )}

        {isConnected ? (
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.btnText}>Disconnect Proxy</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={isConnecting}>
            {isConnecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Connect</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          Your app → Local HTTP bridge (port 8118) → SOCKS5H upstream → Internet{'\n\n'}
          DNS is resolved by the proxy server (SOCKS5H), so your ISP never sees which sites you visit.
          WebRTC is fully blocked to prevent IP leaks.
        </Text>
      </View>
    </ScrollView>
  );
}

function ChainNode({label, sub, color}: {label: string; sub: string; color: string}) {
  return (
    <View style={[styles.node, {borderColor: color}]}>
      <Text style={[styles.nodeLabel, {color}]}>{label}</Text>
      <Text style={styles.nodeSub}>{sub}</Text>
    </View>
  );
}

function Arrow() {
  return <Text style={styles.arrow}>→</Text>;
}

// FIX: good prop was typed as `boolean` but passed as `{good}` without explicit boolean in JSX
function MetaRow({label, value, good}: {label: string; value: string; good: boolean}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, {color: good ? '#22c55e' : '#f59e0b'}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  content: {padding: 16, paddingBottom: 40},
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16, marginTop: 8},
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16},
  label: {color: '#9ca3af', fontSize: 12, marginBottom: 4, marginTop: 8},
  input: {
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  passwordRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  eyeBtn: {padding: 10, marginLeft: 8},
  eyeText: {fontSize: 18},
  connectBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disconnectBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {color: '#fff', fontWeight: '700', fontSize: 15},
  errorText: {color: '#ef4444', fontSize: 12, marginBottom: 8},
  chainCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  chainTitle: {color: '#7c3aed', fontSize: 14, fontWeight: '700', marginBottom: 12},
  chain: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12},
  node: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  nodeLabel: {fontSize: 11, fontWeight: '700'},
  nodeSub: {color: '#6b7280', fontSize: 9, marginTop: 2, textAlign: 'center'},
  arrow: {color: '#374151', fontSize: 16, marginHorizontal: 4},
  chainMeta: {marginTop: 8},
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {color: '#9ca3af', fontSize: 12},
  metaValue: {fontSize: 12, fontWeight: '600'},
  recheckBtn: {marginTop: 8, alignItems: 'center'},
  recheckText: {color: '#7c3aed', fontSize: 13},
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  infoTitle: {color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 8},
  infoText: {color: '#6b7280', fontSize: 12, lineHeight: 20},
});
