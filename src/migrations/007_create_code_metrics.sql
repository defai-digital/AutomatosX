-- Migration 007: Create code_metrics table
-- Day 67: Code Quality Analyzer Implementation
-- Stores code quality metrics and analysis results

CREATE TABLE IF NOT EXISTS code_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Cyclomatic complexity metrics
  cyclomatic_complexity INTEGER NOT NULL,
  decision_points INTEGER NOT NULL,
  paths INTEGER NOT NULL,

  -- Cognitive complexity metrics
  cognitive_complexity INTEGER NOT NULL,
  nesting_penalty INTEGER NOT NULL,
  structural_complexity INTEGER NOT NULL,

  -- Halstead metrics
  halstead_vocabulary INTEGER NOT NULL,
  halstead_length INTEGER NOT NULL,
  halstead_volume REAL NOT NULL,
  halstead_difficulty REAL NOT NULL,
  halstead_effort REAL NOT NULL,
  halstead_time REAL NOT NULL,
  halstead_bugs REAL NOT NULL,

  -- Maintainability metrics
  maintainability_index REAL NOT NULL,
  quality_score REAL NOT NULL,
  grade TEXT NOT NULL,

  -- Technical debt
  tech_debt_minutes REAL NOT NULL,
  tech_debt_severity TEXT NOT NULL,

  -- Code metrics
  lines_of_code INTEGER NOT NULL,
  average_complexity REAL NOT NULL,
  max_complexity INTEGER NOT NULL,
  function_count INTEGER NOT NULL,

  -- Code smells
  code_smells_count INTEGER NOT NULL DEFAULT 0,
  high_severity_smells INTEGER NOT NULL DEFAULT 0,

  -- Risk level
  risk_level TEXT NOT NULL,

  -- Recommendations (stored as JSON)
  recommendations TEXT,

  FOREIGN KEY (file_path) REFERENCES files(file_path) ON DELETE CASCADE
);

-- Create index for fast lookups by file
CREATE INDEX IF NOT EXISTS idx_code_metrics_file_path ON code_metrics(file_path);

-- Create index for quality queries
CREATE INDEX IF NOT EXISTS idx_code_metrics_quality ON code_metrics(quality_score DESC, analyzed_at DESC);

-- Create index for technical debt queries
CREATE INDEX IF NOT EXISTS idx_code_metrics_debt ON code_metrics(tech_debt_severity, tech_debt_minutes DESC);

-- Create index for complexity queries
CREATE INDEX IF NOT EXISTS idx_code_metrics_complexity ON code_metrics(cyclomatic_complexity DESC, analyzed_at DESC);

-- Create index for grade queries
CREATE INDEX IF NOT EXISTS idx_code_metrics_grade ON code_metrics(grade, analyzed_at DESC);

-- Create index for risk level queries
CREATE INDEX IF NOT EXISTS idx_code_metrics_risk ON code_metrics(risk_level, analyzed_at DESC);

-- Create view for high-risk files
CREATE VIEW IF NOT EXISTS high_risk_files AS
SELECT
  file_path,
  language,
  quality_score,
  tech_debt_minutes,
  cyclomatic_complexity,
  cognitive_complexity,
  grade,
  risk_level,
  analyzed_at
FROM code_metrics
WHERE risk_level IN ('high', 'critical')
ORDER BY quality_score ASC, tech_debt_minutes DESC;

-- Create view for technical debt summary
CREATE VIEW IF NOT EXISTS tech_debt_summary AS
SELECT
  language,
  COUNT(*) as file_count,
  AVG(quality_score) as avg_quality_score,
  SUM(tech_debt_minutes) as total_debt_minutes,
  SUM(tech_debt_minutes) / 60.0 as total_debt_hours,
  SUM(tech_debt_minutes) / (60.0 * 8.0) as total_debt_days,
  AVG(cyclomatic_complexity) as avg_complexity,
  AVG(maintainability_index) as avg_maintainability
FROM code_metrics
GROUP BY language;

-- Create view for quality trends (requires historical data)
CREATE VIEW IF NOT EXISTS quality_trends AS
SELECT
  file_path,
  language,
  quality_score,
  maintainability_index,
  tech_debt_minutes,
  analyzed_at,
  LAG(quality_score) OVER (PARTITION BY file_path ORDER BY analyzed_at) as prev_quality_score,
  LAG(tech_debt_minutes) OVER (PARTITION BY file_path ORDER BY analyzed_at) as prev_tech_debt
FROM code_metrics
ORDER BY file_path, analyzed_at DESC;
