const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

let changedCount = 0;

function processFile(filePath) {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // 1. Root container
  // Find `<div className="min-h-screen ... flex flex-col md:flex-row`
  // Replace min-h-screen with h-screen overflow-hidden
  content = content.replace(/className="min-h-screen ([^"]*)flex flex-col md:flex-row([^"]*)"/, 'className="h-screen overflow-hidden $1flex flex-col md:flex-row$2"');
  content = content.replace(/className="([^"]*)min-h-screen([^"]*)flex flex-col md:flex-row([^"]*)"/, 'className="$1h-screen overflow-hidden$2flex flex-col md:flex-row$3"');

  // 2. Sidebar
  // Replace `<aside className="fixed md:static... flex flex-col ... ">`
  // We need to add h-full overflow-y-auto flex-shrink-0 style={{ scrollBehavior: 'smooth' }}
  // The prompt says "usando scroll-behavior: smooth via estilo inline ou classe utilitária". Let's use Tailwind `scroll-smooth`
  content = content.replace(/<aside\s+className="([^"]*)"([^>]*)>/g, (match, classes, rest) => {
    if (!classes.includes('md:static') && !classes.includes('w-64')) return match; // Not the sidebar
    // Remove fixed height if any, though it usually doesn't have it
    let newClasses = classes;
    if (!newClasses.includes('h-full')) newClasses += ' h-full';
    if (!newClasses.includes('overflow-y-auto')) newClasses += ' overflow-y-auto';
    if (!newClasses.includes('flex-shrink-0')) newClasses += ' flex-shrink-0';
    if (!newClasses.includes('scroll-smooth')) newClasses += ' scroll-smooth';
    return `<aside className="${newClasses}"${rest}>`;
  });

  // 3. Main content
  // `<main className="flex-1 flex flex-col min-w-0 bg-gray-950">`
  content = content.replace(/<main\s+className="([^"]*)"([^>]*)>/g, (match, classes, rest) => {
    if (!classes.includes('flex-1') && !classes.includes('min-w-0')) return match;
    let newClasses = classes;
    if (!newClasses.includes('h-full')) newClasses += ' h-full';
    if (!newClasses.includes('overflow-y-auto')) newClasses += ' overflow-y-auto';
    return `<main className="${newClasses}"${rest}>`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Updated: ' + filePath);
    changedCount++;
  }
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else {
      processFile(fullPath);
    }
  });
}

dirs.forEach(traverse);
console.log(`Finished processing. Files changed: ${changedCount}`);
