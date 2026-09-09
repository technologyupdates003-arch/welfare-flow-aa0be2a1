#!/usr/bin/env python3
"""Generates MariaDB schema.sql from schema.spec (Postgres column dump).

Usage: python3 generate_schema.py schema.spec > schema.sql
"""
import re
import sys

TYPE_MAP = {
    "uuid": "CHAR(36)",
    "text": "TEXT",
    "varchar": "VARCHAR(255)",
    "numeric": "DECIMAL(14,2)",
    "int4": "INT",
    "bool": "TINYINT(1)",
    "timestamptz": "DATETIME(3)",
    "date": "DATE",
    "jsonb": "LONGTEXT",
    "_text": "LONGTEXT",
    "enum40": "VARCHAR(40)",
}

# Columns that must be short enough to index / be unique
FORCE_VARCHAR = {
    ("members", "phone"): "VARCHAR(32)",
    ("members", "member_id"): "VARCHAR(64)",
    ("penalty_payments", "reference_number"): "VARCHAR(120)",
    ("bank_transactions", "transaction_reference"): "VARCHAR(120)",
    ("bank_transactions", "phone"): "VARCHAR(32)",
    ("push_tokens", "token"): "VARCHAR(255)",
    ("registration_access_links", "access_token"): "VARCHAR(128)",
    ("member_registrations", "phone_number"): "VARCHAR(32)",
    ("sms_logs", "recipient_phone"): "VARCHAR(32)",
    ("b2c_transactions", "mpesa_transaction_id"): "VARCHAR(64)",
    ("payments", "transaction_ref"): "VARCHAR(120)",
    ("registration_fees", "mpesa_checkout_request_id"): "VARCHAR(120)",
    ("wallet_transactions", "mpesa_receipt"): "VARCHAR(64)",
}

FK_RULES = {
    "member_id": ("members", "CASCADE"),
    "conversation_id": ("conversations", "CASCADE"),
    "message_id": ("messages", "CASCADE"),
    "memo_id": ("memos", "CASCADE"),
    "news_id": ("news", "CASCADE"),
    "campaign_id": ("donation_campaigns", "CASCADE"),
    "minutes_id": ("meeting_minutes", "CASCADE"),
    "meeting_id": ("meeting_minutes", "CASCADE"),
    "contribution_id": ("contributions", "SET NULL"),
    "penalty_id": ("penalties", "SET NULL"),
    "payment_id": ("payments", "SET NULL"),
    "registration_id": ("member_registrations", "CASCADE"),
    "reply_to_id": ("messages", "SET NULL"),
    "beneficiary_id": ("beneficiaries", "SET NULL"),
    "related_member_id": ("members", "SET NULL"),
    "recipient_member_id": ("members", "SET NULL"),
}

# tables where a rule must NOT apply (self reference / different meaning)
FK_SKIP = {("members", "member_id"), ("payments", "payment_id"),
           ("messages", "message_id"), ("memos", "memo_id"),
           ("news", "news_id"), ("contributions", "contribution_id"),
           ("penalties", "penalty_id"), ("beneficiaries", "beneficiary_id"),
           ("meeting_minutes", "minutes_id")}

UNIQUES = {
    "members": [("uq_members_phone", ["phone"])],
    "user_roles": [("uq_user_roles", ["user_id", "role"])],
    "contributions": [("uq_contrib_member_period", ["member_id", "month", "year"])],
    "penalty_payments": [("uq_penalty_payment_ref", ["reference_number"])],
    "bank_transactions": [("uq_bank_tx_ref", ["transaction_reference"])],
    "conversation_participants": [("uq_conv_participant", ["conversation_id", "user_id"])],
    "message_reactions": [("uq_reaction", ["message_id", "user_id", "emoji"])],
    "meeting_attendance": [("uq_attendance", ["meeting_id", "user_id"])],
    "news_read": [("uq_news_read", ["news_id", "user_id"])],
    "memo_recipients": [("uq_memo_recipient", ["memo_id", "member_id"])],
    "user_presence": [("uq_presence_user", ["user_id"])],
    "dashboard_security": [("uq_dashsec_user", ["user_id"])],
    "push_tokens": [("uq_push_token", ["token"])],
    "executive_badges": [("uq_badge_role", ["role_name"])],
    "office_bearer_signatures": [("uq_bearer_role", ["role"])],
    "signatory_signatures": [("uq_signatory_user_role", ["user_id", "signatory_role"])],
    "registration_access_links": [("uq_access_token", ["access_token"])],
}


def parse(path):
    tables = []
    for raw in open(path):
        raw = raw.strip()
        if not raw:
            continue
        name, cols = raw.split("|", 1)
        parsed = []
        for chunk in cols.split(", "):
            m = re.search(r"\sD=('(?:[^']|'')*'|\S+)", chunk)
            default = None
            if m:
                default = m.group(1)
                chunk = chunk[: m.start()] + chunk[m.end():]
            parts = chunk.split(" ")
            col, ctype = parts[0], parts[1]
            nn = "NN" in parts
            parsed.append((col, ctype, nn, default))
        tables.append((name, parsed))
    return tables


def sql_default(col, ctype, default):
    if default is None:
        return ""
    if default == "now()":
        return " DEFAULT CURRENT_TIMESTAMP(3)"
    if default == "true":
        return " DEFAULT 1"
    if default == "false":
        return " DEFAULT 0"
    if ctype in ("text", "_text", "jsonb"):
        # MariaDB requires literal defaults on TEXT to be expressions
        return " DEFAULT (%s)" % default if default.startswith("'") else ""
    return " DEFAULT %s" % default


def main():
    tables = parse(sys.argv[1])
    out = []
    out.append("-- KHCWW Welfare Management System - MariaDB schema")
    out.append("-- Generated from the live production schema. Import via phpMyAdmin.")
    out.append("SET NAMES utf8mb4;")
    out.append("SET FOREIGN_KEY_CHECKS = 0;")
    out.append("")
    out.append("""-- Authentication (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  email_confirmed_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  last_sign_in_at DATETIME(3) DEFAULT NULL,
  raw_user_meta_data LONGTEXT DEFAULT NULL,
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_email (email),
  KEY idx_auth_users_last_sign_in (last_sign_in_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(128) NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token (token),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES auth_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS storage_objects (
  id CHAR(36) NOT NULL,
  bucket VARCHAR(64) NOT NULL,
  object_path VARCHAR(400) NOT NULL,
  mime_type VARCHAR(120) DEFAULT NULL,
  size_bytes BIGINT DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  owner_id CHAR(36) DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_storage_object (bucket, object_path),
  KEY idx_storage_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""")

    fks = []
    for name, cols in tables:
        lines = []
        keys = []
        for col, ctype, nn, default in cols:
            rule = FK_RULES.get(col)
            if rule and rule[1] == "SET NULL" and (name, col) not in FK_SKIP:
                nn = False  # SET NULL FK requires a nullable column
            sqltype = FORCE_VARCHAR.get((name, col), TYPE_MAP[ctype])
            line = "  `%s` %s%s%s" % (col, sqltype, " NOT NULL" if nn else " DEFAULT NULL" if default is None else "", sql_default(col, ctype, default))
            lines.append(line)
            if col != "id" and (col.endswith("_id") or col in ("created_at", "occurred_at", "status", "last_seen", "phone")):
                if sqltype != "TEXT" and sqltype != "LONGTEXT":
                    keys.append("  KEY `idx_%s_%s` (`%s`)" % (name[:18], col, col))
        lines.append("  PRIMARY KEY (`id`)")
        for uq_name, uq_cols in UNIQUES.get(name, []):
            lines.append("  UNIQUE KEY `%s` (%s)" % (uq_name, ", ".join("`%s`" % c for c in uq_cols)))
        lines.extend(keys)
        out.append("CREATE TABLE IF NOT EXISTS `%s` (\n%s\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n" % (name, ",\n".join(lines)))

        for col, ctype, nn, default in cols:
            if ctype != "uuid":
                continue
            rule = FK_RULES.get(col)
            if not rule or (name, col) in FK_SKIP:
                continue
            target, ondelete = rule
            if target == name:
                continue
            fks.append("ALTER TABLE `%s` ADD CONSTRAINT `fk_%s_%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`id`) ON DELETE %s;"
                       % (name, name[:20], col, col, target, "CASCADE" if (ondelete == "CASCADE" and nn) else "SET NULL" if not nn else ondelete))

    out.append("-- Foreign keys")
    out.extend(fks)
    out.append("")
    out.append("SET FOREIGN_KEY_CHECKS = 1;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
