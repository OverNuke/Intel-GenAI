/** Software needs the manager's authorization; Ariadna can neither grant nor skip it. */
export function AuthorizationNotice() {
  return (
    <p role="note" className="callout">
      Instalar programas necesita la autorización de tu jefe o encargado.
    </p>
  );
}
