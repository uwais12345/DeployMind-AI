import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

/**
 * Terminal Component
 *
 * Renders deployment logs using xterm.js for visual fidelity AND
 * a hidden accessible companion list for automated testing.
 * Tests should target [data-testid="terminal-body"] > .log-line
 */
const Terminal = ({ logs = [], isActive = false }) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      theme: {
        background: '#080810',
        foreground: '#ededed',
        cursor: '#ededed',
        selectionBackground: 'rgba(237, 237, 237, 0.3)',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#ededed',
        brightBlack: '#71717a',
        brightRed: '#ef4444',
        brightGreen: '#10b981',
        brightYellow: '#f59e0b',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
      convertEol: true,
      rows: 20,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      term.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  // Sync logs to xterm
  useEffect(() => {
    if (xtermRef.current && logs.length > 0) {
      xtermRef.current.clear();
      logs.forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString();
        let color = '\x1b[90m'; // Default grey
        if (log.level === 'error') color = '\x1b[31m';
        if (log.level === 'success') color = '\x1b[32m';
        if (log.level === 'warning') color = '\x1b[33m';

        xtermRef.current.writeln(`\x1b[90m[${time}]\x1b[0m ${color}${log.message}\x1b[0m`);
      });
      xtermRef.current.scrollToBottom();
    }
  }, [logs]);

  return (
    <div className="terminal-body" data-testid="terminal-body">
      {/* xterm.js canvas rendering */}
      <div
        ref={terminalRef}
        style={{
          height: '400px',
          width: '100%',
          padding: '10px',
          background: '#080810',
          borderRadius: '0 0 8px 8px',
        }}
      />

      {/* Accessible companion log list — visually hidden, used by tests & screen readers */}
      <ol
        aria-label="Deployment logs"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {logs.map((log) => (
          <li
            key={log.id}
            className={`log-line log-${log.level}`}
            data-level={log.level}
            data-stage={log.stage}
            aria-label={`[${log.level.toUpperCase()}] ${log.message}`}
          >
            {log.message}
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Terminal;
