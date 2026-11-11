/** Настройки отображения хранятся в localStorage и применяются атрибутами на <html> (см. globals.css). */
export const A11Y_STORAGE_KEY = "vko-a11y";

/** Скрипт до первой отрисовки: без него страница мигнула бы обычным видом. */
export const a11yInitScript = `try{var p=JSON.parse(localStorage.getItem("${A11Y_STORAGE_KEY}")||"{}"),d=document.documentElement;for(var k in p)if(p[k]&&!/^(md|normal|on)$/.test(p[k]))d.setAttribute("data-"+k,p[k])}catch(e){}`;
