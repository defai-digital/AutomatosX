# Frontend Performance Optimization

Optimize React applications for speed and efficiency.

## Core Web Vitals

Target metrics:
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **FCP** (First Contentful Paint): < 1.8s
- **TTI** (Time to Interactive): < 3.8s

## Optimization Strategies

### 1. Code Splitting
- Use React.lazy() for route-based splitting
- Split heavy components (charts, editors, modals)
- Use Suspense with meaningful fallbacks
- Analyze bundle with webpack-bundle-analyzer

### 2. Memoization
- useMemo() for expensive calculations
- useCallback() for callbacks passed to child components
- React.memo() for components that re-render with same props
- Don't over-memoize (profile first)

### 3. Virtualization
- Use react-window or react-virtualized for long lists (>100 items)
- Implement infinite scroll for large datasets
- Lazy load images in viewport

### 4. Asset Optimization
- Compress images (WebP format, use srcset)
- Lazy load images (loading="lazy")
- Use CDN for static assets
- Enable gzip/brotli compression
- Optimize fonts (font-display: swap, preload critical fonts)

### 5. Render Optimization
- Avoid inline function/object creation in render
- Use key prop correctly for lists
- Lift state up sparingly (keep state local when possible)
- Debounce/throttle expensive operations (search, scroll handlers)
- Use production build for deployment

### 6. Network Optimization
- Implement caching strategies (Cache-Control headers)
- Use service workers for offline support
- Prefetch critical resources
- Minimize API calls (batch requests)
- Use GraphQL field selection to fetch only needed data

### 7. Bundle Optimization
- Tree-shake unused code
- Use dynamic imports for conditional features
- Remove unused dependencies
- Use lighter alternatives (date-fns instead of moment)
- Configure webpack to split vendor bundles

## Performance Profiling

Tools and techniques:
- Chrome DevTools Performance tab
- React DevTools Profiler
- Lighthouse CI
- Web Vitals library
- Bundle analyzer

## Quick Checklist

Before deploying:
- [ ] Bundle size analyzed and optimized
- [ ] Images compressed and lazy loaded
- [ ] Long lists virtualized
- [ ] Expensive computations memoized
- [ ] Route-based code splitting implemented
- [ ] Core Web Vitals measured and acceptable
- [ ] Production build tested
- [ ] Caching strategy configured
