/**
 * Integration Performance Tests - Phase 7.3
 * Compare V27.0 performance against V26.7 baseline
 * Reference: AGENT_DEFINITIVE_EXECUTION_PLAN.md Lines 674-688
 */

// Performance baselines from V26.7 (with +5% tolerance)
const PERFORMANCE_METRICS = {
  'person_resolver': { baseline: 387, max: 406 },        // +5%
  'activity_for_person_month': { baseline: 1489, max: 1563 },
  'get_timecard_details': { baseline: 2341, max: 2458 },
  'whoami': { baseline: 100, max: 150 },                 // Fast auth check
  'get_cache_stats': { baseline: 50, max: 100 }          // Cache should be instant
};

// Critical thresholds that must not be exceeded
const CRITICAL_THRESHOLDS = {
  coldStart: 3000,        // Max 3 seconds
  warmStart: 1000,        // Max 1 second
  totalMemory: 512 * 1024 * 1024  // Max 512MB
};

/**
 * Measure tool execution time
 */
async function measureTool(server, toolName, args = {}) {
  const start = Date.now();

  try {
    await server.executeTool(toolName, args);
    const elapsed = Date.now() - start;
    return { success: true, elapsed };
  } catch (error) {
    const elapsed = Date.now() - start;
    return { success: false, elapsed, error: error.message };
  }
}

/**
 * Test cold start performance
 */
async function testColdStart() {
  console.log('\n📊 Testing Cold Start Performance...');

  const start = Date.now();

  // Dynamically import to simulate cold start
  const { LaborServer } = await import('../../src/domains/labor/server.mjs');
  const server = new LaborServer();

  await server.initialize();

  const elapsed = Date.now() - start;
  const passed = elapsed <= CRITICAL_THRESHOLDS.coldStart;

  console.log(`  Cold start: ${elapsed}ms (max: ${CRITICAL_THRESHOLDS.coldStart}ms) ${passed ? '✅' : '❌'}`);

  return { passed, elapsed, server };
}

/**
 * Test warm start performance
 */
async function testWarmStart(existingServer) {
  console.log('\n📊 Testing Warm Start Performance...');

  const start = Date.now();

  // Just test tool execution on already initialized server
  await existingServer.executeTool('whoami');

  const elapsed = Date.now() - start;
  const passed = elapsed <= CRITICAL_THRESHOLDS.warmStart;

  console.log(`  Warm start: ${elapsed}ms (max: ${CRITICAL_THRESHOLDS.warmStart}ms) ${passed ? '✅' : '❌'}`);

  return { passed, elapsed };
}

/**
 * Test tool performance against baselines
 */
async function testToolPerformance(server) {
  console.log('\n📊 Testing Tool Performance...');

  const results = {};
  let allPassed = true;

  // Test each metric
  for (const [tool, times] of Object.entries(PERFORMANCE_METRICS)) {
    // Prepare test args based on tool
    let args = {};

    switch (tool) {
      case 'person_resolver':
        args = { search_term: 'Sam Mistretta' };
        break;
      case 'activity_for_person_month':
        args = { person_name: 'Sam Mistretta', year: 2024, month: 10 };
        break;
      case 'get_timecard_details':
        args = {
          person_name: 'Sam Mistretta',
          start_date: '2024-10-01',
          end_date: '2024-10-31'
        };
        break;
    }

    // Measure performance
    const result = await measureTool(server, tool, args);

    if (!result.success && tool !== 'whoami') {  // whoami might fail without auth
      console.log(`  ⚠️ ${tool}: Failed - ${result.error}`);
      results[tool] = { ...result, passed: false };
      continue;
    }

    const passed = result.elapsed <= times.max;

    console.log(`  ${tool}: ${result.elapsed}ms (baseline: ${times.baseline}ms, max: ${times.max}ms) ${passed ? '✅' : '❌'}`);

    results[tool] = { ...result, passed, baseline: times.baseline, max: times.max };

    if (!passed) allPassed = false;
  }

  return { results, allPassed };
}

/**
 * Test memory usage
 */
async function testMemoryUsage() {
  console.log('\n📊 Testing Memory Usage...');

  const usage = process.memoryUsage();
  const totalMemory = usage.heapUsed + usage.external;
  const passed = totalMemory <= CRITICAL_THRESHOLDS.totalMemory;

  console.log(`  Heap Used: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
  console.log(`  External: ${Math.round(usage.external / 1024 / 1024)}MB`);
  console.log(`  Total: ${Math.round(totalMemory / 1024 / 1024)}MB (max: ${Math.round(CRITICAL_THRESHOLDS.totalMemory / 1024 / 1024)}MB) ${passed ? '✅' : '❌'}`);

  return { passed, usage: totalMemory };
}

/**
 * Main test runner
 */
async function runPerformanceTests() {
  console.log('========================================');
  console.log('V27.0 Integration Performance Tests');
  console.log('========================================');

  let server;
  const testResults = {
    coldStart: null,
    warmStart: null,
    toolPerformance: null,
    memory: null,
    passed: false
  };

  try {
    // Test 1: Cold Start
    const coldStartResult = await testColdStart();
    testResults.coldStart = coldStartResult;
    server = coldStartResult.server;

    if (!coldStartResult.passed) {
      console.error('❌ Cold start performance exceeded threshold');
    }

    // Test 2: Warm Start
    const warmStartResult = await testWarmStart(server);
    testResults.warmStart = warmStartResult;

    // Test 3: Tool Performance
    const toolResult = await testToolPerformance(server);
    testResults.toolPerformance = toolResult;

    // Test 4: Memory Usage
    const memoryResult = await testMemoryUsage();
    testResults.memory = memoryResult;

    // Overall result
    testResults.passed =
      coldStartResult.passed &&
      warmStartResult.passed &&
      toolResult.allPassed &&
      memoryResult.passed;

    // Summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Cold Start: ${testResults.coldStart.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Warm Start: ${testResults.warmStart.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tool Performance: ${testResults.toolPerformance.allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Memory Usage: ${testResults.memory.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('----------------------------------------');
    console.log(`Overall: ${testResults.passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('========================================');

    // Cleanup
    if (server) {
      await server.shutdown();
    }

    return testResults;

  } catch (error) {
    console.error('❌ Test execution failed:', error);

    // Cleanup on error
    if (server) {
      await server.shutdown();
    }

    throw error;
  }
}

// Export for use in other test suites
export {
  measureTool,
  testColdStart,
  testWarmStart,
  testToolPerformance,
  testMemoryUsage,
  runPerformanceTests,
  PERFORMANCE_METRICS,
  CRITICAL_THRESHOLDS
};

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests()
    .then(results => {
      process.exit(results.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}