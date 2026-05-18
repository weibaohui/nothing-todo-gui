import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./NtdManager.css";

interface NtdStatus {
  tag: "loading" | "not-installed" | "starting" | "stopped" | "error";
  port?: number;
  message?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  status: NtdStatus | { tag: "running"; port: number };
  onRefresh: (autoStart?: boolean) => void;
}

function NtdManager({ open, onClose, status, onRefresh }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isRunning = status.tag === "running";

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setActionLoading(action);
    setActionError(null);
    try {
      await fn();
      if (action === "stop") {
        // After stop, wait a moment then refresh without auto-start
        setTimeout(() => onRefresh(false), 1000);
      } else {
        onRefresh(false);
      }
    } catch (e) {
      setActionError(typeof e === "string" ? e : `${action} 失败`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {open && <div className="manager-overlay" onClick={onClose} />}
      <div className={`manager-panel ${open ? "open" : ""}`}>
        <div className="panel-header">
          <h3>管理</h3>
          <button className="panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="panel-body">
          {/* 状态指示器 */}
          <div className="status-section">
            <div className="status-label">服务状态</div>
            <div className={`status-badge ${isRunning ? "running" : "stopped"}`}>
              <span className="status-dot" />
              {isRunning ? "运行中" : status.tag === "loading"
                ? "检查中..."
                : status.tag === "starting"
                  ? "启动中..."
                  : "未运行"}
            </div>
            {status.tag === "running" && (
              <div className="port-info">端口: {status.port}</div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="actions-section">
            <button
              className={`action-btn start ${actionLoading === "start" ? "loading" : ""}`}
              onClick={() =>
                handleAction("start", () => invoke<number>("start_daemon"))
              }
              disabled={isRunning || actionLoading !== null}
            >
              {actionLoading === "start" ? "启动中..." : "▶ 启动"}
            </button>

            <button
              className={`action-btn stop ${actionLoading === "stop" ? "loading" : ""}`}
              onClick={() =>
                handleAction("stop", () => invoke<string>("stop_daemon"))
              }
              disabled={!isRunning || actionLoading !== null}
            >
              {actionLoading === "stop" ? "停止中..." : "⏹ 停止"}
            </button>

            <button
              className={`action-btn restart ${actionLoading === "restart" ? "loading" : ""}`}
              onClick={() =>
                handleAction("restart", () => invoke<number>("restart_daemon"))
              }
              disabled={actionLoading !== null}
            >
              {actionLoading === "restart" ? "重启中..." : "🔄 重启"}
            </button>

            <button
              className="action-btn refresh"
              onClick={() => onRefresh()}
              disabled={actionLoading !== null}
            >
              🔄 刷新状态
            </button>
          </div>

          {/* 错误信息 */}
          {actionError && (
            <div className="action-error">
              {actionError}
            </div>
          )}

          {/* 快捷打开 */}
          {isRunning && (
            <div className="quick-links">
              <div className="links-label">快捷链接</div>
              <a
                className="link-btn"
                href={`http://localhost:${status.port}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  invoke("open_url", {
                    url: `http://localhost:${status.port}`,
                  });
                }}
              >
                🌐 在浏览器中打开
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default NtdManager;
