ALTER TABLE user_profiles
    ALTER COLUMN selections_json TYPE JSONB
    USING selections_json::jsonb;