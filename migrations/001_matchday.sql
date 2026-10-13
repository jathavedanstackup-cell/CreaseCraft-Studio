CREATE TABLE IF NOT EXISTS sticker_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL UNIQUE,
  studio_key text NOT NULL,
  design_name text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sticker_designs_studio_key ON sticker_designs(studio_key);
CREATE INDEX IF NOT EXISTS idx_sticker_designs_updated_at ON sticker_designs(updated_at DESC);