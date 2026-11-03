/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_SCRIPT = `try{var m=localStorage.getItem('cp-mode');if(m!=='light'&&m!=='dark')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.mode=m}catch(e){}`;
