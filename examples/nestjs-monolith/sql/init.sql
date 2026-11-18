CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO orders (id, customer_name, total_cents, status)
VALUES (1, 'Demo Customer', 2599, 'paid')
ON CONFLICT (id) DO NOTHING;
