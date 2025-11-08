# Infrastructure as Code

Define and manage infrastructure through code using Terraform, Pulumi, or AWS CDK. Enable version control, reproducibility, and automation.

## Do's ✅

```hcl
# ✅ Good: Modular Terraform
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project}-vpc"
    Environment = var.environment
  }
}

# ✅ Good: Remote state with locking
terraform {
  backend "s3" {
    bucket         = "terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# ✅ Good: Use modules
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.0"
  name    = "${var.project}-vpc"
  cidr    = var.vpc_cidr
}
```

## Don'ts ❌

```hcl
# ❌ Bad: Hardcoded values
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"  # Region-specific!
  subnet_id     = "subnet-12345"  # Hardcoded
}

# ❌ Bad: Manual changes
# Never modify infrastructure manually in console
```

## Best Practices
- Use workspaces for environments (dev/staging/prod)
- Enable state locking
- Always run `terraform plan` before apply
- Version pin modules and providers
- Implement automated testing (Terratest)
