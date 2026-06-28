export function ContactForm() {
  return (
    <form className="contact-form">
      <label>
        Nombre
        <input type="text" name="name" placeholder="Tu nombre" />
      </label>
      <label>
        Email
        <input type="email" name="email" placeholder="tu@email.com" />
      </label>
      <label>
        Mensaje
        <textarea name="message" rows="4" placeholder="Cuéntanos tu idea" />
      </label>
      <button type="submit">Enviar</button>
    </form>
  );
}
