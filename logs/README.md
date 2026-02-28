# Pipeline Logs

## View server-side pipeline log

```bash
ssh root@89.167.94.69 "cat /var/www/skyhawk-server/logs/pipeline.log"
```

This log tracks every auto-measure request and which system path it takes (LIDAR, ML model, or Claude Vision fallback). Each line is JSON with: timestamp, user, address, lat/lng, step, path, and reason.
