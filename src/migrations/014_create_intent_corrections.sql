-- Migration 014: Create intent_corrections table for Intent Learning System
-- This table stores user corrections to improve intent classification over time

CREATE TABLE IF NOT EXISTS intent_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  predicted_intent TEXT NOT NULL,
  corrected_intent TEXT NOT NULL,
  confidence REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index on query for fast exact match lookups
CREATE INDEX IF NOT EXISTS idx_intent_corrections_query
ON intent_corrections(query);

-- Index on user_id for per-user learning
CREATE INDEX IF NOT EXISTS idx_intent_corrections_user
ON intent_corrections(user_id);

-- Index on timestamp for temporal analysis
CREATE INDEX IF NOT EXISTS idx_intent_corrections_timestamp
ON intent_corrections(timestamp);

-- Index on predicted_intent for misclassification analysis
CREATE INDEX IF NOT EXISTS idx_intent_corrections_predicted
ON intent_corrections(predicted_intent);

-- Index on corrected_intent for target intent analysis
CREATE INDEX IF NOT EXISTS idx_intent_corrections_corrected
ON intent_corrections(corrected_intent);
