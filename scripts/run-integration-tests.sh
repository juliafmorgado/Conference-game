#!/bin/bash

# Integration Test Runner
# Runs all integration tests for the Conference Games application
# Requirements: 1.1, 2.1, 3.1, 4.1, 7.1, 7.3, 8.1, 8.2, 8.3, 8.5

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
BACKEND_URL=${BACKEND_URL:-"http://localhost:5000"}
SKIP_DEPLOYMENT=${SKIP_DEPLOYMENT:-false}
SKIP_PERFORMANCE=${SKIP_PERFORMANCE:-false}

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

# Check if services are running
check_services() {
    log_info "Checking if services are running..."
    
    # Check frontend
    if curl -s "$FRONTEND_URL" > /dev/null; then
        log_success "Frontend is accessible at $FRONTEND_URL"
    else
        log_error "Frontend is not accessible at $FRONTEND_URL"
        log_info "Please start the frontend service first"
        return 1
    fi
    
    # Check backend
    if curl -s "$BACKEND_URL/health" > /dev/null; then
        log_success "Backend is accessible at $BACKEND_URL"
    else
        log_error "Backend is not accessible at $BACKEND_URL"
        log_info "Please start the backend service first"
        return 1
    fi
}

# Run frontend tests
run_frontend_tests() {
    log_info "Running frontend integration tests..."
    
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Run tests
    if npm run test:run; then
        log_success "Frontend tests passed"
    else
        log_error "Frontend tests failed"
        return 1
    fi
    
    cd ..
}

# Run backend tests
run_backend_tests() {
    log_info "Running backend integration tests..."
    
    cd backend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing backend dependencies..."
        npm install
    fi
    
    # Run tests
    if npm test; then
        log_success "Backend tests passed"
    else
        log_error "Backend tests failed"
        return 1
    fi
    
    cd ..
}

# Test ConfigMap functionality
test_configmap_functionality() {
    log_info "Testing ConfigMap functionality..."
    
    if [ -f "scripts/test-configmap-functionality.js" ]; then
        if node scripts/test-configmap-functionality.js; then
            log_success "ConfigMap functionality tests passed"
        else
            log_error "ConfigMap functionality tests failed"
            return 1
        fi
    else
        log_warning "ConfigMap functionality test script not found"
    fi
}

# Test Helm chart
test_helm_chart() {
    log_info "Testing Helm chart..."
    
    if [ "$SKIP_DEPLOYMENT" = "true" ]; then
        log_info "Skipping Helm chart tests (SKIP_DEPLOYMENT=true)"
        return 0
    fi
    
    if [ -f "scripts/test-helm-chart.sh" ]; then
        if bash scripts/test-helm-chart.sh; then
            log_success "Helm chart tests passed"
        else
            log_error "Helm chart tests failed"
            return 1
        fi
    else
        log_warning "Helm chart test script not found"
    fi
}

# Run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    if [ "$SKIP_PERFORMANCE" = "true" ]; then
        log_info "Skipping performance tests (SKIP_PERFORMANCE=true)"
        return 0
    fi
    
    if [ -f "scripts/performance-load-test.sh" ]; then
        if bash scripts/performance-load-test.sh --base-url "$FRONTEND_URL"; then
            log_success "Performance tests passed"
        else
            log_error "Performance tests failed"
            return 1
        fi
    else
        log_warning "Performance test script not found"
    fi
}

# Generate comprehensive test report
generate_test_report() {
    log_info "Generating comprehensive test report..."
    
    local report_file="integration-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Conference Games Integration Test Report"
        echo "Generated: $(date)"
        echo "Frontend URL: $FRONTEND_URL"
        echo "Backend URL: $BACKEND_URL"
        echo "========================================"
        echo
        
        echo "Test Configuration:"
        echo "- Frontend URL: $FRONTEND_URL"
        echo "- Backend URL: $BACKEND_URL"
        echo "- Skip Deployment Tests: $SKIP_DEPLOYMENT"
        echo "- Skip Performance Tests: $SKIP_PERFORMANCE"
        echo
        
        echo "Test Results Summary:"
        echo "- Frontend Tests: $([ -f /tmp/frontend_tests_passed ] && echo "PASSED" || echo "FAILED/SKIPPED")"
        echo "- Backend Tests: $([ -f /tmp/backend_tests_passed ] && echo "PASSED" || echo "FAILED/SKIPPED")"
        echo "- ConfigMap Tests: $([ -f /tmp/configmap_tests_passed ] && echo "PASSED" || echo "FAILED/SKIPPED")"
        echo "- Helm Chart Tests: $([ -f /tmp/helm_tests_passed ] && echo "PASSED" || echo "FAILED/SKIPPED")"
        echo "- Performance Tests: $([ -f /tmp/performance_tests_passed ] && echo "PASSED" || echo "FAILED/SKIPPED")"
        echo
        
        echo "Requirements Coverage:"
        echo "- 1.1 Game mode selection: Frontend Tests"
        echo "- 2.1 Finish the Sentence game: Frontend Tests"
        echo "- 3.1 Guess the Acronym game: Frontend Tests"
        echo "- 4.1 Keyboard shortcuts: Frontend Tests"
        echo "- 7.1 Offline behavior: Frontend Tests"
        echo "- 7.3 Performance requirements: Performance Tests"
        echo "- 8.1 EKS deployment: Helm Chart Tests"
        echo "- 8.2 Helm charts: Helm Chart Tests"
        echo "- 8.3 ConfigMap configuration: ConfigMap Tests"
        echo "- 8.5 Horizontal scaling: Helm Chart Tests"
        echo
        
        echo "Additional Files Generated:"
        echo "- Frontend test results: $(ls frontend/coverage/ 2>/dev/null | head -1 || echo "None")"
        echo "- Backend test results: $(ls backend/coverage/ 2>/dev/null | head -1 || echo "None")"
        echo "- Performance reports: $(ls performance-test-report-*.txt 2>/dev/null | head -1 || echo "None")"
        echo "- Helm chart reports: $(ls helm-chart-test-report-*.txt 2>/dev/null | head -1 || echo "None")"
        
    } > "$report_file"
    
    log_success "Comprehensive test report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/*_tests_passed 2>/dev/null || true
}

# Main execution
main() {
    log_info "Starting comprehensive integration testing..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    local overall_success=true
    
    # Check services
    if ! check_services; then
        log_error "Service check failed, cannot proceed with tests"
        exit 1
    fi
    
    # Run frontend tests
    if run_frontend_tests; then
        touch /tmp/frontend_tests_passed
    else
        overall_success=false
    fi
    
    # Run backend tests
    if run_backend_tests; then
        touch /tmp/backend_tests_passed
    else
        overall_success=false
    fi
    
    # Test ConfigMap functionality
    if test_configmap_functionality; then
        touch /tmp/configmap_tests_passed
    else
        overall_success=false
    fi
    
    # Test Helm chart
    if test_helm_chart; then
        touch /tmp/helm_tests_passed
    else
        overall_success=false
    fi
    
    # Run performance tests
    if run_performance_tests; then
        touch /tmp/performance_tests_passed
    else
        overall_success=false
    fi
    
    # Generate report
    generate_test_report
    
    if [ "$overall_success" = true ]; then
        log_success "All integration tests completed successfully!"
        exit 0
    else
        log_error "Some integration tests failed. Check the report for details."
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-url)
            FRONTEND_URL="$2"
            shift 2
            ;;
        --backend-url)
            BACKEND_URL="$2"
            shift 2
            ;;
        --skip-deployment)
            SKIP_DEPLOYMENT=true
            shift
            ;;
        --skip-performance)
            SKIP_PERFORMANCE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --frontend-url URL      Frontend URL (default: http://localhost:3000)"
            echo "  --backend-url URL       Backend URL (default: http://localhost:5000)"
            echo "  --skip-deployment       Skip deployment-related tests"
            echo "  --skip-performance      Skip performance tests"
            echo "  --help                 Show this help message"
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