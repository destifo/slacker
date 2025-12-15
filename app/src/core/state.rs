use sea_orm::DatabaseConnection;

#[derive(Clone, Debug)]
pub struct AppState {
    pub database: DatabaseConnection,
}
