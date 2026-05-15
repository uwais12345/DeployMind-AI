import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { RefreshCcw, Download } from 'lucide-react';

export default function Logs() {
  const terminalRef = useRef(null);
  const term = useRef(null);

  useEffect(() => {
    if (!term.current && terminalRef.current) {
      term.current = new Terminal({
        theme: {
          background: '#09090b', // Zinc 950
          foreground: '#f4f4f5', // Zinc 100
          cursor: '#f4f4f5',
        },
        fontFamily: '"Fira Code", monospace',
        fontSize: 14,
        rows: 24,
      });
      term.current.open(terminalRef.current);
      term.current.writeln('\x1b[1;34m[DeployMind OS]\x1b[0m Initializing deployment sequence...');
      term.current.writeln('\x1b[1;32m[OK]\x1b[0m Connected to worker node-7a2b9');
      term.current.writeln('\x1b[1;33m[INFO]\x1b[0m Fetching repository from GitHub...');
      
      // Simulate incoming logs
      setTimeout(() => term.current.writeln('\x1b[1;32m[OK]\x1b[0m Repository fetched. Analyzing dependencies...'), 1500);
      setTimeout(() => term.current.writeln('\x1b[1;33m[INFO]\x1b[0m Installing npm packages...'), 3000);
      setTimeout(() => term.current.writeln('added 245 packages in 12s'), 4500);
      setTimeout(() => term.current.writeln('\x1b[1;33m[INFO]\x1b[0m Running build script (vite build)...'), 5500);
      setTimeout(() => term.current.writeln('\x1b[1;32m[OK]\x1b[0m Build complete. Deploying to Vercel edge network...'), 7500);
      setTimeout(() => term.current.writeln('\x1b[1;32m[SUCCESS]\x1b[0m Deployment live at https://mock-deployment.deploymind.app'), 9000);
    }

    return () => {
      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
    };
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl">Build Logs Explorer</CardTitle>
          <CardDescription>Real-time terminal output from the deployment worker.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md overflow-hidden border border-border p-2 bg-[#09090b]">
          <div ref={terminalRef} className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
