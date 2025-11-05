#!/bin/bash

# Helm Chart Testing Script
# Tests Helm chart rendering and validation without actual deployment
# Requirements: 8.1, 8.2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CHART_PATH="./helm/conference-games"
RELEASE_NAME="conference-games-test"
NAMESPACE="conference-games-test"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test Helm chart syntax
test_chart_syntax() {
    log_info "Testing Helm chart syntax..."
    
    if helm lint "$CHART_PATH"; then
        log_success "Helm chart syntax is valid"
    else
        log_error "Helm chart syntax validation failed"
        return 1
    fi
}

# Test chart templating
test_chart_templating() {
    log_info "Testing Helm chart templating..."
    
    # Test with default values
    if helm template "$RELEASE_NAME" "$CHART_PATH" --namespace "$NAMESPACE" > /tmp/helm-template-output.yaml; then
        log_success "Helm chart templating with default values succeeded"
    else
        log_error "Helm chart templating with default values failed"
        return 1
    fi
    
    # Test with custom values
    cat > /tmp/test-values.yaml << EOF
frontend:
  replicaCount: 3
backend:
  replicaCount: 3
  env:
    NODE_ENV: development
ingress:
  enabled: false
autoscaling:
  enabled: false
EOF
    
    if helm template "$RELEASE_NAME" "$CHART_PATH" --namespace "$NAMESPACE" --values /tmp/test-values.yaml > /tmp/helm-template-custom.yaml; then
        log_success "Helm chart templating with custom values succeeded"
    else
        log_error "Helm chart templating with custom values failed"
        return 1
    fi
}

# Validate generated Kubernetes manifests
validate_k8s_manifests() {
    log_info "Validating generated Kubernetes manifests..."
    
    # Check if kubectl is available for validation
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl not available, skipping manifest validation"
        return 0
    fi
    
    # Validate manifests with kubectl dry-run
    if kubectl apply --dry-run=client -f /tmp/helm-template-output.yaml &> /dev/null; then
        log_success "Generated Kubernetes manifests are valid"
    else
        log_error "Generated Kubernetes manifests validation failed"
        return 1
    fi
}

# Test ConfigMap content
test_configmap_content() {
    log_info "Testing ConfigMap content..."
    
    # Check if content files exist
    if [ -f "$CHART_PATH/content/sentences.json" ]; then
        log_success "sentences.json found in chart"
        
        # Validate JSON syntax
        if python3 -m json.tool "$CHART_PATH/content/sentences.json" > /dev/null 2>&1; then
            log_success "sentences.json is valid JSON"
        else
            log_error "sentences.json is not valid JSON"
            return 1
        fi
    else
        log_warning "sentences.json not found in chart content"
    fi
    
    if [ -f "$CHART_PATH/content/acronyms.json" ]; then
        log_success "acronyms.json found in chart"
        
        # Validate JSON syntax
        if python3 -m json.tool "$CHART_PATH/content/acronyms.json" > /dev/null 2>&1; then
            log_success "acronyms.json is valid JSON"
        else
            log_error "acronyms.json is not valid JSON"
            return 1
        fi
    else
        log_warning "acronyms.json not found in chart content"
    fi
}

# Test different deployment scenarios
test_deployment_scenarios() {
    log_info "Testing different deployment scenarios..."
    
    # Test production scenario
    cat > /tmp/prod-values.yaml << EOF
global:
  environment: production
frontend:
  replicaCount: 3
backend:
  replicaCount: 3
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
ingress:
  enabled: true
  hosts:
    - host: conference-games.prod.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
EOF
    
    if helm template "$RELEASE_NAME-prod" "$CHART_PATH" --namespace "$NAMESPACE-prod" --values /tmp/prod-values.yaml > /tmp/helm-prod.yaml; then
        log_success "Production scenario templating succeeded"
    else
        log_error "Production scenario templating failed"
        return 1
    fi
    
    # Test staging scenario
    cat > /tmp/staging-values.yaml << EOF
global:
  environment: staging
frontend:
  replicaCount: 2
backend:
  replicaCount: 2
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
ingress:
  enabled: true
  hosts:
    - host: conference-games.staging.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
EOF
    
    if helm template "$RELEASE_NAME-staging" "$CHART_PATH" --namespace "$NAMESPACE-staging" --values /tmp/staging-values.yaml > /tmp/helm-staging.yaml; then
        log_success "Staging scenario templating succeeded"
    else
        log_error "Staging scenario templating failed"
        return 1
    fi
}

# Analyze generated resources
analyze_resources() {
    log_info "Analyzing generated resources..."
    
    # Count different resource types
    local deployments=$(grep -c "kind: Deployment" /tmp/helm-template-output.yaml || echo "0")
    local services=$(grep -c "kind: Service" /tmp/helm-template-output.yaml || echo "0")
    local configmaps=$(grep -c "kind: ConfigMap" /tmp/helm-template-output.yaml || echo "0")
    local ingresses=$(grep -c "kind: Ingress" /tmp/helm-template-output.yaml || echo "0")
    local hpas=$(grep -c "kind: HorizontalPodAutoscaler" /tmp/helm-template-output.yaml || echo "0")
    
    log_info "Resource summary:"
    log_info "  Deployments: $deployments"
    log_info "  Services: $services"
    log_info "  ConfigMaps: $configmaps"
    log_info "  Ingresses: $ingresses"
    log_info "  HPAs: $hpas"
    
    # Validate expected resources
    if [ "$deployments" -ge 2 ]; then
        log_success "Expected number of deployments found (frontend + backend)"
    else
        log_error "Expected at least 2 deployments, found $deployments"
        return 1
    fi
    
    if [ "$services" -ge 2 ]; then
        log_success "Expected number of services found"
    else
        log_error "Expected at least 2 services, found $services"
        return 1
    fi
}

# Generate test report
generate_test_report() {
    log_info "Generating test report..."
    
    local report_file="helm-chart-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Helm Chart Test Report"
        echo "Generated: $(date)"
        echo "Chart Path: $CHART_PATH"
        echo "=========================="
        echo
        
        echo "Chart Information:"
        helm show chart "$CHART_PATH"
        echo
        
        echo "Default Values:"
        helm show values "$CHART_PATH"
        echo
        
        echo "Generated Resources (Default Values):"
        echo "======================================"
        cat /tmp/helm-template-output.yaml
        echo
        
        echo "Generated Resources (Production Scenario):"
        echo "=========================================="
        if [ -f /tmp/helm-prod.yaml ]; then
            cat /tmp/helm-prod.yaml
        else
            echo "Production scenario not generated"
        fi
        
    } > "$report_file"
    
    log_success "Test report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/helm-template-*.yaml /tmp/test-values.yaml /tmp/prod-values.yaml /tmp/staging-values.yaml
}

# Main execution
main() {
    log_info "Starting Helm chart testing..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Check if Helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if chart directory exists
    if [ ! -d "$CHART_PATH" ]; then
        log_error "Chart directory $CHART_PATH does not exist"
        exit 1
    fi
    
    # Run tests
    test_chart_syntax
    test_chart_templating
    validate_k8s_manifests
    test_configmap_content
    test_deployment_scenarios
    analyze_resources
    generate_test_report
    
    log_success "Helm chart testing completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --chart-path)
            CHART_PATH="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --chart-path PATH    Path to Helm chart (default: ./helm/conference-games)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main