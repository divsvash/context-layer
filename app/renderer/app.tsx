import React, { useState, useEffect } from 'react';
import styles from './App.module.css';

declare global {
  interface Window {
    cortex: {
      ping: () => Promise<string>;
      quit: () => void;
      toggleOverlay: () => void;
      focusWindow: () => void;
      setExpanded: (expanded: boolean) => void;
    };
  }
}

export function App(): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ipcStatus, setIpcStatus] = useState<string>('checking...');

  useEffect(() => {
    const testIPC = async () => {
      try {
        const response = await window.cortex.ping();
        setIpcStatus(`Connected: ${response}`);
      } catch (error) {
        setIpcStatus('Disconnected');
        console.error('IPC test failed:', error);
      }
    };
    testIPC();
  }, []);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    window.cortex.setExpanded(newExpanded);
  };

  const handleQuit = () => {
    window.cortex.quit();
  };

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        {!isExpanded ? (
          <div className={styles.collapsed} onClick={handleToggle}>
            <div className={styles.statusDot} />
            <span className={styles.appName}>Cortex</span>
            <span className={styles.statusText}>{ipcStatus}</span>
          </div>
        ) : (
          <div className={styles.expanded}>
            <div className={styles.header}>
              <span className={styles.appName}>Cortex</span>
              <button className={styles.closeButton} onClick={handleToggle}>✕</button>
            </div>
            <div className={styles.content}>
              <p>Project: No project loaded</p>
              <p>Status: {ipcStatus}</p>
              <button className={styles.quitButton} onClick={handleQuit}>
                Quit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}