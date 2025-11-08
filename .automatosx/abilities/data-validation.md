# Data Validation

Implement comprehensive data quality checks to ensure accuracy, completeness, and consistency. Catch data issues early before they impact downstream systems.

## Do's ✅

```python
# ✅ Good: Schema validation with Pydantic
from pydantic import BaseModel, validator

class UserRecord(BaseModel):
    id: int
    email: str
    age: int

    @validator('email')
    def email_must_be_valid(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email')
        return v

# ✅ Good: Data quality checks
def validate_data(df):
    checks = [
        ('No nulls', df[['id', 'email']].notnull().all().all()),
        ('Unique IDs', df['id'].is_unique),
        ('Valid ages', df['age'].between(0, 150).all()),
    ]
    failed = [check for check, passed in checks if not passed]
    if failed:
        raise ValueError(f"Validation failed: {failed}")
```

## Don'ts ❌

```python
# ❌ Bad: No validation
df = pd.read_csv('data.csv')
df.to_sql('users', engine)  # Hope for the best!

# ❌ Bad: Silent failures
df = df.dropna()  # What was dropped? Why?
```

## Best Practices
- Define data quality SLAs
- Implement continuous monitoring
- Document validation rules
- Use validation frameworks (Great Expectations, Pandera)
- Create data quality dashboards
