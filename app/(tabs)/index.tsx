import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Change this to your web app's URL
const TARGET_URL = 'http://localhost:3000/';

export default function HomeScreen() {
  return <WebWrapper url={TARGET_URL} />;
}

function WebWrapper({ url }: { url: string }) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView | null>(null);
  const [iframeSrc, setIframeSrc] = useState(url);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // detect web platform in a type-safe way
  const isWeb = Platform.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');

  // Setup WebSocket to listen for reload signals and trigger reloads appropriately.
  useEffect(() => {
    let host: string | null = null;
    try {
      const u = new URL(url);
      host = u.host;
    } catch {
      // fallback: do nothing
    }

    // choose secure websocket when target is https
    const protocol = url.startsWith('https') ? 'wss' : 'ws';
    if (!host) return;

    const wsUrl = `${protocol}://${host}/ws`;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('Failed to create WebSocket:', err);
      return;
    }

    socket.onopen = () => {
      console.log('ws open', wsUrl);
    };

    socket.onmessage = (ev) => {
      try {
        const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (msg?.type === 'hot-reload') {
            if (isWeb) {
            // update iframe src with cache-buster
            try {
              const u = new URL(url);
              u.searchParams.set('_t', String(Date.now()));
              setIframeSrc(u.toString());
            } catch {
              setIframeSrc(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`);
            }
          } else {
            // native webview reload
            webviewRef.current?.reload();
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onerror = (err) => console.warn('ws error', err);
    socket.onclose = () => console.log('ws closed');

    return () => {
      if (socket) {
        try {
          socket.close();
        } catch {}
      }
    };
  }, [url, isWeb]);

  // On native platforms use react-native-webview and apply top padding from safe area insets
  if (!isWeb) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <WebView ref={(r) => { webviewRef.current = r; }} originWhitelist={["*"]} source={{ uri: url }} style={styles.container} />
      </View>
    );
  }

  // web
  return (
    <div style={{ paddingTop: 'env(safe-area-inset-top)', height: '100vh', boxSizing: 'border-box' }}>
      <iframe
        ref={(r) => { iframeRef.current = r; }}
        src={iframeSrc}
        title="Web App"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
      />
    </div>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});