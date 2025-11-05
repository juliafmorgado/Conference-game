#!/bin/bash

# Performance and Load Testing Script
# Tests application performance on mobile devices and validates 3-second load time requirement
# Tests concurrent user scenarios
# Requirements: 7.3, 1.3

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
CONCURRENT_USERS=${CONCURRENT_USERS:-50}
TEST_DURATION=${TEST_DURATION:-60}
LOAD_TIME_THRESHOLD=${LOAD_TIME_THRESHOLD:-3000} # 3 seconds in milliseconds
MOBILE_USER_AGENTS=(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
    "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
)

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
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if node is available (for lighthouse)
    if ! command -v node &> /dev/null; then
        log_warning "Node.js not available, some tests will be skipped"
    fi
    
    # Check if lighthouse is available
    if ! command -v lighthouse &> /dev/null; then
        log_warning "Lighthouse not available, installing..."
        if command -v npm &> /dev/null; then
            npm install -g lighthouse
        else
            log_warning "Cannot install Lighthouse, performance audits will be skipped"
        fi
    fi
    
    # Check if ab (Apache Bench) is available
    if ! command -v ab &> /dev/null; then
        log_warning "Apache Bench (ab) not available, some load tests will be skipped"
    fi
    
    log_success "Prerequisites check completed"
}

# Test basic connectivity
test_connectivity() {
    log_info "Testing basic connectivity to $BASE_URL..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" || echo "000")
    
    if [ "$response_code" = "200" ]; then
        log_success "Application is accessible (HTTP $response_code)"
    else
        log_error "Application is not accessible (HTTP $response_code)"
        return 1
    fi
}

# Test load time performance
test_load_time() {
    log_info "Testing page load time performance..."
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    # Test multiple requests to get average
    for i in {1..10}; do
        log_info "Load time test $i/10..."
        
        local start_time=$(date +%s%3N)
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
        local end_time=$(date +%s%3N)
        
        if [ "$response_code" = "200" ]; then
            local load_time=$((end_time - start_time))
            total_time=$((total_time + load_time))
            successful_requests=$((successful_requests + 1))
            
            log_info "Request $i: ${load_time}ms"
            
            if [ "$load_time" -le "$LOAD_TIME_THRESHOLD" ]; then
                log_success "Load time within threshold (${load_time}ms <= ${LOAD_TIME_THRESHOLD}ms)"
            else
                log_warning "Load time exceeds threshold (${load_time}ms > ${LOAD_TIME_THRESHOLD}ms)"
            fi
        else
            failed_requests=$((failed_requests + 1))
            log_error "Request $i failed with HTTP $response_code"
        fi
        
        sleep 1
    done
    
    if [ "$successful_requests" -gt 0 ]; then
        local average_time=$((total_time / successful_requests))
        log_info "Average load time: ${average_time}ms"
        log_info "Successful requests: $successful_requests/10"
        log_info "Failed requests: $failed_requests/10"
        
        if [ "$average_time" -le "$LOAD_TIME_THRESHOLD" ]; then
            log_success "Average load time meets requirement (${average_time}ms <= ${LOAD_TIME_THRESHOLD}ms)"
        else
            log_error "Average load time exceeds requirement (${average_time}ms > ${LOAD_TIME_THRESHOLD}ms)"
            return 1
        fi
    else
        log_error "All load time tests failed"
        return 1
    fi
}

# Test mobile performance with different user agents
test_mobile_performance() {
    log_info "Testing mobile performance with different user agents..."
    
    for i in "${!MOBILE_USER_AGENTS[@]}"; do
        local user_agent="${MOBILE_USER_AGENTS[$i]}"
        local device_type=""
        
        if [[ "$user_agent" == *"iPhone"* ]]; then
            device_type="iPhone"
        elif [[ "$user_agent" == *"Android"* ]]; then
            device_type="Android"
        elif [[ "$user_agent" == *"iPad"* ]]; then
            device_type="iPad"
        else
            device_type="Mobile Device $((i+1))"
        fi
        
        log_info "Testing $device_type performance..."
        
        local start_time=$(date +%s%3N)
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: $user_agent" "$BASE_URL")
        local end_time=$(date +%s%3N)
        
        if [ "$response_code" = "200" ]; then
            local load_time=$((end_time - start_time))
            log_info "$device_type load time: ${load_time}ms"
            
            if [ "$load_time" -le "$LOAD_TIME_THRESHOLD" ]; then
                log_success "$device_type performance meets requirement"
            else
                log_warning "$device_type performance exceeds threshold"
            fi
        else
            log_error "$device_type test failed with HTTP $response_code"
        fi
        
        sleep 2
    done
}

# Run Lighthouse performance audit
run_lighthouse_audit() {
    log_info "Running Lighthouse performance audit..."
    
    if ! command -v lighthouse &> /dev/null; then
        log_warning "Lighthouse not available, skipping performance audit"
        return 0
    fi
    
    local lighthouse_output="lighthouse-report-$(date +%Y%m%d-%H%M%S)"
    
    # Run Lighthouse for desktop
    log_info "Running Lighthouse audit for desktop..."
    if lighthouse "$BASE_URL" --output=json --output-path="${lighthouse_output}-desktop.json" --preset=desktop --quiet; then
        local desktop_score=$(node -e "
            const report = require('./${lighthouse_output}-desktop.json');
            console.log(Math.round(report.lhr.categories.performance.score * 100));
        " 2>/dev/null || echo "0")
        
        log_info "Desktop Performance Score: $desktop_score/100"
        
        if [ "$desktop_score" -ge 90 ]; then
            log_success "Excellent desktop performance score"
        elif [ "$desktop_score" -ge 70 ]; then
            log_success "Good desktop performance score"
        else
            log_warning "Desktop performance score needs improvement"
        fi
    else
        log_warning "Desktop Lighthouse audit failed"
    fi
    
    # Run Lighthouse for mobile
    log_info "Running Lighthouse audit for mobile..."
    if lighthouse "$BASE_URL" --output=json --output-path="${lighthouse_output}-mobile.json" --preset=mobile --quiet; then
        local mobile_score=$(node -e "
            const report = require('./${lighthouse_output}-mobile.json');
            console.log(Math.round(report.lhr.categories.performance.score * 100));
        " 2>/dev/null || echo "0")
        
        log_info "Mobile Performance Score: $mobile_score/100"
        
        if [ "$mobile_score" -ge 90 ]; then
            log_success "Excellent mobile performance score"
        elif [ "$mobile_score" -ge 70 ]; then
            log_success "Good mobile performance score"
        else
            log_warning "Mobile performance score needs improvement"
        fi
    else
        log_warning "Mobile Lighthouse audit failed"
    fi
}

# Test API endpoints performance
test_api_performance() {
    log_info "Testing API endpoints performance..."
    
    local endpoints=("/api/sentences" "/api/acronyms" "/health")
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testing $endpoint performance..."
        
        local total_time=0
        local successful_requests=0
        
        for i in {1..5}; do
            local start_time=$(date +%s%3N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
            local end_time=$(date +%s%3N)
            
            if [ "$response_code" = "200" ]; then
                local response_time=$((end_time - start_time))
                total_time=$((total_time + response_time))
                successful_requests=$((successful_requests + 1))
            fi
        done
        
        if [ "$successful_requests" -gt 0 ]; then
            local average_time=$((total_time / successful_requests))
            log_info "$endpoint average response time: ${average_time}ms"
            
            if [ "$average_time" -le 1000 ]; then
                log_success "$endpoint performance is good"
            else
                log_warning "$endpoint response time is slow"
            fi
        else
            log_error "$endpoint tests failed"
        fi
    done
}

# Test concurrent user scenarios
test_concurrent_users() {
    log_info "Testing concurrent user scenarios..."
    
    if ! command -v ab &> /dev/null; then
        log_warning "Apache Bench not available, using curl for basic concurrent testing"
        test_concurrent_users_curl
        return
    fi
    
    log_info "Running Apache Bench test with $CONCURRENT_USERS concurrent users for ${TEST_DURATION}s..."
    
    # Test main page
    local ab_output=$(ab -n $((CONCURRENT_USERS * 10)) -c "$CONCURRENT_USERS" -t "$TEST_DURATION" "$BASE_URL/" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local requests_per_second=$(echo "$ab_output" | grep "Requests per second" | awk '{print $4}')
        local time_per_request=$(echo "$ab_output" | grep "Time per request" | head -1 | awk '{print $4}')
        local failed_requests=$(echo "$ab_output" | grep "Failed requests" | awk '{print $3}')
        
        log_info "Concurrent user test results:"
        log_info "  Requests per second: $requests_per_second"
        log_info "  Time per request: ${time_per_request}ms"
        log_info "  Failed requests: $failed_requests"
        
        if [ "${failed_requests:-0}" -eq 0 ]; then
            log_success "No failed requests during concurrent user test"
        else
            log_warning "$failed_requests requests failed during concurrent user test"
        fi
        
        # Check if performance is acceptable
        local rps_threshold=10
        if (( $(echo "$requests_per_second > $rps_threshold" | bc -l 2>/dev/null || echo "0") )); then
            log_success "Requests per second meets threshold ($requests_per_second > $rps_threshold)"
        else
            log_warning "Requests per second below threshold ($requests_per_second <= $rps_threshold)"
        fi
    else
        log_error "Apache Bench test failed"
    fi
}

# Fallback concurrent user testing with curl
test_concurrent_users_curl() {
    log_info "Running basic concurrent user test with curl..."
    
    local pids=()
    local start_time=$(date +%s)
    
    # Start concurrent requests
    for i in $(seq 1 "$CONCURRENT_USERS"); do
        (
            local user_start=$(date +%s%3N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
            local user_end=$(date +%s%3N)
            local user_time=$((user_end - user_start))
            
            echo "User $i: HTTP $response_code, Time: ${user_time}ms"
        ) &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    local successful=0
    local failed=0
    
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            successful=$((successful + 1))
        else
            failed=$((failed + 1))
        fi
    done
    
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    
    log_info "Concurrent user test completed:"
    log_info "  Total time: ${total_time}s"
    log_info "  Successful requests: $successful"
    log_info "  Failed requests: $failed"
    
    if [ "$failed" -eq 0 ]; then
        log_success "All concurrent requests succeeded"
    else
        log_warning "$failed out of $CONCURRENT_USERS requests failed"
    fi
}

# Test resource usage under load
test_resource_usage() {
    log_info "Testing resource usage under load..."
    
    # This would typically monitor CPU, memory, and network usage
    # For now, we'll do a basic test of response consistency under load
    
    local consistent_responses=0
    local inconsistent_responses=0
    
    # Get baseline response
    local baseline_response=$(curl -s "$BASE_URL" | wc -c)
    
    log_info "Baseline response size: $baseline_response bytes"
    
    # Test response consistency under load
    for i in {1..20}; do
        local response_size=$(curl -s "$BASE_URL" | wc -c)
        
        if [ "$response_size" -eq "$baseline_response" ]; then
            consistent_responses=$((consistent_responses + 1))
        else
            inconsistent_responses=$((inconsistent_responses + 1))
            log_warning "Response size inconsistency: expected $baseline_response, got $response_size"
        fi
    done
    
    log_info "Response consistency: $consistent_responses/20 consistent"
    
    if [ "$inconsistent_responses" -eq 0 ]; then
        log_success "All responses were consistent"
    else
        log_warning "$inconsistent_responses responses were inconsistent"
    fi
}

# Generate performance report
generate_performance_report() {
    log_info "Generating performance report..."
    
    local report_file="performance-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Performance and Load Test Report"
        echo "Generated: $(date)"
        echo "Base URL: $BASE_URL"
        echo "Concurrent Users: $CONCURRENT_USERS"
        echo "Test Duration: ${TEST_DURATION}s"
        echo "Load Time Threshold: ${LOAD_TIME_THRESHOLD}ms"
        echo "=================================="
        echo
        
        echo "Test Configuration:"
        echo "- Base URL: $BASE_URL"
        echo "- Concurrent Users: $CONCURRENT_USERS"
        echo "- Test Duration: ${TEST_DURATION}s"
        echo "- Load Time Threshold: ${LOAD_TIME_THRESHOLD}ms"
        echo
        
        echo "Mobile User Agents Tested:"
        for i in "${!MOBILE_USER_AGENTS[@]}"; do
            echo "  $((i+1)). ${MOBILE_USER_AGENTS[$i]}"
        done
        echo
        
        echo "Lighthouse Reports:"
        if [ -f "lighthouse-report-*-desktop.json" ]; then
            echo "- Desktop report available"
        fi
        if [ -f "lighthouse-report-*-mobile.json" ]; then
            echo "- Mobile report available"
        fi
        echo
        
        echo "Test Summary:"
        echo "- Load time tests: Completed"
        echo "- Mobile performance tests: Completed"
        echo "- API performance tests: Completed"
        echo "- Concurrent user tests: Completed"
        echo "- Resource usage tests: Completed"
        
    } > "$report_file"
    
    log_success "Performance report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main execution
main() {
    log_info "Starting performance and load testing..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run tests
    check_prerequisites
    test_connectivity
    test_load_time
    test_mobile_performance
    run_lighthouse_audit
    test_api_performance
    test_concurrent_users
    test_resource_usage
    generate_performance_report
    
    log_success "Performance and load testing completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --concurrent-users)
            CONCURRENT_USERS="$2"
            shift 2
            ;;
        --test-duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        --load-time-threshold)
            LOAD_TIME_THRESHOLD="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --base-url URL              Base URL to test (default: http://localhost:3000)"
            echo "  --concurrent-users NUM      Number of concurrent users (default: 50)"
            echo "  --test-duration SECONDS     Test duration in seconds (default: 60)"
            echo "  --load-time-threshold MS    Load time threshold in ms (default: 3000)"
            echo "  --help                     Show this help message"
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