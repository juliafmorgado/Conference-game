#!/bin/bash

# ConfigMap Integration Test Script
# Tests ConfigMap creation, content loading, and hot reload functionality

set -e

NAMESPACE=${NAMESPACE:-default}
RELEASE_NAME=${RELEASE_NAME:-conference-games-test}
ENVIRONMENT=${ENVIRONMENT:-development}

echo "🚀 Testing ConfigMap Integration for Conference Games"
echo "Namespace: $NAMESPACE"
echo "Release: $RELEASE_NAME"
echo "Environment: $ENVIRONMENT"
echo ""

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl is not installed or not in PATH"
        exit 1
    fi
    echo "✅ kubectl is available"
}

# Function to check if helm is available
check_helm() {
    if ! command -v helm &> /dev/null; then
        echo "❌ helm is not installed or not in PATH"
        exit 1
    fi
    echo "✅ helm is available"
}

# Function to create test namespace
create_namespace() {
    echo "📦 Creating namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    echo "✅ Namespace ready"
}

# Function to deploy the application
deploy_app() {
    echo "🚀 Deploying Conference Games with ConfigMap integration"
    
    helm upgrade --install $RELEASE_NAME ./helm/conference-games \
        --namespace $NAMESPACE \
        --set global.environment=$ENVIRONMENT \
        --set configMaps.gameContent.create=true \
        --set configMaps.gameContent.hotReload=true \
        --set configMaps.gameContent.environmentSpecific=true \
        --set backend.replicaCount=1 \
        --set frontend.replicaCount=1 \
        --set autoscaling.enabled=false \
        --set postgresql.enabled=false \
        --set externalDatabase.enabled=false \
        --wait --timeout=300s
    
    echo "✅ Application deployed successfully"
}

# Function to test ConfigMap creation
test_configmap_creation() {
    echo "🔍 Testing ConfigMap creation"
    
    local configmap_name="$RELEASE_NAME-content-$ENVIRONMENT"
    
    if kubectl get configmap $configmap_name -n $NAMESPACE &> /dev/null; then
        echo "✅ ConfigMap $configmap_name exists"
    else
        echo "❌ ConfigMap $configmap_name not found"
        return 1
    fi
    
    # Check if ConfigMap contains expected keys
    local keys=$(kubectl get configmap $configmap_name -n $NAMESPACE -o jsonpath='{.data}' | jq -r 'keys[]')
    
    if echo "$keys" | grep -q "sentences.json"; then
        echo "✅ sentences.json found in ConfigMap"
    else
        echo "❌ sentences.json not found in ConfigMap"
        return 1
    fi
    
    if echo "$keys" | grep -q "acronyms.json"; then
        echo "✅ acronyms.json found in ConfigMap"
    else
        echo "❌ acronyms.json not found in ConfigMap"
        return 1
    fi
}

# Function to test content loading
test_content_loading() {
    echo "🔍 Testing content loading via API"
    
    # Port forward to backend service
    echo "Setting up port forwarding..."
    kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-backend 3000:3000 &
    local port_forward_pid=$!
    
    # Wait for port forward to be ready
    sleep 5
    
    # Test sentences endpoint
    echo "Testing /api/sentences endpoint..."
    local sentences_response=$(curl -s http://localhost:3000/api/sentences || echo "FAILED")
    
    if [[ "$sentences_response" == "FAILED" ]]; then
        echo "❌ Failed to fetch sentences"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    local sentences_count=$(echo "$sentences_response" | jq -r '.sentences | length')
    if [[ "$sentences_count" -gt 0 ]]; then
        echo "✅ Sentences loaded successfully ($sentences_count sentences)"
    else
        echo "❌ No sentences loaded"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    # Test acronyms endpoint
    echo "Testing /api/acronyms endpoint..."
    local acronyms_response=$(curl -s http://localhost:3000/api/acronyms || echo "FAILED")
    
    if [[ "$acronyms_response" == "FAILED" ]]; then
        echo "❌ Failed to fetch acronyms"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    local acronyms_count=$(echo "$acronyms_response" | jq -r '.acronyms | length')
    if [[ "$acronyms_count" -gt 0 ]]; then
        echo "✅ Acronyms loaded successfully ($acronyms_count acronyms)"
    else
        echo "❌ No acronyms loaded"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    # Clean up port forward
    kill $port_forward_pid 2>/dev/null || true
    sleep 2
}

# Function to test category filtering
test_category_filtering() {
    echo "🔍 Testing category filtering"
    
    # Port forward to backend service
    echo "Setting up port forwarding for category testing..."
    kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-backend 3000:3000 &
    local port_forward_pid=$!
    
    # Wait for port forward to be ready
    sleep 5
    
    # Test category filtering
    local categories=("Kubernetes" "DevOps" "Observability" "Culture")
    
    for category in "${categories[@]}"; do
        echo "Testing category: $category"
        local filtered_response=$(curl -s "http://localhost:3000/api/sentences?category=$category" || echo "FAILED")
        
        if [[ "$filtered_response" == "FAILED" ]]; then
            echo "❌ Failed to fetch sentences for category: $category"
            kill $port_forward_pid 2>/dev/null || true
            return 1
        fi
        
        local filtered_count=$(echo "$filtered_response" | jq -r '.sentences | length')
        local all_match_category=$(echo "$filtered_response" | jq -r ".sentences | all(.category == \"$category\")")
        
        if [[ "$filtered_count" -gt 0 && "$all_match_category" == "true" ]]; then
            echo "✅ Category filtering works for $category ($filtered_count sentences)"
        else
            echo "❌ Category filtering failed for $category"
            kill $port_forward_pid 2>/dev/null || true
            return 1
        fi
    done
    
    # Test invalid category
    echo "Testing invalid category filtering..."
    local invalid_response=$(curl -s "http://localhost:3000/api/sentences?category=InvalidCategory" || echo "FAILED")
    
    if [[ "$invalid_response" != "FAILED" ]]; then
        local invalid_count=$(echo "$invalid_response" | jq -r '.sentences | length')
        if [[ "$invalid_count" -eq 0 ]]; then
            echo "✅ Invalid category returns empty results"
        else
            echo "❌ Invalid category should return empty results"
            kill $port_forward_pid 2>/dev/null || true
            return 1
        fi
    fi
    
    # Clean up port forward
    kill $port_forward_pid 2>/dev/null || true
    sleep 2
}

# Function to test hot reload (if enabled)
test_hot_reload() {
    if [[ "$ENVIRONMENT" != "development" ]]; then
        echo "⏭️  Skipping hot reload test (not in development environment)"
        return 0
    fi
    
    echo "🔄 Testing hot reload functionality"
    
    local configmap_name="$RELEASE_NAME-content-$ENVIRONMENT"
    
    # Get current ConfigMap content
    local original_content=$(kubectl get configmap $configmap_name -n $NAMESPACE -o jsonpath='{.data.sentences\.json}')
    
    # Create modified content with an additional sentence
    local modified_content=$(echo "$original_content" | jq '.sentences += [{"id": "hot-reload-test", "text": "Hot reload test sentence...", "category": "Testing"}]')
    
    # Update ConfigMap
    echo "Updating ConfigMap with test content..."
    kubectl patch configmap $configmap_name -n $NAMESPACE --type merge -p "{\"data\":{\"sentences.json\":\"$(echo "$modified_content" | sed 's/"/\\"/g')\"}}"
    
    # Wait for hot reload to take effect
    echo "Waiting for hot reload (30 seconds)..."
    sleep 30
    
    # Test if new content is available
    kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-backend 3000:3000 &
    local port_forward_pid=$!
    sleep 5
    
    local updated_response=$(curl -s http://localhost:3000/api/sentences || echo "FAILED")
    
    if [[ "$updated_response" != "FAILED" ]]; then
        local has_test_sentence=$(echo "$updated_response" | jq -r '.sentences | any(.id == "hot-reload-test")')
        
        if [[ "$has_test_sentence" == "true" ]]; then
            echo "✅ Hot reload working - new content detected"
        else
            echo "❌ Hot reload not working - new content not detected"
            kill $port_forward_pid 2>/dev/null || true
            return 1
        fi
    else
        echo "❌ Failed to test hot reload"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    # Restore original content
    echo "Restoring original ConfigMap content..."
    kubectl patch configmap $configmap_name -n $NAMESPACE --type merge -p "{\"data\":{\"sentences.json\":\"$(echo "$original_content" | sed 's/"/\\"/g')\"}}"
    
    kill $port_forward_pid 2>/dev/null || true
    sleep 2
}

# Function to test health checks
test_health_checks() {
    echo "🏥 Testing health checks"
    
    kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-backend 3000:3000 &
    local port_forward_pid=$!
    sleep 5
    
    local health_response=$(curl -s http://localhost:3000/health || echo "FAILED")
    
    if [[ "$health_response" != "FAILED" ]]; then
        local status=$(echo "$health_response" | jq -r '.status')
        if [[ "$status" == "healthy" ]]; then
            echo "✅ Health check passed"
        else
            echo "❌ Health check failed: $status"
            kill $port_forward_pid 2>/dev/null || true
            return 1
        fi
    else
        echo "❌ Health endpoint not accessible"
        kill $port_forward_pid 2>/dev/null || true
        return 1
    fi
    
    kill $port_forward_pid 2>/dev/null || true
    sleep 2
}

# Function to cleanup
cleanup() {
    echo "🧹 Cleaning up test resources"
    
    # Kill any remaining port forwards
    pkill -f "kubectl port-forward" 2>/dev/null || true
    
    # Uninstall helm release
    helm uninstall $RELEASE_NAME -n $NAMESPACE 2>/dev/null || true
    
    # Delete namespace if it was created for testing
    if [[ "$NAMESPACE" == *"test"* ]]; then
        kubectl delete namespace $NAMESPACE 2>/dev/null || true
    fi
    
    echo "✅ Cleanup completed"
}

# Main test execution
main() {
    echo "Starting ConfigMap integration tests..."
    
    # Check prerequisites
    check_kubectl
    check_helm
    
    # Setup
    create_namespace
    
    # Deploy and test
    deploy_app
    test_configmap_creation
    test_content_loading
    test_category_filtering
    test_hot_reload
    test_health_checks
    
    echo ""
    echo "🎉 All ConfigMap integration tests passed!"
    echo ""
    
    # Ask if user wants to keep the deployment
    read -p "Keep the test deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    else
        echo "Test deployment kept in namespace: $NAMESPACE"
        echo "Access the application:"
        echo "  kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-frontend 8080:80"
        echo "  kubectl port-forward -n $NAMESPACE service/$RELEASE_NAME-backend 3000:3000"
    fi
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"