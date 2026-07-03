const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

if (!content.includes('import Image from "next/image"')) {
  content = content.replace('import Link', 'import Image from "next/image";\nimport Link');
}

content = content.replace(/<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+className="([^"]+)"\s*\/>/g, 
  '<Image src="$1" alt="$2" width={800} height={800} className="$3" />');

content = content.replace(/<img\s+src="([^"]+)"\s+className="([^"]+)"\s+alt="([^"]*)"\s*\/>/g, 
  '<Image src="$1" alt="$3" width={800} height={800} className="$2" />');

content = content.replace(/<img\s*src="([^"]+)"\s*alt="([^"]*)"\s*className="([^"]+)"\s*\/>/g, 
  '<Image src="$1" alt="$2" width={800} height={800} className="$3" />');

content = content.replace(/<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+className="([^"]+)"\s*\/>/g, 
  '<Image src="$1" alt="$2" width={800} height={800} className="$3" />');

content = content.replace(/<img src="\/FotosEvideos\/logo\/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy\.JPG" alt="Mais Trilha Logo" className="([^"]+)" \/>/g,
  '<Image src="/FotosEvideos/logo/55C232D4-8B60-45C4-82BC-4B25960F8B60%20Copy.JPG" alt="Mais Trilha Logo" width={128} height={128} className="$1" />');

fs.writeFileSync('src/app/page.tsx', content);
console.log("Replaced images successfully!");
