import test from 'node:test';
import assert from 'node:assert/strict';
import { predictProjectDelay, generateProjectsCsv } from './predictionEngine';
import { analyzeImagePixelsOpenCv } from './soilCvEngine';

test('predictProjectDelay classifies low-risk projects accurately', () => {
  const result = predictProjectDelay({
    totalParcels: 45,
    ownershipVerifiedPct: 96,
    documentationCompletePct: 94,
    compensationDisbursedPct: 92,
    activeLegalDisputesCount: 0,
    pendingClearancesCount: 0,
    overdueMilestonesCount: 0,
    avgSettlementLagDays: 18,
    affectedHouseholdsCount: 40,
  });

  assert.equal(result.riskTier, 'Low');
  assert.ok(result.delayProbabilityPct < 25, `Expected <25%, got ${result.delayProbabilityPct}%`);
  assert.ok(result.majorRiskFactors.length === 6);
  assert.ok(result.preventiveActions.length >= 1);
});

test('predictProjectDelay classifies critical-risk projects with multiple bottlenecks', () => {
  const result = predictProjectDelay({
    totalParcels: 180,
    ownershipVerifiedPct: 42,
    documentationCompletePct: 48,
    compensationDisbursedPct: 31,
    activeLegalDisputesCount: 28,
    pendingClearancesCount: 5,
    overdueMilestonesCount: 3,
    avgSettlementLagDays: 145,
    affectedHouseholdsCount: 520,
  });

  assert.equal(result.riskTier, 'Critical');
  assert.ok(result.delayProbabilityPct >= 75, `Expected >=75%, got ${result.delayProbabilityPct}%`);
  assert.ok(result.predictedDelayDays >= 180);
  assert.equal(result.preventiveActions[0].priority, 'Immediate');
});

test('analyzeImagePixelsOpenCv segments reddish laterite vs wet vegetated pixels and includes scientific disclaimer', () => {
  const width = 20;
  const height = 20;
  const buffer = new Uint8ClampedArray(width * height * 4);
  const overlay = new Uint8ClampedArray(width * height * 4);

  // Fill with reddish-brown soil pixels (R=175, G=95, B=55)
  for (let i = 0; i < width * height; i++) {
    buffer[i * 4] = 175;
    buffer[i * 4 + 1] = 95;
    buffer[i * 4 + 2] = 55;
    buffer[i * 4 + 3] = 255;
  }

  const analysis = analyzeImagePixelsOpenCv(buffer, width, height, 'Synthetic Laterite Test', overlay);
  assert.ok(analysis.apparentSoilColorName.includes('Reddish-Brown'));
  assert.equal(analysis.observations.length, 5);
  assert.ok(analysis.mandatoryScientificDisclaimer.toLowerCase().includes('cannot determine'));
});

test('generateProjectsCsv outputs valid header and escaped row data', () => {
  const lowRiskPred = predictProjectDelay({
    totalParcels: 20,
    ownershipVerifiedPct: 90,
    documentationCompletePct: 90,
    compensationDisbursedPct: 90,
    activeLegalDisputesCount: 1,
    pendingClearancesCount: 0,
    overdueMilestonesCount: 0,
    avgSettlementLagDays: 20,
    affectedHouseholdsCount: 25,
  });

  const csv = generateProjectsCsv([
    {
      id: 'proj-1',
      code: 'NH-44-EXP',
      name: 'NH-44 Six-Lane Bypass, Phase II',
      sector: 'Highway',
      stateRegion: 'Maharashtra',
      district: 'Nagpur',
      implementingAgency: 'NHAI',
      totalAreaHectares: 120,
      acquiredAreaHectares: 108,
      acquisitionProgressPct: 90,
      budgetCroresINR: 840,
      startDate: '2025-04-01',
      scheduledCompletionDate: '2027-03-31',
      coordinates: { lat: 21.1458, lng: 79.0882 },
      features: {
        totalParcels: 20,
        ownershipVerifiedPct: 90,
        documentationCompletePct: 90,
        compensationDisbursedPct: 90,
        activeLegalDisputesCount: 1,
        pendingClearancesCount: 0,
        overdueMilestonesCount: 0,
        avgSettlementLagDays: 20,
        affectedHouseholdsCount: 25,
      },
      prediction: lowRiskPred,
      parcels: [],
      milestones: [],
      lastUpdated: '2026-10-29',
    },
  ]);

  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('Project Code,Project Name'));
  assert.ok(lines[1].includes('"NH-44 Six-Lane Bypass, Phase II"'));
});
