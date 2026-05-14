-- Add payment_message column to penalty_payments table
-- This allows members to paste their M-Pesa/bank payment confirmation message

ALTER TABLE penalty_payments
ADD COLUMN IF NOT EXISTS payment_message TEXT;

COMMENT ON COLUMN penalty_payments.payment_message IS 'Full payment confirmation message from M-Pesa or bank SMS';
