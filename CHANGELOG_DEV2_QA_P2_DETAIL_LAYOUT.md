# DEV2 QA P2 — Detail layout fix

## Problem
On desktop 2-column detail layouts, CSS Grid's default `align-items: stretch` made the map card grow to the same height as a long 1-night/2-day timeline. The Kakao map itself stayed near its intended height, leaving a large empty paper-colored area below it.

## Fix
Only the Dev2 page stylesheet was changed. `css/style.css` remains frozen.

```css
@media (min-width:1200px){
  .detail-grid{align-items:start}
  .detail-grid > .map-card{align-self:start;height:auto;min-height:0}
}
```

This keeps the desktop map card at its own content height while the timeline can continue growing independently. Tablet/mobile behavior remains unchanged because the override only applies from 1200px upward.

## Scope
- No recommendation logic changes
- No Kakao API changes
- No timeline changes
- No lodging changes
- No global navigation changes
