import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket(url, onMessage) {
  const [status, setStatus] = useState('connecting');
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const reconnectAttempt = useRef(0);

  const connect = useCallback(() => {
    if (!url) return;
    
    console.log(`[WS] Connecting to ${url}...`);
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      console.log(`[WS] Connected to ${url}`);
      setStatus('connected');
      reconnectAttempt.current = 0; // Reset on success
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    socket.onclose = () => {
      console.log(`[WS] Disconnected from ${url}`);
      setStatus('disconnected');
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      console.log(`[WS] Reconnecting in ${delay/1000}s (attempt ${reconnectAttempt.current + 1})`);
      
      reconnectTimeout.current = setTimeout(() => {
        reconnectAttempt.current += 1;
        connect();
      }, delay);
    };


    socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      socket.close();
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  const sendMessage = (msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  };

  return { status, sendMessage };
}
