//! Desktop: closing the window keeps the app in the system tray (user request, 2026-10-16).
//! The tray icon shows the window again on a left click; its menu has "打开 Dutch Tutor" and "退出", and only
//! "退出" ends the program. Opening the app again while it runs brings back the same window (single instance).
//! The cold-start probe still ends the program with `app.exit` (startup.rs), which is not a window close.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

pub const MAIN_WINDOW: &str = "main";
const MENU_SHOW: &str = "show";
const MENU_QUIT: &str = "quit";

#[derive(Debug, PartialEq, Eq)]
enum MenuAction {
    Show,
    Quit,
}

fn menu_action(id: &str) -> Option<MenuAction> {
    match id {
        MENU_SHOW => Some(MenuAction::Show),
        MENU_QUIT => Some(MenuAction::Quit),
        _ => None,
    }
}

/// A finished left click on the tray icon (the right button opens the menu).
fn shows_window(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
    )
}

/// Brings the main window back: out of the tray or the taskbar, in front, with focus.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Only the main window goes to the tray; any other window closes normally.
fn hides_on_close(label: &str) -> bool {
    label == MAIN_WINDOW
}

/// The window's close button hides the main window instead of ending the program.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if hides_on_close(window.label()) {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, MENU_SHOW, "打开 Dutch Tutor", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Dutch Tutor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match menu_action(event.id().as_ref()) {
            Some(MenuAction::Show) => show_main(app),
            Some(MenuAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if shows_window(&event) {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{hides_on_close, menu_action, shows_window, MenuAction};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent, TrayIconId};
    use tauri::{PhysicalPosition, Rect};

    fn click(button: MouseButton, button_state: MouseButtonState) -> TrayIconEvent {
        TrayIconEvent::Click {
            id: TrayIconId::new("main"),
            position: PhysicalPosition::new(0.0, 0.0),
            rect: Rect::default(),
            button,
            button_state,
        }
    }

    #[test]
    fn closing_the_main_window_hides_it() {
        assert!(hides_on_close("main"));
        assert!(!hides_on_close("other"));
    }

    #[test]
    fn menu_items_open_the_window_or_quit() {
        assert_eq!(menu_action("show"), Some(MenuAction::Show));
        assert_eq!(menu_action("quit"), Some(MenuAction::Quit));
        assert_eq!(menu_action("other"), None);
    }

    #[test]
    fn only_a_left_click_shows_the_window() {
        assert!(shows_window(&click(
            MouseButton::Left,
            MouseButtonState::Up
        )));
        assert!(!shows_window(&click(
            MouseButton::Left,
            MouseButtonState::Down
        )));
        assert!(!shows_window(&click(
            MouseButton::Right,
            MouseButtonState::Up
        )));
    }
}
