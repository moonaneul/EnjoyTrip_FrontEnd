# DEV2_TEST_CHECKLIST

Status legend:
- PASS: executed successfully
- BLOCKED: environment/key prevents execution
- PENDING-INTEGRATION: requires Dev1/integrator

| TC | Scenario | Status | Evidence / Note |
|---|---|---|---|
| TC-GEO-01 | 위치 허용 | BLOCKED | Geolocation implementation exists; managed headless browser cannot load local app |
| TC-GEO-02 | 위치 거부 → manual fallback | BLOCKED | Error/fallback branch implemented; interactive browser QA pending |
| TC-TIME-01 | 14:00~19:00 = 300 min | PASS | Node domain test |
| TC-TIME-02 | start >= end | PASS | Node validation test |
| TC-ROUTE-01 | transit success duration/fare | PASS | Mocked official Kakao response parser test |
| TC-ROUTE-02 | car success duration/distance/fare null | PASS | Mocked official Kakao response parser test |
| TC-ROUTE-03 | provider fail | PASS | returns `unavailable`, no fake confirmed duration |
| TC-REC-01 | slow | PASS | 2-place long-dwell plan in 5h fixture |
| TC-REC-02 | full | PASS | 5-place tighter plan in 5h fixture |
| TC-REC-03 | random theme | PASS | theme + seeded reproducibility |
| TC-REC-04 | closed excluded | PASS | all returned places checked |
| TC-REC-05 | unknown hours warning | PASS | fixture + warning generation exercised |
| TC-REC-06 | 2~3h micro trip | PASS | 2.5h sample produces >=1 valid plan |
| TC-REC-07 | 5h return valid | PASS | all 3 plans `returnAt <= endAt` |
| TC-REC-08 | no candidates | PASS | returns honest `[]` |
| TC-REC-09 | meal time | PASS | meal insertion logic exercised in 5h sample |
| TC-STAY-01 | stay OFF | PASS | all plans lodging null |
| TC-STAY-02 | stay ON | PASS | lodging required and attached |
| TC-SAVE-01 | save | PASS | LocalStorage unit test |
| TC-SAVE-02 | delete | PASS | LocalStorage unit test |
| TC-FAIL-01 | corrupted localStorage | PASS | corrupt JSON clears/recover [] |
| Random reproducibility | same seed | PASS | place ID sequence equal |
| Frozen CSS | style.css unchanged | PASS | SHA-256 `fba6143e...ec216` |
| HTML references | no missing local static refs | PASS | static parser check |
| JS syntax | all modules | PASS | `node --check` |
| TC-RESP-01 | 1440 | BLOCKED | managed Chromium blocks local/file URLs |
| TC-RESP-02 | 1024 | BLOCKED | same |
| TC-RESP-03 | 768 | BLOCKED | same |
| TC-RESP-04 | 390 snap carousel | BLOCKED | CSS preserved + dynamic indicator implemented; visual run pending |
| TC-RESP-05 | 375 overflow | BLOCKED | visual run pending |
| TC-MERGE-01 | Mock -> Real without engine rewrite | PENDING-INTEGRATION | provider injection implemented |
| TC-MERGE-02 | login user ownerUserId | PENDING-INTEGRATION | Dev1 auth session required |
| Real Kakao authenticated smoke | Transit/Car | BLOCKED | no real key supplied; external DNS unavailable in code runtime |
| Browser CORS | Kakao endpoints | BLOCKED | must verify with real app/key in final environment |

## Automated command

```bash
node tests/dev2.test.js
```

## Manual integration QA order

1. Add local Kakao keys.
2. Open `index.html` through a normal local web server.
3. Test geolocation Allow.
4. Test geolocation Deny and manual coordinate fallback.
5. Run Transit 14:00~19:00.
6. Confirm 3 cards have materially different places/dwell/theme.
7. Open all Detail pages and verify timeline totals / map markers.
8. Run Car mode and confirm cost is not shown as a car fare.
9. Run 2.5h condition.
10. Run Accommodation ON.
11. Save/delete from F104.
12. Test corrupted localStorage recovery.
13. Verify 1440 / 1024 / 768 / 390 / 375.
14. Swap Mock provider to Dev1 provider and rerun without Recommendation changes.

## VSCode Local / Kakao Proxy QA
- [x] `npm run check` passes
- [x] `dev-server.mjs` serves `index.html` with HTTP 200
- [x] `/api/runtime-config` returns proxy config
- [x] No REST key => proxy returns explicit 503 and recommendation fallback remains estimated
- [x] Proxy adapter does not attach Kakao REST Authorization header in browser request
- [x] `css/style.css` frozen hash unchanged
- [x] HTML local references resolve
- [ ] Real Kakao key: `npm run smoke:kakao` four PASS items (developer machine required)
- [ ] Kakao Map JavaScript SDK renders with `http://localhost:4173` registered domain
- [ ] 1440/1024/768/390/375 visual QA in local browser
