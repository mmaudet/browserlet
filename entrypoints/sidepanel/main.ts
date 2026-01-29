// Side panel entry point - will be expanded in Phase 3
console.log('[Browserlet] Side panel loaded');

document.querySelector<HTMLParagraphElement>('#app p')!.textContent = 'Ready';
