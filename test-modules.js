// Test module loading
async function test() {
  console.log('Testing module loading...');

  try {
    const laborTools = await import('./src/core/tools/labor-tools.mjs');
    console.log('laborTools loaded');
    console.log('laborTools type:', typeof laborTools);
    console.log('laborTools keys:', Object.keys(laborTools));
    console.log('laborTools.default type:', typeof laborTools.default);
    if (laborTools.default) {
      console.log('laborTools.default keys:', Object.keys(laborTools.default));
    }

    // Test accessing the tools
    const tools = laborTools.default || laborTools;
    console.log('\nTools available:');
    console.log('- whoami:', typeof tools.whoami);
    console.log('- start_login:', typeof tools.start_login);

  } catch (error) {
    console.error('Error:', error);
  }
}

test();