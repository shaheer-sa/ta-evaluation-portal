export const THEME_KEY = "tams-theme";

// runs before the page paints (see app/layout.tsx) so a dark-mode user never
// sees a flash of the light theme. light is the default.
export const themeInitScript = `try{if(localStorage.getItem("${THEME_KEY}")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`;
