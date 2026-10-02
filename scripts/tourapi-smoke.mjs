import { placeProvider } from '../js/integration/placeProvider.js';

console.log('TEUM TourAPI smoke test');
try {
  const regions = await placeProvider.getRegions({ cache:false, timeoutMs:10000 });
  console.log(`PASS  Regions — ${regions.length}`);
  const gwangju = regions.find((r) => r.name.includes('광주')) || regions[0];
  if (!gwangju) throw new Error('No region returned');
  const nearby = await placeProvider.getNearbyPlaces({ lat:35.1466, lng:126.9199, radius:8000, size:8 }, { cache:false, timeoutMs:10000 });
  console.log(`PASS  Nearby places — ${nearby.length}`);
  const food = await placeProvider.getFoodCandidates({ lat:35.1466, lng:126.9199, radius:8000, size:5 }, { cache:false, timeoutMs:10000 });
  console.log(`PASS  Nearby food — ${food.length}`);
  const lodging = await placeProvider.getLodgingCandidates({ lat:35.1466, lng:126.9199, radius:12000, size:5 }, { cache:false, timeoutMs:10000 });
  console.log(`PASS  Nearby lodging — ${lodging.length}`);
} catch (error) {
  console.error(`FAIL  TourAPI — ${error?.name || 'Error'}: ${error?.message || error}`);
  process.exitCode = 1;
}
