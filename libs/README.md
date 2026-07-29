# Third-party Libraries

## acorn.min.js

The AST parser requires the acorn library. Download it using one of the methods below.

### Download options

1. **Direct download** (recommended):
   - Go to https://cdn.jsdelivr.net/npm/acorn@8.11.3/dist/acorn.min.js
   - Save it as `libs/acorn.min.js`

2. **Using npm**:
   ```bash
   npm pack acorn
   tar -xf acorn-*.tgz
   cp package/dist/acorn.min.js libs/
   rm -rf package acorn-*.tgz
   ```

3. **Using curl**:
   ```bash
   curl -o libs/acorn.min.js https://cdn.jsdelivr.net/npm/acorn@8.11.3/dist/acorn.min.js
   ```

### Version requirements

- Recommended version: 8.11.3 or newer
- Minimum version: 8.0.0

### Verifying the installation

After downloading, run this in the browser console:
```javascript
console.log(acorn.version); // should print the version number
```
