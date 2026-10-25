const paths={
chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
gallery:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
movies:'<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M3 9h18M8 4l3 5m5-5 3 5m-9 4 5 3-5 3Z"/>',
goals:'<path d="M12 3 4 7v6c0 5 8 9 8 9s8-4 8-9V7l-8-4Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
palette:'<path d="M12 3a9 9 0 1 0 0 18h1.3a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.7H18a4 4 0 0 0 4-4 9.5 9.5 0 0 0-10-8Z"/><circle cx="7.5" cy="10" r=".7"/><circle cx="10" cy="6.5" r=".7"/><circle cx="15" cy="7" r=".7"/><circle cx="18" cy="10.5" r=".7"/>',
send:'<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7 2 2 0 0 1 2-2.2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2.6Z"/>',
video:'<rect x="2" y="5" width="14" height="14" rx="4"/><path d="m16 10 6-4v12l-6-4"/>',
mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
end:'<path d="M3 13c5-5 13-5 18 0v5h-5v-4a16 16 0 0 0-8 0v4H3v-5Z"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',
check:'<path d="m5 12 4 4L19 6"/>',
flip:'<path d="M3 8V3h5m13 13v5h-5M3 3l5 5m13 13-5-5M8 3h8a5 5 0 0 1 5 5v3M3 13v3a5 5 0 0 0 5 5h3"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'};
export function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.heart}</svg>`}
export function mountIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
