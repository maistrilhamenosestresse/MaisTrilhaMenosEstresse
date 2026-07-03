const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Adiciona comentrio no incio do arquivo se no existir
if (!content.includes('/**')) {
    const jsdocHeader = /**
 * @file LandingPage.tsx
 * @description Pgina principal (Landing Page) da Mais Trilha Menos Estresse.
 *              Exibe o carrossel, depoimentos animados e integrao com o sistema de checkout.
 * @module LandingPage
 */\n;
    content = jsdocHeader + content;
}

// Adiciona JSDoc para a funo principal
content = content.replace('export default function LandingPage() {', 
/**
 * @function LandingPage
 * @description Renderiza a pgina principal do site, controlando as animaes de scroll (Framer Motion) e os vdeos de fundo.
 * @returns {JSX.Element} Componente React renderizado.
 */
export default function LandingPage() {);

fs.writeFileSync('src/app/page.tsx', content);
console.log('JSDoc adicionado a page.tsx');
