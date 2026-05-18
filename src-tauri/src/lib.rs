use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent, Emitter,
};

mod backend;

pub struct AppState {
    pub backend_url: Mutex<String>,
}

#[tauri::command]
fn get_backend_url(state: tauri::State<Arc<AppState>>) -> String {
    state.backend_url.lock().expect("backend_url mutex poisoned").clone()
}

#[tauri::command]
async fn check_status() -> Result<backend::NtdCheckResult, String> {
    Ok(backend::get_ntd_check_result().await)
}

#[tauri::command]
async fn start_daemon() -> Result<u16, String> {
    let port = backend::read_port_from_config();
    backend::start_ntd_daemon(port).await
}

#[tauri::command]
async fn stop_daemon() -> Result<String, String> {
    backend::stop_ntd_daemon().await.map(|_| "Stopped".to_string())
}

#[tauri::command]
async fn restart_daemon() -> Result<u16, String> {
    let port = backend::read_port_from_config();
    backend::restart_ntd_daemon(port).await
}

#[tauri::command]
fn open_url(url: String) {
    if let Err(e) = open::that(&url) {
        log::error!("Failed to open URL {}: {}", url, e);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    eprintln!("[DEBUG] ntd-desktop starting up...");

    // Check capabilities directory
    let cap_dir = std::path::Path::new("capabilities");
    eprintln!("[DEBUG] capabilities dir exists: {:?}", cap_dir.exists());
    if cap_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(cap_dir) {
            for entry in entries.flatten() {
                eprintln!("[DEBUG]   capability file: {:?}", entry.path());
            }
        }
    }

    let app_state = Arc::new(AppState {
        backend_url: Mutex::new(String::new()),
    });

    let state_for_setup = app_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .manage(app_state)
        .setup(move |_app| {
            // Auto-start ntd daemon in background if installed but not running
            tauri::async_runtime::spawn(async move {
                match backend::check_ntd_status().await {
                    backend::NtdStatus::NotInstalled => {
                        log::info!("ntd not installed");
                    }
                    backend::NtdStatus::Installed { running: true, port } => {
                        let url = format!("http://localhost:{}", port);
                        *state_for_setup.backend_url.lock().expect("backend_url mutex poisoned") = url;
                        log::info!("ntd already running on {}", port);
                    }
                    backend::NtdStatus::Installed { running: false, port } => {
                        log::info!("ntd installed but not running, auto-starting on port {}", port);
                        match backend::start_ntd_daemon(port).await {
                            Ok(port) => {
                                let url = format!("http://localhost:{}", port);
                                *state_for_setup.backend_url.lock().expect("backend_url mutex poisoned") = url;
                                log::info!("ntd daemon auto-started on port {}", port);
                            }
                            Err(e) => {
                                log::error!("Failed to auto-start ntd daemon: {}", e);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .setup(|app| {
            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;

            // ntd management submenu
            let mgmt_start = MenuItem::with_id(app, "mgmt-start", "▶ 启动 daemon", true, None::<&str>)?;
            let mgmt_stop = MenuItem::with_id(app, "mgmt-stop", "⏹ 停止 daemon", true, None::<&str>)?;
            let mgmt_restart = MenuItem::with_id(app, "mgmt-restart", "🔄 重启 daemon", true, None::<&str>)?;
            let mgmt_sep = tauri::menu::PredefinedMenuItem::separator(app)?;
            let mgmt_refresh = MenuItem::with_id(app, "mgmt-refresh", "🔄 刷新状态", true, None::<&str>)?;

            let mgmt_menu = Submenu::with_items(
                app,
                "ntd 管理",
                true,
                &[&mgmt_start, &mgmt_stop, &mgmt_restart, &mgmt_sep, &mgmt_refresh],
            )?;

            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &mgmt_menu, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("ntd - Nothing Todo")
                .on_menu_event(move |app, event| {
                    let window = app.get_webview_window("main");
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(w) = &window {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "mgmt-start" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                match backend::start_ntd_daemon(backend::read_port_from_config()).await {
                                    Ok(port) => {
                                        log::info!("Daemon started via menu on port {}", port);
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "running", "port": port}));
                                    }
                                    Err(e) => {
                                        log::error!("Failed to start daemon via menu: {}", e);
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "error", "message": e}));
                                    }
                                }
                            });
                        }
                        "mgmt-stop" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                match backend::stop_ntd_daemon().await {
                                    Ok(_) => {
                                        log::info!("Daemon stopped via menu");
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "stopped"}));
                                    }
                                    Err(e) => {
                                        log::error!("Failed to stop daemon via menu: {}", e);
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "error", "message": e}));
                                    }
                                }
                            });
                        }
                        "mgmt-restart" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                match backend::restart_ntd_daemon(backend::read_port_from_config()).await {
                                    Ok(port) => {
                                        log::info!("Daemon restarted via menu on port {}", port);
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "running", "port": port}));
                                    }
                                    Err(e) => {
                                        log::error!("Failed to restart daemon via menu: {}", e);
                                        let _ = app_handle.emit("daemon-status-changed", serde_json::json!({"status": "error", "message": e}));
                                    }
                                }
                            });
                        }
                        "mgmt-refresh" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let result = backend::get_ntd_check_result().await;
                                log::info!("Status check via menu: {:?}", result);
                                let _ = app_handle.emit("daemon-status-changed", serde_json::json!({
                                    "status": if result.running { "running" } else if result.installed { "stopped" } else { "not-installed" },
                                    "port": result.port,
                                    "installed": result.installed,
                                }));
                            });
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Close → hide to tray
            if let Some(main_window) = app.get_webview_window("main") {
                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_url,
            check_status,
            start_daemon,
            stop_daemon,
            restart_daemon,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
