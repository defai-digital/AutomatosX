#!/bin/bash

#
# deploy-validation.sh
#
# Deployment script for ADR-014 validation system.
# Supports phased rollout: staging → canary → ramp → full.
#
# Week 3 Day 2 - Deployment Helper
#
# Usage:
#   ./scripts/deploy-validation.sh staging
#   ./scripts/deploy-validation.sh canary
#   ./scripts/deploy-validation.sh ramp
#   ./scripts/deploy-validation.sh full
#   ./scripts/deploy-validation.sh rollback
#

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE="${1:-staging}"
PROJECT_NAME="automatosx"
VERSION="8.0.0"

# Print colored message
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  AutomatosX Validation System Deployment${NC}"
    echo -e "${BLUE}  Version: ${VERSION}${NC}"
    echo -e "${BLUE}  Type: ${DEPLOYMENT_TYPE}${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if build exists
    if [ ! -d "dist" ]; then
        print_error "Build directory not found. Run 'npm run build' first."
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js."
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Deploy to staging
deploy_staging() {
    print_info "Deploying to staging environment..."

    # Set staging environment variables
    export NODE_ENV=staging
    export VALIDATION_ENABLED=true
    export VALIDATION_PARSER_MODE=enforce
    export VALIDATION_DATABASE_MODE=enforce
    export VALIDATION_SAMPLE_RATE=0.5

    print_info "Configuration:"
    print_info "  NODE_ENV: ${NODE_ENV}"
    print_info "  VALIDATION_ENABLED: ${VALIDATION_ENABLED}"
    print_info "  VALIDATION_PARSER_MODE: ${VALIDATION_PARSER_MODE}"
    print_info "  VALIDATION_DATABASE_MODE: ${VALIDATION_DATABASE_MODE}"
    print_info "  VALIDATION_SAMPLE_RATE: ${VALIDATION_SAMPLE_RATE}"

    # Build production bundle
    print_info "Building production bundle..."
    npm run build

    # TODO: Replace with your actual deployment commands
    # Examples:

    # For Docker deployment:
    # docker build -t ${PROJECT_NAME}:v${VERSION}-staging .
    # docker tag ${PROJECT_NAME}:v${VERSION}-staging registry.example.com/${PROJECT_NAME}:v${VERSION}-staging
    # docker push registry.example.com/${PROJECT_NAME}:v${VERSION}-staging

    # For Kubernetes deployment:
    # kubectl set image deployment/${PROJECT_NAME} ${PROJECT_NAME}=registry.example.com/${PROJECT_NAME}:v${VERSION}-staging
    # kubectl set env deployment/${PROJECT_NAME} \
    #   NODE_ENV=staging \
    #   VALIDATION_ENABLED=true \
    #   VALIDATION_PARSER_MODE=enforce \
    #   VALIDATION_DATABASE_MODE=enforce \
    #   VALIDATION_SAMPLE_RATE=0.5

    # For direct server deployment:
    # rsync -avz dist/ package.json package-lock.json staging-server:/opt/${PROJECT_NAME}/
    # ssh staging-server "cd /opt/${PROJECT_NAME} && npm install --production && pm2 restart ${PROJECT_NAME}"

    print_warning "NOTE: Deployment commands are placeholders."
    print_warning "Replace with your actual deployment procedure in this script."

    print_success "Staging deployment configuration complete"
    print_info "Next steps:"
    print_info "  1. Deploy to your staging environment using your deployment tool"
    print_info "  2. Run: STAGING_URL=https://staging.example.com npx tsx scripts/staging-validation-test.ts"
    print_info "  3. Monitor staging metrics for 1 hour"
}

# Deploy production canary (10%, log-only)
deploy_canary() {
    print_info "Deploying production canary (10%, log-only)..."

    export NODE_ENV=production
    export VALIDATION_ENABLED=true
    export VALIDATION_PARSER_MODE=log_only
    export VALIDATION_DATABASE_MODE=log_only
    export VALIDATION_SAMPLE_RATE=0.1

    print_info "Configuration:"
    print_info "  NODE_ENV: ${NODE_ENV}"
    print_info "  VALIDATION_PARSER_MODE: ${VALIDATION_PARSER_MODE} (log-only for safety)"
    print_info "  VALIDATION_DATABASE_MODE: ${VALIDATION_DATABASE_MODE} (log-only for safety)"
    print_info "  VALIDATION_SAMPLE_RATE: ${VALIDATION_SAMPLE_RATE} (10% of production traffic)"

    print_info "Building production bundle..."
    npm run build

    # TODO: Replace with your canary deployment commands
    # Examples:

    # For Kubernetes with canary deployment:
    # kubectl set env deployment/${PROJECT_NAME} \
    #   NODE_ENV=production \
    #   VALIDATION_ENABLED=true \
    #   VALIDATION_PARSER_MODE=log_only \
    #   VALIDATION_DATABASE_MODE=log_only \
    #   VALIDATION_SAMPLE_RATE=0.1

    # For load balancer-based canary:
    # Update load balancer to route 10% traffic to canary servers

    print_warning "NOTE: Deployment commands are placeholders."
    print_warning "Replace with your actual canary deployment procedure."

    print_success "Canary deployment configuration complete"
    print_info "Next steps:"
    print_info "  1. Deploy to 10% of production traffic"
    print_info "  2. Monitor metrics for 1 hour:"
    print_info "     - Success rate should be 100%"
    print_info "     - P95 latency should be < 100ms"
    print_info "     - No validation errors in logs"
    print_info "  3. If successful, proceed with ramp deployment"
}

# Deploy production ramp (50%, enforce)
deploy_ramp() {
    print_info "Deploying production ramp (50%, enforce)..."

    export NODE_ENV=production
    export VALIDATION_ENABLED=true
    export VALIDATION_PARSER_MODE=enforce
    export VALIDATION_DATABASE_MODE=enforce
    export VALIDATION_SAMPLE_RATE=0.5

    print_info "Configuration:"
    print_info "  NODE_ENV: ${NODE_ENV}"
    print_info "  VALIDATION_PARSER_MODE: ${VALIDATION_PARSER_MODE} (enforce mode enabled)"
    print_info "  VALIDATION_DATABASE_MODE: ${VALIDATION_DATABASE_MODE} (enforce mode enabled)"
    print_info "  VALIDATION_SAMPLE_RATE: ${VALIDATION_SAMPLE_RATE} (50% of production traffic)"

    print_warning "⚠️  CAUTION: Enforce mode is now enabled!"
    print_warning "Validation failures will now block operations."
    read -p "Continue with ramp deployment? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi

    print_info "Building production bundle..."
    npm run build

    # TODO: Replace with your ramp deployment commands

    print_warning "NOTE: Deployment commands are placeholders."
    print_warning "Replace with your actual ramp deployment procedure."

    print_success "Ramp deployment configuration complete"
    print_info "Next steps:"
    print_info "  1. Increase to 50% of production traffic"
    print_info "  2. Monitor metrics for 1 hour"
    print_info "  3. If successful, proceed with full deployment"
}

# Deploy full production (100%, enforce)
deploy_full() {
    print_info "Deploying full production (100%, enforce)..."

    export NODE_ENV=production
    export VALIDATION_ENABLED=true
    export VALIDATION_PARSER_MODE=enforce
    export VALIDATION_DATABASE_MODE=enforce
    export VALIDATION_SAMPLE_RATE=1.0

    print_info "Configuration:"
    print_info "  NODE_ENV: ${NODE_ENV}"
    print_info "  VALIDATION_PARSER_MODE: ${VALIDATION_PARSER_MODE}"
    print_info "  VALIDATION_DATABASE_MODE: ${VALIDATION_DATABASE_MODE}"
    print_info "  VALIDATION_SAMPLE_RATE: ${VALIDATION_SAMPLE_RATE} (100% of production traffic)"

    print_warning "⚠️  FINAL STEP: Full production rollout!"
    print_warning "All production traffic will use validation in enforce mode."
    read -p "Continue with full deployment? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi

    print_info "Building production bundle..."
    npm run build

    # TODO: Replace with your full deployment commands

    print_warning "NOTE: Deployment commands are placeholders."
    print_warning "Replace with your actual full deployment procedure."

    print_success "Full deployment configuration complete"
    print_info "Next steps:"
    print_info "  1. Increase to 100% of production traffic"
    print_info "  2. Monitor metrics for 1 hour"
    print_info "  3. Monitor for 24 hours to ensure stability"
    print_info "  4. Update ADR-014 with production metrics"
}

# Rollback validation
rollback_validation() {
    print_warning "Initiating validation rollback..."

    echo ""
    echo "Select rollback level:"
    echo "  1) Kill switch (disable validation completely)"
    echo "  2) Log-only mode (validate but don't block)"
    echo "  3) Reduce sampling (10%)"
    echo "  4) Full code rollback (revert to v7.9.0)"
    echo ""
    read -p "Enter rollback level (1-4): " level

    case $level in
        1)
            print_info "Level 1: Kill switch - Disabling validation..."
            export VALIDATION_ENABLED=false

            # TODO: Apply kill switch
            # kubectl set env deployment/${PROJECT_NAME} VALIDATION_ENABLED=false

            print_success "Validation disabled"
            print_info "Estimated time: 30 seconds"
            ;;
        2)
            print_info "Level 2: Switching to log-only mode..."
            export VALIDATION_PARSER_MODE=log_only
            export VALIDATION_DATABASE_MODE=log_only

            # TODO: Switch to log-only
            # kubectl set env deployment/${PROJECT_NAME} \
            #   VALIDATION_PARSER_MODE=log_only \
            #   VALIDATION_DATABASE_MODE=log_only

            print_success "Switched to log-only mode"
            print_info "Estimated time: 1 minute"
            ;;
        3)
            print_info "Level 3: Reducing sampling to 10%..."
            export VALIDATION_SAMPLE_RATE=0.1

            # TODO: Reduce sampling
            # kubectl set env deployment/${PROJECT_NAME} VALIDATION_SAMPLE_RATE=0.1

            print_success "Sampling reduced to 10%"
            print_info "Estimated time: 1 minute"
            ;;
        4)
            print_warning "Level 4: Full code rollback to v7.9.0..."
            read -p "This will revert all validation changes. Continue? (yes/no): " confirm

            if [ "$confirm" != "yes" ]; then
                print_info "Rollback cancelled"
                exit 0
            fi

            # TODO: Code rollback
            # kubectl rollout undo deployment/${PROJECT_NAME}
            # Or: git checkout v7.9.0 && npm run build && <deploy>

            print_success "Code rollback initiated"
            print_info "Estimated time: 5 minutes"
            ;;
        *)
            print_error "Invalid rollback level"
            exit 1
            ;;
    esac

    print_warning "NOTE: Rollback commands are placeholders."
    print_warning "Replace with your actual rollback procedure."

    print_info "Next steps:"
    print_info "  1. Verify rollback was successful"
    print_info "  2. Monitor metrics to ensure issues are resolved"
    print_info "  3. Investigate root cause of the issue"
    print_info "  4. Plan remediation strategy"
}

# Main execution
main() {
    print_banner
    check_prerequisites

    case $DEPLOYMENT_TYPE in
        staging)
            deploy_staging
            ;;
        canary)
            deploy_canary
            ;;
        ramp)
            deploy_ramp
            ;;
        full)
            deploy_full
            ;;
        rollback)
            rollback_validation
            ;;
        *)
            print_error "Invalid deployment type: $DEPLOYMENT_TYPE"
            echo ""
            echo "Usage: $0 [staging|canary|ramp|full|rollback]"
            echo ""
            echo "Deployment phases:"
            echo "  staging  - Deploy to staging (50% sampling, enforce mode)"
            echo "  canary   - Deploy to production (10% sampling, log-only mode)"
            echo "  ramp     - Increase to 50% sampling, enforce mode"
            echo "  full     - Increase to 100% sampling, enforce mode"
            echo "  rollback - Emergency rollback procedures"
            echo ""
            exit 1
            ;;
    esac

    echo ""
}

main
