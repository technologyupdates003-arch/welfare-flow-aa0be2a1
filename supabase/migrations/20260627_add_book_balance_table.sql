-- Add Book Balance Table for Treasurer
-- Tracks debits and book balance from bank reconciliation

CREATE TABLE IF NOT EXISTS book_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL,
  check_number VARCHAR(50) NOT NULL UNIQUE,
  debit DECIMAL(10, 2) NOT NULL,
  book_balance DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_book_balance_date ON book_balance(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_book_balance_check_number ON book_balance(check_number);
CREATE INDEX IF NOT EXISTS idx_book_balance_created_at ON book_balance(created_at DESC);

-- Enable RLS
ALTER TABLE book_balance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for book_balance
CREATE POLICY "Treasurer can view all book balance records" ON book_balance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can create book balance records" ON book_balance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

CREATE POLICY "Treasurer can update reason and metadata" ON book_balance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

COMMENT ON TABLE book_balance IS 'Tracks book balance and debits from bank reconciliation imports';
COMMENT ON COLUMN book_balance.check_number IS 'Unique check number identifier';
COMMENT ON COLUMN book_balance.debit IS 'Debit amount - CANNOT BE EDITED after import';
COMMENT ON COLUMN book_balance.book_balance IS 'Book balance amount - CANNOT BE EDITED after import';
COMMENT ON COLUMN book_balance.reason IS 'Optional reason for the transaction - CAN BE EDITED';
