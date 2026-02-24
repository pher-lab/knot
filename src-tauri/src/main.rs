#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod models;
mod storage;

use commands::{AppState, StateWrapper};
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState::new()) as StateWrapper)
        .invoke_handler(tauri::generate_handler![
            commands::auth::check_lockout_status,
            commands::auth::check_vault_exists,
            commands::auth::setup_vault,
            commands::auth::unlock_vault,
            commands::auth::lock_vault,
            commands::auth::recover_vault,
            commands::auth::change_password,
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::list_notes,
            commands::notes::search_notes,
            commands::notes::toggle_pin_note,
            commands::notes::set_note_tags,
            commands::notes::list_all_tags,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::export_import::export_note,
            commands::export_import::export_all_notes,
            commands::export_import::import_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
