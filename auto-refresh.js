const fs = require('fs');
const path = require('path');

console.log('🔄 Auto-refresh watcher started');
console.log('📝 Edit files → Auto-refresh extension at chrome://extensions/');

fs.watch('./src', { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js')) {
    console.log(`\n📝 ${filename} changed`);
    console.log('👆 Refresh extension now!');
  }
});

console.log('\n🎯 Quick workflow:');
console.log('1. Edit code');
console.log('2. See notification above');
console.log('3. Go to chrome://extensions/');
console.log('4. Click refresh button on your extension');
console.log('5. Test immediately\n');