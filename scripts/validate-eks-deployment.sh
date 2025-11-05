#!/bin/bash

# EKS Deployment Validation Script
# Validates Helm chart deployment, ingress configuration, and ConfigMap mounting
# Requirements: 8.1, 8.2, 8.3, 8.5

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-"conference-games"}
RELEASE_NAME=${RELEASE_NAME:-"conference-games"}
CHART_PATH=${CHART_PATH:-"./helm/conference-games"}
TIMEOUT=${TIMEOUT:-"300s"}
KUBECONFIG=${KUBECONFIG:-"$HOME/.kube/config"}

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed and configured
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if kubeconfig is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Check your kubeconfig."
        exit 1
    fi
    
    # Check if we can access the cluster
    if ! kubectl auth can-i get pods --namespace="$NAMESPACE" &> /dev/null; then
        log_warning "May not have sufficient permissions in namespace $NAMESPACE"
    fi
    
    log_success "Prerequisites check passed"
}

# Validate Helm chart
validate_helm_chart() {
    log_info "Validating Helm chart..."
    
    # Check if chart directory exists
    if [ ! -d "$CHART_PATH" ]; then
        log_error "Chart directory $CHART_PATH does not exist"
        exit 1
    fi
    
    # Validate chart syntax
    if ! helm lint "$CHART_PATH"; then
        log_error "Helm chart validation failed"
        exit 1
    fi
    
    # Template the chart to check for issues
    if ! helm template "$RELEASE_NAME" "$CHART_PATH" --namespace "$NAMESPACE" > /dev/null; then
        log_error "Helm template generation failed"
        exit 1
    fi
    
    log_success "Helm chart validation passed"
}

# Create namespace if it doesn't exist
create_namespace() {
    log_info "Ensuring namespace $NAMESPACE exists..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        kubectl create namespace "$NAMESPACE"
        log_success "Created namespace $NAMESPACE"
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}

# Deploy using Helm
deploy_helm_chart() {
    log_info "Deploying Helm chart..."
    
    # Deploy or upgrade the release
    helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --timeout "$TIMEOUT" \
        --wait \
        --create-namespace \
        --values "$CHART_PATH/values.yaml"
    
    if [ $? -eq 0 ]; then
        log_success "Helm deployment completed successfully"
    else
        log_error "Helm deployment failed"
        exit 1
    fi
}

# Wait for pods to be ready
wait_for_pods() {
    log_info "Waiting for pods to be ready..."
    
    # Wait for frontend pods
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=conference-games,app.kubernetes.io/component=frontend \
        --namespace="$NAMESPACE" \
        --timeout="$TIMEOUT"
    
    # Wait for backend pods
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=conference-games,app.kubernetes.io/component=backend \
        --namespace="$NAMESPACE" \
        --timeout="$TIMEOUT"
    
    log_success "All pods are ready"
}

# Validate ConfigMap mounting
validate_configmap_mounting() {
    log_info "Validating ConfigMap mounting..."
    
    # Check if ConfigMaps exist
    local configmaps=("conference-games-content" "conference-games-config")
    
    for cm in "${configmaps[@]}"; do
        if kubectl get configmap "$cm" --namespace="$NAMESPACE" &> /dev/null; then
            log_success "ConfigMap $cm exists"
        else
            log_warning "ConfigMap $cm not found"
        fi
    done
    
    # Check if ConfigMaps are mounted in backend pods
    local backend_pods=$(kubectl get pods -l app.kubernetes.io/component=backend --namespace="$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $backend_pods; do
        log_info "Checking ConfigMap mounts in pod $pod..."
        
        # Check if content directory is mounted
        if kubectl exec "$pod" --namespace="$NAMESPACE" -- ls /app/content &> /dev/null; then
            log_success "Content directory mounted in pod $pod"
            
            # Check if content files exist
            if kubectl exec "$pod" --namespace="$NAMESPACE" -- ls /app/content/sentences.json &> /dev/null; then
                log_success "sentences.json found in pod $pod"
            else
                log_warning "sentences.json not found in pod $pod"
            fi
            
            if kubectl exec "$pod" --namespace="$NAMESPACE" -- ls /app/content/acronyms.json &> /dev/null; then
                log_success "acronyms.json found in pod $pod"
            else
                log_warning "acronyms.json not found in pod $pod"
            fi
        else
            log_error "Content directory not mounted in pod $pod"
        fi
    done
}

# Test ingress configuration
validate_ingress() {
    log_info "Validating ingress configuration..."
    
    # Check if ingress exists
    if kubectl get ingress "$RELEASE_NAME" --namespace="$NAMESPACE" &> /dev/null; then
        log_success "Ingress $RELEASE_NAME exists"
        
        # Get ingress details
        local ingress_info=$(kubectl get ingress "$RELEASE_NAME" --namespace="$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
        
        if [ -n "$ingress_info" ]; then
            log_success "Ingress has load balancer: $ingress_info"
            
            # Test if the load balancer is accessible (basic connectivity test)
            if command -v curl &> /dev/null; then
                log_info "Testing load balancer connectivity..."
                if curl -s --connect-timeout 10 "http://$ingress_info/health" &> /dev/null; then
                    log_success "Load balancer is accessible"
                else
                    log_warning "Load balancer may not be fully ready yet"
                fi
            fi
        else
            log_warning "Ingress load balancer not yet provisioned"
        fi
    else
        log_error "Ingress $RELEASE_NAME not found"
    fi
}

# Test horizontal pod autoscaling
validate_hpa() {
    log_info "Validating Horizontal Pod Autoscaler..."
    
    # Check if HPA exists for backend
    if kubectl get hpa "${RELEASE_NAME}-backend" --namespace="$NAMESPACE" &> /dev/null; then
        log_success "HPA for backend exists"
        
        # Get HPA status
        local hpa_status=$(kubectl get hpa "${RELEASE_NAME}-backend" --namespace="$NAMESPACE" -o jsonpath='{.status.currentReplicas}')
        log_info "Current backend replicas: $hpa_status"
    else
        log_warning "HPA for backend not found"
    fi
    
    # Check if HPA exists for frontend
    if kubectl get hpa "${RELEASE_NAME}-frontend" --namespace="$NAMESPACE" &> /dev/null; then
        log_success "HPA for frontend exists"
        
        # Get HPA status
        local hpa_status=$(kubectl get hpa "${RELEASE_NAME}-frontend" --namespace="$NAMESPACE" -o jsonpath='{.status.currentReplicas}')
        log_info "Current frontend replicas: $hpa_status"
    else
        log_warning "HPA for frontend not found"
    fi
}

# Test service connectivity
test_service_connectivity() {
    log_info "Testing service connectivity..."
    
    # Test backend service
    local backend_service="${RELEASE_NAME}-backend"
    if kubectl get service "$backend_service" --namespace="$NAMESPACE" &> /dev/null; then
        log_success "Backend service $backend_service exists"
        
        # Port forward and test
        log_info "Testing backend health endpoint..."
        kubectl port-forward "service/$backend_service" 8080:3000 --namespace="$NAMESPACE" &
        local pf_pid=$!
        sleep 5
        
        if curl -s http://localhost:8080/health &> /dev/null; then
            log_success "Backend health endpoint is accessible"
        else
            log_warning "Backend health endpoint not accessible"
        fi
        
        kill $pf_pid 2>/dev/null || true
    else
        log_error "Backend service $backend_service not found"
    fi
    
    # Test frontend service
    local frontend_service="${RELEASE_NAME}-frontend"
    if kubectl get service "$frontend_service" --namespace="$NAMESPACE" &> /dev/null; then
        log_success "Frontend service $frontend_service exists"
    else
        log_error "Frontend service $frontend_service not found"
    fi
}

# Validate content loading
validate_content_loading() {
    log_info "Validating content loading..."
    
    # Get a backend pod
    local backend_pod=$(kubectl get pods -l app.kubernetes.io/component=backend --namespace="$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$backend_pod" ]; then
        log_info "Testing content API in pod $backend_pod..."
        
        # Test sentences endpoint
        if kubectl exec "$backend_pod" --namespace="$NAMESPACE" -- curl -s http://localhost:3000/api/sentences | grep -q "sentences"; then
            log_success "Sentences API is working"
        else
            log_warning "Sentences API may not be working properly"
        fi
        
        # Test acronyms endpoint
        if kubectl exec "$backend_pod" --namespace="$NAMESPACE" -- curl -s http://localhost:3000/api/acronyms | grep -q "acronyms"; then
            log_success "Acronyms API is working"
        else
            log_warning "Acronyms API may not be working properly"
        fi
    else
        log_error "No backend pods found"
    fi
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."
    
    local report_file="eks-deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "EKS Deployment Validation Report"
        echo "Generated: $(date)"
        echo "Namespace: $NAMESPACE"
        echo "Release: $RELEASE_NAME"
        echo "================================"
        echo
        
        echo "Pods Status:"
        kubectl get pods --namespace="$NAMESPACE" -o wide
        echo
        
        echo "Services Status:"
        kubectl get services --namespace="$NAMESPACE"
        echo
        
        echo "Ingress Status:"
        kubectl get ingress --namespace="$NAMESPACE"
        echo
        
        echo "ConfigMaps:"
        kubectl get configmaps --namespace="$NAMESPACE"
        echo
        
        echo "HPA Status:"
        kubectl get hpa --namespace="$NAMESPACE"
        echo
        
        echo "Events (last 10):"
        kubectl get events --namespace="$NAMESPACE" --sort-by='.lastTimestamp' | tail -10
        
    } > "$report_file"
    
    log_success "Report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up port-forward processes..."
    pkill -f "kubectl port-forward" 2>/dev/null || true
}

# Main execution
main() {
    log_info "Starting EKS deployment validation..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run validation steps
    check_prerequisites
    validate_helm_chart
    create_namespace
    deploy_helm_chart
    wait_for_pods
    validate_configmap_mounting
    validate_ingress
    validate_hpa
    test_service_connectivity
    validate_content_loading
    generate_report
    
    log_success "EKS deployment validation completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --release-name)
            RELEASE_NAME="$2"
            shift 2
            ;;
        --chart-path)
            CHART_PATH="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NAME     Kubernetes namespace (default: conference-games)"
            echo "  --release-name NAME  Helm release name (default: conference-games)"
            echo "  --chart-path PATH    Path to Helm chart (default: ./helm/conference-games)"
            echo "  --timeout DURATION   Timeout for operations (default: 300s)"
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