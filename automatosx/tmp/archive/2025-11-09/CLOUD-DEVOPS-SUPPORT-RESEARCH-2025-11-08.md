# Cloud Tools & DevOps Support Research
**Date**: 2025-11-08
**Status**: ✅ RESEARCH COMPLETE

## Summary

Comprehensive research into tree-sitter parser availability for cloud CLI tools, Infrastructure as Code (IaC), CI/CD, and DevOps configuration languages.

## Key Findings

### ✅ Available on npm (2 found)
| Tool | Package | Version | Use Case |
|------|---------|---------|----------|
| **Terraform/HCL** | @tree-sitter-grammars/tree-sitter-hcl | 1.2.0 | Infrastructure as Code |
| **Groovy/Jenkins** | tree-sitter-groovy | 0.1.2 | CI/CD Pipelines |

### ❌ Not Available on npm
| Tool | Reason | Alternative |
|------|--------|-------------|
| **Ansible** | No tree-sitter parser exists | Use YAML parser (already supported) |
| **Kubernetes YAML** | No specific parser | Use YAML parser (already supported) |
| **Helm** | Templated YAML - complex | Use YAML parser + Go template awareness |
| **Docker Compose** | No npm package | Use YAML parser (already supported) |
| **Dockerfile** | Security placeholder only | Use Bash parser for shell commands |
| **Nginx Config** | GitHub only, not on npm | Not available for npm installation |
| **Protobuf/gRPC** | No npm package | Not available |
| **Bicep (Azure)** | No tree-sitter parser exists | Not available |
| **Pulumi** | Uses general-purpose languages | Already supported (TypeScript, Python, Go) |
| **CloudFormation** | AWS proprietary JSON/YAML | Use JSON/YAML parsers (already supported) |
| **Azure CLI** | Bash/PowerShell scripts | Use Bash parser (already supported) |
| **gcloud CLI** | Bash/PowerShell scripts | Use Bash parser (already supported) |
| **AWS CLI** | Bash/PowerShell scripts | Use Bash parser (already supported) |
| **DigitalOcean CLI** | Bash/PowerShell scripts | Use Bash parser (already supported) |
| **Cloudflare** | YAML/JSON configs | Use YAML/JSON parsers (already supported) |

## Detailed Analysis

### 1. Infrastructure as Code (IaC)

#### ✅ Terraform / HCL
**Parser**: `@tree-sitter-grammars/tree-sitter-hcl@1.2.0`

**Description**: HCL (HashiCorp Configuration Language) parser for Terraform, Vault, Waypoint, and Nomad.

**Package Details**:
- **Version**: 1.2.0
- **Published**: ~4 months ago (July 2025)
- **Size**: 2.0 MB unpacked
- **License**: Apache-2.0
- **Maintainers**: amaanq, chronobserver
- **Dependencies**: node-addon-api, node-gyp-build

**Supported Files**:
- `.tf` (Terraform)
- `.hcl` (HashiCorp Config)
- `.nomad` (Nomad jobs)

**Example Terraform Code**:
```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type

  tags = {
    Name = "WebServer"
    Environment = "Production"
  }
}

output "instance_id" {
  value = aws_instance.web.id
}
```

**Recommendation**: ✅ **Add support for Terraform/HCL**

---

#### ❌ Pulumi
**Status**: No dedicated parser needed

**Reason**: Pulumi uses general-purpose programming languages:
- **TypeScript/JavaScript** - Already supported
- **Python** - Already supported
- **Go** - Already supported
- **C#** - Already supported

**Example** (already supported via TypeScript):
```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const bucket = new aws.s3.Bucket("my-bucket");

export const bucketName = bucket.id;
```

**Recommendation**: ✅ **Already supported** via existing language parsers

---

#### ❌ CloudFormation (AWS)
**Status**: No dedicated parser exists

**Reason**: CloudFormation uses JSON or YAML formats

**Alternative**: Use existing parsers:
- JSON CloudFormation templates → JSON parser (already supported)
- YAML CloudFormation templates → YAML parser (already supported)

**Example** (already supported via YAML):
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-cloudformation-bucket
```

**Recommendation**: ✅ **Already supported** via YAML/JSON parsers

---

#### ❌ Bicep (Azure)
**Status**: No tree-sitter parser exists

**Reason**: Bicep is a domain-specific language for Azure, relatively new (2020)

**Alternative**: None available

**Example** (not parseable):
```bicep
param location string = 'eastus'

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  name: 'mystorageaccount'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
```

**Recommendation**: ❌ **Not available** - wait for community parser

---

### 2. Configuration Management

#### ❌ Ansible
**Status**: No dedicated tree-sitter parser

**Reason**: Ansible uses YAML with Jinja2 templating

**Alternative**: Use YAML parser (already supported) for playbook structure

**Example** (partially supported via YAML):
```yaml
---
- name: Install and configure web server
  hosts: webservers
  become: yes

  vars:
    http_port: 80

  tasks:
    - name: Install Apache
      apt:
        name: apache2
        state: present

    - name: Start Apache service
      service:
        name: apache2
        state: started
```

**Recommendation**: ✅ **Partially supported** via YAML parser (structure only, not Jinja2 templates)

---

### 3. Container Orchestration

#### ❌ Kubernetes YAML
**Status**: No dedicated parser

**Reason**: Kubernetes manifests are standard YAML

**Alternative**: Use YAML parser (already supported)

**Example** (already supported via YAML):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
```

**Recommendation**: ✅ **Already supported** via YAML parser

---

#### ❌ Helm
**Status**: No parser (complex due to Go templating)

**Reason**: Helm templates mix YAML with Go templating syntax (`{{ }}`)

**Alternative**: Use YAML parser (already supported) for basic structure

**Example** (partially supported):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.service.name }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
```

**Recommendation**: ⚠️ **Partially supported** - YAML structure only, not Go templates

---

#### ❌ Docker Compose
**Status**: No npm package

**Reason**: Docker Compose uses standard YAML

**Alternative**: Use YAML parser (already supported)

**Example** (already supported via YAML):
```yaml
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    environment:
      - NGINX_HOST=example.com

  db:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: example
```

**Recommendation**: ✅ **Already supported** via YAML parser

---

#### ❌ Dockerfile
**Status**: Security placeholder package only (tree-sitter-dockerfile@0.0.1-security)

**Reason**: GitHub parsers exist but not published to npm

**Alternative**: Use Bash parser for shell commands

**Example** (not fully parseable):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Recommendation**: ❌ **Not available** - Bash parser can handle RUN commands only

---

### 4. CI/CD Pipelines

#### ✅ Jenkins / Groovy
**Parser**: `tree-sitter-groovy@0.1.2`

**Description**: Groovy grammar for Jenkins pipelines and Gradle build scripts

**Package Details**:
- **Version**: 0.1.2
- **Size**: 14.0 MB unpacked
- **License**: MIT
- **Maintainer**: amaanq
- **Dependencies**: node-addon-api

**Supported Files**:
- `.groovy`
- `.gradle`
- `Jenkinsfile`

**Example Jenkinsfile**:
```groovy
pipeline {
    agent any

    environment {
        NODE_VERSION = '18'
    }

    stages {
        stage('Build') {
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh './deploy.sh'
            }
        }
    }

    post {
        success {
            echo 'Build succeeded!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}
```

**Recommendation**: ✅ **Add support for Groovy/Jenkins**

---

#### ❌ GitHub Actions
**Status**: No dedicated parser

**Reason**: GitHub Actions uses standard YAML

**Alternative**: Use YAML parser (already supported)

**Example** (already supported via YAML):
```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

**Recommendation**: ✅ **Already supported** via YAML parser

---

#### ❌ GitLab CI
**Status**: No dedicated parser

**Reason**: GitLab CI uses standard YAML

**Alternative**: Use YAML parser (already supported)

**Example** (already supported via YAML):
```yaml
stages:
  - build
  - test
  - deploy

build-job:
  stage: build
  script:
    - npm install
    - npm run build

test-job:
  stage: test
  script:
    - npm test
```

**Recommendation**: ✅ **Already supported** via YAML parser

---

### 5. Cloud Provider CLIs

#### ❌ Azure CLI
**Status**: No dedicated parser needed

**Reason**: Azure CLI commands are Bash/PowerShell scripts

**Alternative**: Use Bash parser (already supported) for shell scripts

**Example** (already supported via Bash):
```bash
#!/bin/bash
az login
az group create --name myResourceGroup --location eastus
az vm create \
  --resource-group myResourceGroup \
  --name myVM \
  --image UbuntuLTS \
  --admin-username azureuser
```

**Recommendation**: ✅ **Already supported** via Bash parser

---

#### ❌ Google Cloud CLI (gcloud)
**Status**: No dedicated parser needed

**Reason**: gcloud commands are Bash/PowerShell scripts

**Alternative**: Use Bash parser (already supported)

**Example** (already supported via Bash):
```bash
#!/bin/bash
gcloud auth login
gcloud config set project my-project
gcloud compute instances create my-instance \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts
```

**Recommendation**: ✅ **Already supported** via Bash parser

---

#### ❌ AWS CLI
**Status**: No dedicated parser needed

**Reason**: AWS CLI commands are Bash/PowerShell scripts

**Alternative**: Use Bash parser (already supported)

**Example** (already supported via Bash):
```bash
#!/bin/bash
aws configure
aws s3 mb s3://my-bucket
aws s3 cp file.txt s3://my-bucket/
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --key-name MyKeyPair
```

**Recommendation**: ✅ **Already supported** via Bash parser

---

#### ❌ DigitalOcean CLI (doctl)
**Status**: No dedicated parser needed

**Reason**: doctl commands are Bash/PowerShell scripts

**Alternative**: Use Bash parser (already supported)

**Example** (already supported via Bash):
```bash
#!/bin/bash
doctl auth init
doctl compute droplet create my-droplet \
  --region nyc1 \
  --size s-1vcpu-1gb \
  --image ubuntu-20-04-x64
```

**Recommendation**: ✅ **Already supported** via Bash parser

---

#### ❌ Cloudflare
**Status**: No dedicated parser needed

**Reason**: Cloudflare Workers and configurations use JavaScript/JSON/YAML

**Alternatives**:
- **Workers**: JavaScript/TypeScript (already supported)
- **Wrangler config**: TOML (already supported)
- **API configs**: JSON/YAML (already supported)

**Example** (already supported via TOML):
```toml
# wrangler.toml
name = "my-worker"
type = "javascript"
account_id = "abc123"
workers_dev = true
route = "example.com/*"
zone_id = "def456"
```

**Recommendation**: ✅ **Already supported** via existing parsers

---

### 6. Additional DevOps Tools

#### ❌ Nginx Configuration
**Status**: GitHub parser exists but not on npm

**Reason**: Not published to npm registry

**Alternative**: None available for npm installation

**Example** (not parseable):
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static/ {
        root /var/www/html;
    }
}
```

**Recommendation**: ❌ **Not available** on npm

---

#### ❌ Protocol Buffers (.proto)
**Status**: No npm package

**Reason**: No tree-sitter parser published to npm

**Alternative**: None available

**Example** (not parseable):
```protobuf
syntax = "proto3";

package users;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}

message GetUserRequest {
  int32 id = 1;
}
```

**Recommendation**: ❌ **Not available**

---

## Recommendations

### Immediate Actions (2 parsers available)

✅ **Add Terraform/HCL support** (`@tree-sitter-grammars/tree-sitter-hcl@1.2.0`)
- Critical for Infrastructure as Code workflows
- Supports Terraform, Vault, Waypoint, Nomad
- 2.0 MB package, Apache-2.0 license

✅ **Add Groovy/Jenkins support** (`tree-sitter-groovy@0.1.2`)
- Essential for CI/CD pipelines
- Supports Jenkinsfile, Gradle builds
- 14.0 MB package, MIT license

### Already Supported (via existing parsers)

✅ **Cloud CLI scripts** - Bash parser (Azure, AWS, GCP, DigitalOcean)
✅ **GitHub Actions** - YAML parser
✅ **GitLab CI** - YAML parser
✅ **Kubernetes manifests** - YAML parser
✅ **Docker Compose** - YAML parser
✅ **Ansible playbooks** - YAML parser (structure only)
✅ **CloudFormation** - YAML/JSON parsers
✅ **Pulumi** - TypeScript/Python/Go parsers
✅ **Cloudflare Workers** - JavaScript/TOML parsers

### Not Available (wait for community)

❌ **Dockerfile** - GitHub parsers exist but not on npm
❌ **Nginx config** - GitHub parsers exist but not on npm
❌ **Protocol Buffers** - No parser exists
❌ **Bicep (Azure)** - No parser exists
❌ **Helm templates** - Complex Go templating

## Summary Table

| Category | Tool | Status | Parser/Alternative |
|----------|------|--------|-------------------|
| **IaC** | Terraform/HCL | ✅ Available | @tree-sitter-grammars/tree-sitter-hcl |
| | Pulumi | ✅ Supported | TypeScript/Python/Go |
| | CloudFormation | ✅ Supported | YAML/JSON |
| | Bicep | ❌ Not Available | None |
| **Config Mgmt** | Ansible | ✅ Partial | YAML (structure only) |
| **Containers** | Kubernetes | ✅ Supported | YAML |
| | Helm | ⚠️ Partial | YAML (no templates) |
| | Docker Compose | ✅ Supported | YAML |
| | Dockerfile | ❌ Not Available | Bash (RUN only) |
| **CI/CD** | Jenkins | ✅ Available | tree-sitter-groovy |
| | GitHub Actions | ✅ Supported | YAML |
| | GitLab CI | ✅ Supported | YAML |
| **Cloud CLIs** | Azure CLI | ✅ Supported | Bash |
| | gcloud | ✅ Supported | Bash |
| | AWS CLI | ✅ Supported | Bash |
| | doctl | ✅ Supported | Bash |
| | Cloudflare | ✅ Supported | JavaScript/TOML |
| **Other** | Nginx | ❌ Not Available | None |
| | Protobuf | ❌ Not Available | None |

## Next Steps

1. **Install and integrate** Terraform/HCL parser
2. **Install and integrate** Groovy/Jenkins parser
3. **Document** existing YAML support for Kubernetes, Ansible, Docker Compose, GitHub Actions
4. **Document** existing Bash support for cloud CLIs
5. **Monitor** for community parsers: Dockerfile, Nginx, Protobuf, Bicep

## Conclusion

✅ **2 new parsers available**: Terraform/HCL, Groovy/Jenkins
✅ **Most cloud/DevOps tools already supported**: Via YAML, JSON, Bash, TypeScript parsers
❌ **4 tools not available**: Dockerfile, Nginx, Protobuf, Bicep
⚠️ **Partial support**: Ansible (YAML only), Helm (YAML only, no Go templates)

With the addition of Terraform/HCL and Groovy/Jenkins, AutomatosX will have comprehensive DevOps ecosystem support!
