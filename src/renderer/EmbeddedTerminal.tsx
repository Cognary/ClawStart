import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

interface EmbeddedTerminalProps {
  sessionId: string | null;
  buffer: string;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

function EmbeddedTerminal({ sessionId, buffer, onInput, onResize }: EmbeddedTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenBufferRef = useRef("");
  const sessionRef = useRef<string | null>(null);
  const lastHostSizeRef = useRef({ width: 0, height: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", "SFMono-Regular", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: "#09100c",
        foreground: "#eef4e8",
        cursor: "#c7ff68",
        selectionBackground: "rgba(199, 255, 104, 0.18)",
        black: "#09100c",
        brightBlack: "#4a5b4d",
        green: "#c7ff68",
        brightGreen: "#d6ff82",
        red: "#ff8f6b",
        brightRed: "#ffb59c",
        yellow: "#f9d66c",
        brightYellow: "#ffe39a",
        cyan: "#7edfd0",
        brightCyan: "#9df1e4",
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current!);
    fitAddon.fit();

    const dataSubscription = terminal.onData((data) => {
      onInput(data);
    });

    const syncTerminalSize = () => {
      if (!hostRef.current) {
        return;
      }

      const nextWidth = hostRef.current.clientWidth;
      const nextHeight = hostRef.current.clientHeight;
      if (nextWidth === lastHostSizeRef.current.width && nextHeight === lastHostSizeRef.current.height) {
        return;
      }

      lastHostSizeRef.current = { width: nextWidth, height: nextHeight };

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        fitAddon.fit();
        onResize(terminal.cols, terminal.rows);
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      syncTerminalSize();
    });

    resizeObserver.observe(hostRef.current!);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    syncTerminalSize();

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      resizeObserver.disconnect();
      dataSubscription.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onInput, onResize]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || !sessionId) {
      return;
    }

    if (sessionRef.current !== sessionId) {
      terminal.reset();
      writtenBufferRef.current = "";
      sessionRef.current = sessionId;
    }

    if (buffer.startsWith(writtenBufferRef.current)) {
      const delta = buffer.slice(writtenBufferRef.current.length);
      if (delta) {
        terminal.write(delta);
      }
    } else {
      terminal.reset();
      terminal.write(buffer);
    }

    writtenBufferRef.current = buffer;
    fitAddon.fit();
    onResize(terminal.cols, terminal.rows);
  }, [buffer, onResize, sessionId]);

  return <div ref={hostRef} className="terminal-host" />;
}

export default EmbeddedTerminal;
