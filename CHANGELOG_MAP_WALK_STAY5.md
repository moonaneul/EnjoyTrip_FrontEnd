# DEV2 update — Map marker info / walking fallback / lodging 5

## Added
- Kakao walking route proxy: `/api/kakao/walk`
- Transit failure handling: for routes within 1.5 km, try Kakao walking route before distance estimate
- Final plan route diagnostics (`plan.routeDiagnostics`)
- Detailed fallback reasons on detail page
- Clickable Kakao map markers with InfoWindow: type, address, category, operating info, Kakao Map link
- Up to 5 lodging recommendations (`plan.lodgingOptions`)
- Dedicated lodging recommendation section on detail page
- Lodging candidate pins on the detail map
- 5 Gwangju mock lodging fixtures and 5 Seoul mock lodging fixtures
- `smoke:kakao` walking-route check

## Behavior
1. Transit confirmed -> use transit.
2. Transit unavailable and straight-line distance <= 1.5 km -> request Kakao walking route.
3. Walking confirmed -> use confirmed walking time and label the segment as a walking fallback.
4. Otherwise -> use EstimatedRouteProvider and preserve the original failure reason.

## Notes
- The itinerary still uses one route-validated lodging as the active lodging.
- Other lodging items are comparison candidates, not silently swapped into the itinerary.
- Mock lodging names are standalone development fixtures. Real integration should replace them with the Dev1/TourAPI provider.
