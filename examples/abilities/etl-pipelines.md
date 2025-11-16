# ETL Pipelines

Build robust Extract, Transform, Load pipelines for data integration. Handle incremental loading, error recovery, and monitoring.

## Do's ✅

```python
# ✅ Good: Incremental loading
last_sync = get_last_sync_timestamp()
new_data = source.extract(where=f"updated_at > '{last_sync}'")
transformed = transform(new_data)
warehouse.upsert(transformed, key_columns=['id'])

# ✅ Good: Idempotent operations
warehouse.upsert(data, key_columns=['id'], update_columns=['name', 'updated_at'])

# ✅ Good: Error handling with retry
try:
    data = extract_from_api()
    load_to_warehouse(transform(data))
except APIError as e:
    log_error(e)
    save_failed_batch(data)  # Retry later
```

## Don'ts ❌

```python
# ❌ Bad: Full table reload every time
data = source.extract_all()  # Millions of rows!
warehouse.truncate()
warehouse.insert(data)

# ❌ Bad: No schema validation
for row in data:
    warehouse.insert(row['id'], row['name'])  # What if fields missing?
```

## Best Practices
- Use orchestration tools (Airflow, Prefect, Dagster)
- Implement data quality checks
- Monitor pipeline SLAs
- Version control transformation logic
- Document data lineage
