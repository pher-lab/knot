#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod models;
mod storage;

use commands::{AppState, StateWrapper};
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState::new()) as StateWrapper)
        .register_uri_scheme_protocol("knot-image", |app_handle, request| {
            let url = request.uri();
            // Extract image ID from URL
            // Windows (WebView2): https://knot-image.localhost/{uuid}
            // macOS/Linux: knot-image://localhost/{uuid}
            let image_id = url
                .strip_prefix("knot-image://localhost/")
                .or_else(|| url.strip_prefix("https://knot-image.localhost/"))
                .or_else(|| url.strip_prefix("http://knot-image.localhost/"))
                .unwrap_or("");

            let uuid = match Uuid::parse_str(image_id) {
                Ok(id) => id,
                Err(_) => {
                    return tauri::http::ResponseBuilder::new()
                        .status(400)
                        .body(b"Invalid image ID".to_vec());
                }
            };

            let state = app_handle.state::<StateWrapper>();
            let app_state = match state.lock() {
                Ok(s) => s,
                Err(_) => {
                    return tauri::http::ResponseBuilder::new()
                        .status(500)
                        .body(b"Internal error".to_vec());
                }
            };

            let dek = match app_state.dek.as_ref() {
                Some(k) => k,
                None => {
                    return tauri::http::ResponseBuilder::new()
                        .status(403)
                        .body(b"Vault is locked".to_vec());
                }
            };

            let db: &storage::Database = match app_state.db.as_ref() {
                Some(d) => d,
                None => {
                    return tauri::http::ResponseBuilder::new()
                        .status(403)
                        .body(b"Vault is locked".to_vec());
                }
            };

            let enc = match db.get_image(&uuid) {
                Ok(Some(img)) => img,
                Ok(None) => {
                    return tauri::http::ResponseBuilder::new()
                        .status(404)
                        .body(b"Image not found".to_vec());
                }
                Err(_) => {
                    return tauri::http::ResponseBuilder::new()
                        .status(500)
                        .body(b"Database error".to_vec());
                }
            };

            let decrypted = match crypto::decrypt(&enc.encrypted_data, &**dek) {
                Ok(data) => data,
                Err(_) => {
                    return tauri::http::ResponseBuilder::new()
                        .status(500)
                        .body(b"Decryption failed".to_vec());
                }
            };

            tauri::http::ResponseBuilder::new()
                .status(200)
                .header("Content-Type", &enc.mime_type)
                .header("Cache-Control", "no-store")
                .body(decrypted)
        })
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
            commands::notes::restore_note,
            commands::notes::permanent_delete_note,
            commands::notes::empty_trash,
            commands::notes::get_trash_count,
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
            commands::export_import::write_file,
            commands::images::save_image,
            commands::images::save_image_from_path,
            commands::images::get_image_data,
            commands::images::delete_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
