use nanoid::nanoid;

pub fn generate_uuid() -> String {
    nanoid!(16)
}
