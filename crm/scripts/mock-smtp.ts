import { createServer, type Socket } from "node:net";
import { TLSSocket, createSecureContext } from "node:tls";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Un puits SMTP minuscule, **versionné**, qui écrit sur disque la source reçue.
 *
 * Il existait au jalon 32 dans un dossier temporaire, et il a produit un faux
 * défaut : il découpait chaque paquet TCP isolément et coupait en deux les
 * lignes à cheval, ce qui faisait apparaître un blanc parasite dans la
 * signature. Le symptôme a failli être imputé au produit. **Il est tamponné par
 * ligne**, il est dans le dépôt, et la vérification compare la partie décodée
 * au texte d'origine plutôt que de se fier à une lecture à l'œil.
 *
 * **Il annonce et exécute STARTTLS**, parce que le code de production pose
 * `requireTLS` : sans STARTTLS annoncé, nodemailer refuse d'envoyer le mot de
 * passe, et c'est exactement la garantie qu'on veut conserver. Un puits en clair
 * aurait obligé à relâcher le produit pour le tester.
 *
 * Variables : `SMTP_PORT`, `SMTP_OUT`, `SMTP_CERT`, `SMTP_KEY`.
 */

const PORT = Number(process.env.SMTP_PORT ?? 9025);
const OUT = process.env.SMTP_OUT ?? "/tmp/smtp-out";

mkdirSync(OUT, { recursive: true });
let received = 0;

const CONTEXT = createSecureContext({
  cert: readFileSync(process.env.SMTP_CERT ?? "cert.pem"),
  key: readFileSync(process.env.SMTP_KEY ?? "key.pem"),
});

function serve(socket: Socket, secure: boolean) {
  let buffer = "";
  let inData = false;
  let message = "";

  const send = (line: string) => socket.write(`${line}\r\n`);
  if (!secure) send("220 mock-smtp prêt");

  socket.on("data", (chunk) => {
    buffer += chunk.toString("binary");

    for (;;) {
      const cut = buffer.indexOf("\r\n");
      if (cut === -1) return;
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);

      if (inData) {
        if (line === ".") {
          inData = false;
          received += 1;
          const path = join(OUT, `message-${received}.eml`);
          writeFileSync(path, Buffer.from(message, "binary"));
          console.log(`DATA reçu : ${message.length} octets → ${path}`);
          message = "";
          send("250 2.0.0 Message accepté");
          continue;
        }
        // Dé-échappement du point en début de ligne, comme le veut la RFC 5321.
        message += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
        continue;
      }

      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO" || verb === "HELO") {
        send("250-mock-smtp");
        send("250-8BITMIME");
        if (!secure) send("250-STARTTLS");
        send("250 AUTH PLAIN LOGIN");
      } else if (verb === "STAR") {
        send("220 2.0.0 Prêt pour TLS");
        socket.removeAllListeners("data");
        const upgraded = new TLSSocket(socket, { isServer: true, secureContext: CONTEXT });
        serve(upgraded, true);
        return;
      } else if (verb === "AUTH") {
        send("235 2.7.0 Authentification acceptée");
      } else if (verb === "MAIL" || verb === "RCPT") {
        send("250 2.1.0 OK");
      } else if (verb === "DATA") {
        inData = true;
        send("354 Envoyez le message, terminez par un point seul");
      } else if (verb === "QUIT") {
        send("221 2.0.0 Au revoir");
        socket.end();
      } else {
        send("250 2.0.0 OK");
      }
    }
  });

  socket.on("error", (error) => console.error("socket:", error.message));
}

createServer((socket) => serve(socket, false)).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-smtp sur 127.0.0.1:${PORT} — messages dans ${OUT}`);
});
