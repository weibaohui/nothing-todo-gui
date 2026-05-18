import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import NtdManager from "./components/NtdManager";
import "./App.css";

type NtdStatus =
  | { tag: "loading" }
  | { tag: "not-installed" }
  | { tag: "starting" }
  | { tag: "stopped" }
  | { tag: "running"; port: number }
  | { tag: "error"; message: string };

interface CheckResult {
  installed: boolean;
  running: boolean;
  port: number;
}

function App() {
  const [status, setStatus] = useState<NtdStatus>({ tag: "loading" });
  const [showManager, setShowManager] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const checkStatus = useCallback(async (autoStart = true) => {
    setStatus({ tag: "loading" });
    try {
      const result = await invoke<CheckResult>("check_status");
      if (!result.installed) {
        setStatus({ tag: "not-installed" });
      } else if (result.running) {
        setStatus({ tag: "running", port: result.port });
      } else if (autoStart) {
        setStatus({ tag: "starting" });
        try {
          const port = await invoke<number>("start_daemon");
          setStatus({ tag: "running", port });
        } catch (e) {
          setStatus({
            tag: "error",
            message: typeof e === "string" ? e : "启动失败，请手动启动 ntd daemon",
          });
        }
      } else {
        setStatus({ tag: "stopped" });
      }
    } catch (e) {
      setStatus({
        tag: "error",
        message: typeof e === "string" ? e : "检查状态失败",
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for Tauri menu events to toggle manager panel
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen("toggle-ntd-manager", () => {
        setShowManager((prev) => !prev);
      });
    }
    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleInstall = async () => {
    try {
      await invoke("install_ntd");
      // After install, check status
      setTimeout(checkStatus, 2000);
    } catch (e) {
      // If install fails, user needs to do it manually
      console.error("Install failed:", e);
    }
  };

  const iframeUrl =
    status.tag === "running"
      ? `http://localhost:${status.port}`
      : null;

  return (
    <div className="app">
      {/* ntd 管理按钮 */}
      <button
        className="manager-toggle"
        onClick={() => setShowManager(!showManager)}
        title="管理"
      >
        ⚙️
      </button>

      {/* 管理面板 */}
      <NtdManager
        open={showManager}
        onClose={() => setShowManager(false)}
        status={status}
        onRefresh={checkStatus}
      />

      {/* 主内容区 */}
      <div className="main-content">
        {status.tag === "loading" && (
          <div className="status-page">
            <div className="spinner" />
            <h2>检查 ntd 状态...</h2>
          </div>
        )}

        {status.tag === "not-installed" && (
          <div className="status-page">
            <div className="icon">📦</div>
            <h2>ntd 未安装</h2>
            <p>请按照以下步骤安装 ntd：</p>
            <div className="install-steps">
              <div className="step">
                <span className="step-num">1</span>
                <span>安装 ntd</span>
              </div>
              <code className="command-block">npm install -g @weibaohui/nothing-todo@latest</code>
              <div className="step">
                <span className="step-num">2</span>
                <span>刷新检测</span>
              </div>
              <button className="btn-primary" onClick={handleInstall}>
                检查安装
              </button>
            </div>
          </div>
        )}

        {status.tag === "starting" && (
          <div className="status-page">
            <div className="spinner" />
            <h2>正在启动 ntd 服务...</h2>
            <p>请稍候</p>
          </div>
        )}

        {status.tag === "error" && (
          <div className="status-page error">
            <div className="icon">❌</div>
            <h2>启动失败</h2>
            <p>{status.message}</p>
            <div className="error-actions">
              <button className="btn-primary" onClick={() => checkStatus()}>
                重试
              </button>
              <p className="hint">
                也可以手动在终端中运行：<code>ntd daemon start</code>
              </p>
            </div>
          </div>
        )}

        {status.tag === "stopped" && (
          <div className="status-page">
            <div className="icon">⏸️</div>
            <h2>ntd 未运行</h2>
            <p>服务已停止，点击"启动"按钮重新运行</p>
            <button className="btn-primary" onClick={() => checkStatus()}>
              启动服务
            </button>
          </div>
        )}

        {status.tag === "running" && (
          <div className="iframe-container">
            {iframeLoading && (
              <div className="iframe-loading">
                <div className="spinner" />
                <p>加载 ntd 页面...</p>
              </div>
            )}
            <iframe
              src={iframeUrl!}
              className="ntd-iframe"
              onLoad={() => setIframeLoading(false)}
              title="ntd Web UI"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
