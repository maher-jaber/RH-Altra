export const environment = {
  production: false,

  // IMPORTANT (Docker prod): le front est servi par Nginx et l'API/Mercure sont accessibles
  // via le même host/port (reverse-proxy). Utiliser des URLs RELATIVES évite les erreurs
  // du type ERR_CONNECTION_REFUSED quand le port host change (8008, 8080, etc.).
  // Base vide => les services appellent directement les routes "/api/...".
  // IMPORTANT: évite le bug "/api/api/..." si les services ont déjà le préfixe "/api".
  apiBaseUrl: '',
  mercureUrl: '/.well-known/mercure'
};
