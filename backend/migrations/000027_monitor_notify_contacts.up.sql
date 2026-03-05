ALTER TABLE synthetic_monitors ADD COLUMN IF NOT EXISTS notify_contact_ids UUID[] NOT NULL DEFAULT '{}';
