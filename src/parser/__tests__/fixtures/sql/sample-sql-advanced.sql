/**
 * sample-sql-advanced.sql
 * Advanced SQL patterns: CTEs, window functions, materialized views, partitions
 */

-- ===== Advanced Tables =====

CREATE TABLE employees (
  employee_id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  department_id INT,
  salary DECIMAL(10, 2),
  hire_date DATE,
  manager_id INT
);

CREATE TABLE departments (
  department_id INT PRIMARY KEY,
  department_name VARCHAR(100),
  location VARCHAR(100)
);

CREATE TABLE sales (
  sale_id INT PRIMARY KEY,
  product_id INT,
  customer_id INT,
  sale_date DATE,
  amount DECIMAL(10, 2),
  quantity INT
);

CREATE TABLE products (
  product_id INT PRIMARY KEY,
  product_name VARCHAR(100),
  category VARCHAR(50),
  price DECIMAL(10, 2),
  stock_quantity INT
);

-- ===== Materialized Views =====

CREATE MATERIALIZED VIEW employee_summary AS
SELECT
  e.employee_id,
  e.first_name,
  e.last_name,
  d.department_name,
  e.salary,
  RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) as salary_rank
FROM employees e
JOIN departments d ON e.department_id = d.department_id;

CREATE MATERIALIZED VIEW sales_summary AS
SELECT
  DATE_TRUNC('month', sale_date) as month,
  product_id,
  SUM(amount) as total_sales,
  COUNT(*) as transaction_count,
  AVG(amount) as avg_sale_amount
FROM sales
GROUP BY DATE_TRUNC('month', sale_date), product_id;

-- ===== Complex Views with CTEs =====

CREATE VIEW department_hierarchy AS
WITH RECURSIVE emp_hierarchy AS (
  SELECT employee_id, first_name, last_name, manager_id, 1 as level
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.employee_id, e.first_name, e.last_name, e.manager_id, eh.level + 1
  FROM employees e
  JOIN emp_hierarchy eh ON e.manager_id = eh.employee_id
)
SELECT * FROM emp_hierarchy;

CREATE VIEW top_performing_products AS
WITH monthly_sales AS (
  SELECT
    product_id,
    DATE_TRUNC('month', sale_date) as month,
    SUM(amount) as monthly_total
  FROM sales
  GROUP BY product_id, DATE_TRUNC('month', sale_date)
),
ranked_products AS (
  SELECT
    product_id,
    month,
    monthly_total,
    RANK() OVER (PARTITION BY month ORDER BY monthly_total DESC) as rank
  FROM monthly_sales
)
SELECT * FROM ranked_products WHERE rank <= 10;

-- ===== Complex Indexes =====

CREATE INDEX idx_employees_dept_salary ON employees(department_id, salary DESC);

CREATE INDEX idx_sales_date_customer ON sales(sale_date, customer_id);

CREATE INDEX idx_products_category_price ON products(category, price);

CREATE INDEX idx_employees_name ON employees USING GIN (to_tsvector('english', first_name || ' ' || last_name));

-- ===== Advanced Functions =====

CREATE FUNCTION get_employee_hierarchy(root_emp_id INT)
RETURNS TABLE(
  employee_id INT,
  full_name VARCHAR,
  level INT,
  path VARCHAR
)
AS $$
WITH RECURSIVE hierarchy AS (
  SELECT
    employee_id,
    first_name || ' ' || last_name as full_name,
    1 as level,
    CAST(first_name || ' ' || last_name AS VARCHAR) as path
  FROM employees
  WHERE employee_id = root_emp_id
  UNION ALL
  SELECT
    e.employee_id,
    e.first_name || ' ' || e.last_name,
    h.level + 1,
    h.path || ' > ' || e.first_name || ' ' || e.last_name
  FROM employees e
  JOIN hierarchy h ON e.manager_id = h.employee_id
)
SELECT * FROM hierarchy;
$$ LANGUAGE sql;

CREATE FUNCTION calculate_bonus(
  emp_id INT,
  bonus_percentage DECIMAL
)
RETURNS DECIMAL
AS $$
DECLARE
  base_salary DECIMAL;
  bonus_amount DECIMAL;
BEGIN
  SELECT salary INTO base_salary
  FROM employees
  WHERE employee_id = emp_id;

  bonus_amount := base_salary * (bonus_percentage / 100);
  RETURN bonus_amount;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_top_salespeople(limit_count INT DEFAULT 10)
RETURNS TABLE(
  employee_id INT,
  full_name VARCHAR,
  total_sales DECIMAL
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.employee_id,
    e.first_name || ' ' || e.last_name as full_name,
    COALESCE(SUM(s.amount), 0) as total_sales
  FROM employees e
  LEFT JOIN sales s ON e.employee_id = s.customer_id
  GROUP BY e.employee_id, e.first_name, e.last_name
  ORDER BY total_sales DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ===== Complex Procedures =====

CREATE PROCEDURE process_monthly_salaries(process_month DATE)
AS $$
DECLARE
  emp_record RECORD;
  total_processed INT := 0;
BEGIN
  FOR emp_record IN
    SELECT employee_id, salary
    FROM employees
    WHERE hire_date <= process_month
  LOOP
    INSERT INTO salary_payments (employee_id, amount, payment_date)
    VALUES (emp_record.employee_id, emp_record.salary, process_month);

    total_processed := total_processed + 1;
  END LOOP;

  RAISE NOTICE 'Processed % salaries', total_processed;
END;
$$ LANGUAGE plpgsql;

CREATE PROCEDURE update_product_prices(
  category_name VARCHAR,
  price_increase_percent DECIMAL
)
AS $$
BEGIN
  UPDATE products
  SET price = price * (1 + price_increase_percent / 100)
  WHERE category = category_name;

  RAISE NOTICE 'Updated prices for category: %', category_name;
END;
$$ LANGUAGE plpgsql;

CREATE PROCEDURE archive_old_sales(cutoff_date DATE)
AS $$
BEGIN
  INSERT INTO sales_archive
  SELECT * FROM sales WHERE sale_date < cutoff_date;

  DELETE FROM sales WHERE sale_date < cutoff_date;

  RAISE NOTICE 'Archived sales before %', cutoff_date;
END;
$$ LANGUAGE plpgsql;

-- ===== Advanced Triggers =====

CREATE TRIGGER check_salary_increase
BEFORE UPDATE ON employees
FOR EACH ROW
WHEN (NEW.salary > OLD.salary * 1.5)
EXECUTE FUNCTION validate_salary_increase();

CREATE TRIGGER update_stock_on_sale
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION decrease_product_stock();

CREATE TRIGGER audit_employee_changes
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION log_employee_audit();

CREATE TRIGGER enforce_department_budget
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION check_department_budget();
