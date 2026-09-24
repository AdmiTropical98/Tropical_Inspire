const regex = /^(\d{6}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})\s+(\d{5,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\s+(.+?)\s+(?:(\d{3,8})\s+)?(GASOLEO\+?|GASÓLEO|GASOLEO|DIESEL|ULTIMATE|ULT\s+DIESEL|ULT\s*DIESEL|ULT|GASOLINA|ADBLUE-?\w*|ADBLUE|GPL|GNV|GASOIL)\s+(.+)$/i;

const line = "150126 01019992 32-UT-37 PORTIMAO - V6 111111 GASOLEO 46,76 1,659 -0,120 1,539 23,00 58,50 13,45 71,95";
console.log(line.match(regex));
