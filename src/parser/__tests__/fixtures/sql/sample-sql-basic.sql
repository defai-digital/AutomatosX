/**
 * sample-sql-basic.sql
 * Basic SQL patterns: tables, views, indexes, functions, procedures
 */

-- ===== Tables =====

CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200),
  content TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE comments (
  id INT PRIMARY KEY,
  post_id INT,
  user_id INT,
  comment_text TEXT,
  created_at TIMESTAMP
);

-- ===== Views =====

CREATE VIEW active_users AS
SELECT id, username, email
FROM users
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY);

CREATE VIEW published_posts AS
SELECT p.id, p.title, p.content, u.username
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.published = TRUE;

CREATE VIEW post_stats AS
SELECT
  p.id,
  p.title,
  COUNT(c.id) as comment_count
FROM posts p
LEFT JOIN comments c ON p.post_id = c.id
GROUP BY p.id, p.title;

-- ===== Indexes =====

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE INDEX idx_comments_post_id ON comments(post_id);

CREATE UNIQUE INDEX idx_users_username ON users(username);

-- ===== Functions =====

CREATE FUNCTION get_user_count()
RETURNS INT
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM users);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_user_by_id(user_id INT)
RETURNS TABLE(id INT, username VARCHAR, email VARCHAR)
AS $$
BEGIN
  RETURN QUERY
  SELECT id, username, email
  FROM users
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION calculate_total_posts(p_user_id INT)
RETURNS INT
AS $$
DECLARE
  total INT;
BEGIN
  SELECT COUNT(*) INTO total
  FROM posts
  WHERE user_id = p_user_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ===== Procedures =====
-- NOTE: Using CREATE FUNCTION instead of CREATE PROCEDURE
-- because @derekstride/tree-sitter-sql@0.3.11 doesn't support PROCEDURE syntax

CREATE FUNCTION create_user(
  p_username VARCHAR,
  p_email VARCHAR
)
RETURNS VOID
AS $$
BEGIN
  INSERT INTO users (username, email)
  VALUES (p_username, p_email);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_user_email(
  p_user_id INT,
  p_new_email VARCHAR
)
RETURNS VOID
AS $$
BEGIN
  UPDATE users
  SET email = p_new_email
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION delete_user(p_user_id INT)
RETURNS VOID
AS $$
BEGIN
  DELETE FROM comments WHERE user_id = p_user_id;
  DELETE FROM posts WHERE user_id = p_user_id;
  DELETE FROM users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ===== Triggers =====

CREATE TRIGGER update_post_timestamp
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER validate_email
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION validate_email_format();

CREATE TRIGGER log_user_changes
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();
