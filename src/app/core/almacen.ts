// localStorage puede no estar disponible (modo privado de algunos moviles):
// solo se usa para comodidades (empresa recordada, ultima comunidad, tema).

export function leer(clave: string): string | null {
  try {
    return localStorage.getItem(`timereport.${clave}`);
  } catch {
    return null;
  }
}

export function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(`timereport.${clave}`);
    else localStorage.setItem(`timereport.${clave}`, valor);
  } catch {
    // Sin persistencia: no es importante.
  }
}
