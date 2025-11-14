-- Migration 010: Standardize Timestamps to UNIX Seconds
--
-- Problem: Timestamp inconsistency across tables
-- - message_embeddings_metadata: Uses UNIX seconds (correct)
-- - conversations: Used milliseconds (incorrect, fixed in BUG #17)
-- - messages: Used milliseconds (incorrect, fixed in BUG #17)
--
-- This migration converts existing millisecond timestamps to UNIX seconds
-- for data consistency after code fixes in ConversationDAO and MessageDAO.
--
-- Safety: WHERE clause ensures we only convert millisecond timestamps
-- (> 1000000000000 = year 2001 in milliseconds, year 33658 in seconds)

-- Convert conversations table timestamps
UPDATE conversations SET
  created_at = created_at / 1000,
  updated_at = updated_at / 1000,
  archived_at = CASE
    WHEN archived_at IS NOT NULL AND archived_at > 1000000000000
    THEN archived_at / 1000
    ELSE archived_at
  END,
  deleted_at = CASE
    WHEN deleted_at IS NOT NULL AND deleted_at > 1000000000000
    THEN deleted_at / 1000
    ELSE deleted_at
  END
WHERE created_at > 1000000000000;

-- Convert messages table timestamps
UPDATE messages SET
  created_at = created_at / 1000,
  updated_at = updated_at / 1000
WHERE created_at > 1000000000000;

-- Verification: All timestamps should now be ~10 digits (UNIX seconds)
-- SELECT
--   'conversations' as table_name,
--   LENGTH(CAST(created_at AS TEXT)) as timestamp_length,
--   COUNT(*) as count
-- FROM conversations
-- GROUP BY LENGTH(CAST(created_at AS TEXT))
-- UNION ALL
-- SELECT
--   'messages' as table_name,
--   LENGTH(CAST(created_at AS TEXT)) as timestamp_length,
--   COUNT(*) as count
-- FROM messages
-- GROUP BY LENGTH(CAST(created_at AS TEXT));
