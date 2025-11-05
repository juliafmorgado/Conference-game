# ConfigMap Integration Documentation

## Overview

The Conference Games application uses Kubernetes ConfigMaps to manage game content (sentences and acronyms) in a cloud-native way. This integration allows for dynamic content updates without requiring application rebuilds or redeployments.

## Architecture

### ConfigMap Structure

The application uses environment-specific ConfigMaps to store game content:

- **Development**: `{release-name}-content-development`
- **Staging**: `{release-name}-content-staging` 
- **Production**: `{release-name}-content-production`
- **Generic**: `{release-name}-content` (fallback)

### Content Files

Each ConfigMap contains two JSON files:

1. **sentences.json**: Contains sentence prompts organized by categories
2. **acronyms.json**: Contains technical acronyms and their definitions

### Backend Integration

The backend service loads content from ConfigMaps mounted at `/app/content` and provides REST API endpoints:

- `GET /api/sentences` - Fetch sentences with optional category filtering
- `GET /api/acronyms` - Fetch all acronyms
- `GET /api/categories` - Get available categories
- `POST /api/content/reload` - Force reload content from ConfigMaps

## Configuration

### Helm Values

```yaml
configMaps:
  gameContent:
    create: true                    # Create ConfigMaps
    hotReload: true                 # Enable hot reload functionality
    environmentSpecific: true       # Use environment-specific ConfigMaps
    validateContent: true           # Validate content structure
```

### Environment Variables

```bash
CONFIGMAP_PATH=/app/content         # Path where ConfigMaps are mounted
WATCH_CONFIG_CHANGES=true          # Enable file watching for hot reload
CONTENT_CACHE_TIMEOUT=300000       # Cache timeout in milliseconds (5 minutes)
```

## Hot Reload Functionality

### How It Works

1. **File Watching**: The backend service watches ConfigMap files for changes
2. **Debounced Reload**: Changes trigger a debounced reload (1-second delay)
3. **Cache Invalidation**: Content cache is cleared when changes are detected
4. **Graceful Fallback**: If reload fails, previous content remains available

### Configuration

Hot reload is controlled by:
- `WATCH_CONFIG_CHANGES` environment variable
- `configMaps.gameContent.hotReload` Helm value
- Disabled automatically in production for stability

### ConfigMap Reloader

The application supports [Reloader](https://github.com/stakater/Reloader) for automatic pod restarts:

```yaml
annotations:
  configmap.reloader.stakater.com/reload: "true"
```

## Content Structure

### Sentences Format

```json
{
  "sentences": [
    {
      "id": "unique-id",
      "text": "Sentence prompt ending with...",
      "category": "Kubernetes"
    }
  ]
}
```

### Acronyms Format

```json
{
  "acronyms": [
    {
      "id": "unique-id", 
      "term": "K8s",
      "meaning": "Kubernetes",
      "domain": "Container Orchestration"
    }
  ]
}
```

### Categories

Standard categories include:
- **Kubernetes**: Container orchestration topics
- **DevOps**: Development and operations practices
- **Observability**: Monitoring and logging topics
- **Culture**: Team and organizational topics

## API Endpoints

### GET /api/sentences

Fetch sentences with optional filtering and pagination.

**Query Parameters:**
- `category` (optional): Filter by category
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 40,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  },
  "categories": ["Kubernetes", "DevOps", "Observability", "Culture"]
}
```

### GET /api/acronyms

Fetch acronyms with optional pagination.

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 51,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

### GET /api/categories

Get available sentence categories.

**Response:**
```json
{
  "data": ["Culture", "DevOps", "Kubernetes", "Observability"],
  "total": 4
}
```

### POST /api/content/reload

Force reload content from ConfigMaps.

**Response:**
```json
{
  "message": "Content reloaded successfully",
  "timestamp": "2025-11-05T16:55:00.000Z"
}
```

## Testing

### Unit Tests

Run ConfigMap integration tests:

```bash
cd backend
npm test -- --testPathPatterns=configmap-integration.test.ts
```

### Content Validation

Validate content structure and synchronization:

```bash
node scripts/validate-configmap-content.js --cross-validate
```

### Functionality Testing

Test ConfigMap functionality without Kubernetes:

```bash
node scripts/test-configmap-functionality.js
```

### Integration Testing

Test complete ConfigMap integration in Kubernetes:

```bash
./scripts/test-configmap-integration.sh
```

## Deployment

### Helm Deployment

Deploy with ConfigMap integration:

```bash
helm upgrade --install conference-games ./helm/conference-games \
  --set global.environment=production \
  --set configMaps.gameContent.create=true \
  --set configMaps.gameContent.hotReload=false \
  --set configMaps.gameContent.environmentSpecific=true
```

### Content Updates

Update content in running deployment:

```bash
# Update ConfigMap
kubectl patch configmap conference-games-content-production \
  --type merge \
  --patch '{"data":{"sentences.json":"..."}}'

# Force reload (if hot reload is disabled)
kubectl exec deployment/conference-games-backend -- \
  curl -X POST http://localhost:3000/api/content/reload
```

## Monitoring

### Health Checks

The application provides health checks that include ConfigMap status:

```bash
curl http://localhost:3000/health
```

### Metrics

ConfigMap-related metrics are available at `/metrics`:

- Content load time
- Cache hit/miss rates
- Reload frequency
- Error rates

### Logging

ConfigMap operations are logged with structured format:

```json
{
  "level": "info",
  "message": "Content updated successfully",
  "timestamp": "2025-11-05T16:55:00.000Z",
  "service": "configMapLoader"
}
```

## Troubleshooting

### Common Issues

1. **ConfigMap Not Found**
   - Verify ConfigMap exists: `kubectl get configmap`
   - Check Helm values: `configMaps.gameContent.create=true`

2. **Content Not Loading**
   - Check mount path: `/app/content`
   - Verify file permissions
   - Check logs for validation errors

3. **Hot Reload Not Working**
   - Verify `WATCH_CONFIG_CHANGES=true`
   - Check file watcher setup in logs
   - Ensure ConfigMap is writable

4. **Validation Errors**
   - Run content validation script
   - Check JSON syntax
   - Verify required fields

### Debug Commands

```bash
# Check ConfigMap content
kubectl get configmap conference-games-content -o yaml

# Check pod logs
kubectl logs deployment/conference-games-backend

# Test API endpoints
kubectl port-forward service/conference-games-backend 3000:3000
curl http://localhost:3000/api/sentences

# Force content reload
curl -X POST http://localhost:3000/api/content/reload
```

## Security Considerations

### Content Validation

- All content is validated against schemas
- XSS prevention through content sanitization
- Input validation on API endpoints

### Access Control

- ConfigMaps use RBAC for access control
- Read-only mounts in production
- Separate ConfigMaps per environment

### Monitoring

- Content changes are logged
- Failed validation attempts are tracked
- Unauthorized access attempts are monitored

## Performance

### Caching Strategy

- Content is cached in memory for 5 minutes
- API responses include ETag headers
- Cache is invalidated on content updates

### Optimization

- Lazy loading of content
- Efficient JSON parsing
- Minimal memory footprint
- Connection pooling for database operations

## Best Practices

### Content Management

1. **Version Control**: Store content in Git alongside code
2. **Validation**: Always validate content before deployment
3. **Testing**: Test content changes in staging first
4. **Backup**: Keep backups of production content

### Deployment

1. **Environment Separation**: Use different ConfigMaps per environment
2. **Gradual Rollout**: Update content gradually in production
3. **Monitoring**: Monitor application health after content updates
4. **Rollback Plan**: Have a rollback strategy for content issues

### Security

1. **Access Control**: Limit ConfigMap write access
2. **Content Review**: Review all content changes
3. **Validation**: Use automated validation in CI/CD
4. **Monitoring**: Monitor for unauthorized changes