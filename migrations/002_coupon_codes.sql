-- ============================================================
-- Vysti Coupon Codes — Database Migration
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates tables for coupon code redemption (student access grants).
-- ============================================================

-- 1. Coupon codes table — stores redeemable access codes
CREATE TABLE IF NOT EXISTS coupon_codes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text UNIQUE NOT NULL,               -- Uppercased code, e.g. "REVISE-FREE-2026"
    description     text,                               -- Internal note, e.g. "Spring 2026 teacher promo"
    max_redemptions int,                                -- NULL = unlimited
    grants_tier     text NOT NULL DEFAULT 'paid',       -- subscription_tier to grant
    grants_mark     boolean,                            -- NULL = don't change, true/false = set on profile
    grants_revise   boolean,                            -- NULL = don't change, true/false = set on profile
    is_active       boolean NOT NULL DEFAULT true,      -- Kill switch
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz                         -- NULL = never expires
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes (code);

-- 2. Coupon redemptions table — audit trail of who redeemed what
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id   uuid NOT NULL REFERENCES coupon_codes(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL,
    redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent same user from redeeming same coupon twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_unique
    ON coupon_redemptions (coupon_id, user_id);

-- Index for counting redemptions per coupon
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon
    ON coupon_redemptions (coupon_id);

-- 3. Row-level security — service role only
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON coupon_codes
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON coupon_redemptions
    FOR ALL USING (auth.role() = 'service_role');
