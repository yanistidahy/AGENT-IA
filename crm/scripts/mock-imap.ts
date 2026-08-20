import { createServer } from "node:tls";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Un serveur IMAP minuscule, **versionné**, pour exercer la copie « Envoyés ».
 *
 * La leçon du jalon 17 : un substitut qui vit dans un dossier temporaire et
 * accepte tout finit par valider des jalons entiers pendant que la vraie chose
 * refuse. Celui-ci est dans le dépôt, il applique les règles qui comptent, et il
 * **écrit sur disque le message reçu octet pour octet** — c'est cette copie
 * qu'on compare à ce que SMTP a transmis.
 *
 * Ce qu'il implémente, et rien de plus : `CAPABILITY`, `LOGIN` (qui refuse un
 * mauvais mot de passe avec le code que le vrai serveur emploie), `LIST` avec
 * les drapeaux SPECIAL-USE, `APPEND` en littéral, `LOGOUT`.
 *
 * TLS et non clair : `imapflow` refuse d'envoyer des identifiants sur une
 * connexion non chiffrée, et c'est très bien ainsi — le contourner en
 * assouplissant le code de production serait exactement ce qu'il ne faut pas
 * faire pour une vérification. Le certificat est auto-signé et le processus qui
 * teste le fait confiance par `NODE_EXTRA_CA_CERTS`.
 *
 * Depuis le jalon 41 il sert aussi le **relevé de la boîte de réception** :
 * `EXAMINE`, `UID SEARCH SINCE` et `UID FETCH … BODY.PEEK[HEADER.FIELDS (…)]`.
 * Le contenu d'INBOX vient d'un fichier JSON (`IMAP_INBOX`) : un tableau
 * d'objets `{ headers: string }`, où `headers` est le bloc d'en-têtes brut du
 * message. **Aucun corps** — c'est tout ce que le produit demande, et le
 * substitut n'en sait pas plus que le vrai serveur n'en dirait.
 *
 * Variables : `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`, `IMAP_CERT`, `IMAP_KEY`,
 * `IMAP_OUT` (dossier où déposer les messages), `IMAP_NO_SENT_FLAG` (pour
 * rejouer le cas « aucun dossier ne porte \Sent »), `IMAP_INBOX` (fichier JSON
 * des messages d'INBOX).
 */

const PORT = Number(process.env.IMAP_PORT ?? 9993);
const USER = process.env.IMAP_USER ?? "yanis@aura.test";
const PASS = process.env.IMAP_PASS ?? "secret";
const OUT = process.env.IMAP_OUT ?? "/tmp/imap-out";
const NO_SENT_FLAG = process.env.IMAP_NO_SENT_FLAG === "1";
const INBOX_FILE = process.env.IMAP_INBOX ?? "";

mkdirSync(OUT, { recursive: true });

interface InboxMessage {
  readonly headers: string;
}

/**
 * Le contenu d'INBOX, relu **à chaque connexion**.
 *
 * Relire plutôt que charger au démarrage permet à une vérification d'ajouter un
 * message entre deux relevés sans redémarrer le substitut — c'est exactement ce
 * qu'il faut pour éprouver l'idempotence et l'arrivée d'une réponse tardive.
 */
function readInbox(): readonly InboxMessage[] {
  if (INBOX_FILE === "") return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(INBOX_FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as InboxMessage[]) : [];
  } catch {
    return [];
  }
}

/**
 * Le contenu du dossier « Envoyés » : **ce qui y a réellement été déposé**.
 *
 * Depuis le jalon 44, le produit relit ce dossier pour rattraper les
 * `Message-ID` faux. Le substitut doit donc le servir — et il le sert depuis
 * les fichiers écrits par ses propres `APPEND`, pas depuis une fixture : c'est
 * la seule façon d'éprouver que ce qu'on redescend est bien ce qu'on avait
 * déposé.
 */
function readSent(): readonly InboxMessage[] {
  try {
    return readdirSync(OUT)
      .filter((name) => name.endsWith(".eml"))
      .sort()
      .map((name) => ({ headers: readFileSync(join(OUT, name), "utf8").split(/\r?\n\r?\n/)[0] ?? "" }));
  } catch {
    return [];
  }
}

/** Les lignes d'en-tête demandées, filtrées comme le ferait HEADER.FIELDS. */
function selectFields(block: string, fields: readonly string[]): string {
  const wanted = new Set(fields.map((field) => field.toLowerCase()));
  const out: string[] = [];
  let keeping = false;
  for (const line of block.split(/\r?\n/)) {
    if (/^[ \t]/.test(line)) {
      // Ligne de repli : elle appartient à l'en-tête précédent.
      if (keeping) out.push(line);
      continue;
    }
    const colon = line.indexOf(":");
    keeping = colon > 0 && wanted.has(line.slice(0, colon).trim().toLowerCase());
    if (keeping) out.push(line);
  }
  return `${out.join("\r\n")}\r\n\r\n`;
}

let appended = 0;

/**
 * Décodage de l'UTF-7 modifié (RFC 3501 §5.1.3).
 *
 * Un vrai client encode « Envoyés » en `Envoy&AOk-s` : comparer la chaîne brute
 * ferait échouer l'`APPEND` sur tout dossier accentué, c'est-à-dire sur le cas
 * français, qui est précisément celui qu'on veut vérifier. **Défaut du
 * substitut, pas du produit** — et il aurait fait passer un comportement
 * correct pour une panne.
 */
function decodeUtf7(value: string): string {
  return value.replace(/&([^-]*)-/g, (_all, chunk: string) => {
    if (chunk === "") return "&";
    const base64 = chunk.replace(/,/g, "/");
    const bytes = Buffer.from(base64, "base64");
    let out = "";
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      out += String.fromCharCode(bytes.readUInt16BE(index));
    }
    return out;
  });
}

createServer(
  {
    cert: readFileSync(process.env.IMAP_CERT ?? "cert.pem"),
    key: readFileSync(process.env.IMAP_KEY ?? "key.pem"),
  },
  (socket) => {
    // **Tamponné par ligne.** Le puits SMTP du jalon 32 découpait chaque paquet
    // TCP isolément et coupait en deux les lignes à cheval : le défaut a failli
    // passer pour un défaut du produit. On ne le refait pas.
    let buffer = "";
    /** Octets restant à lire d'un littéral `{n}` en cours. */
    let pending = 0;
    let literal = "";
    let literalTag = "";
    let inbox: readonly InboxMessage[] = [];

    const send = (line: string) => socket.write(`${line}\r\n`);

    send("* OK [CAPABILITY IMAP4rev1 SPECIAL-USE AUTH=PLAIN] mock-imap prêt");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("binary");

      for (;;) {
        if (pending > 0) {
          const take = Math.min(pending, buffer.length);
          literal += buffer.slice(0, take);
          buffer = buffer.slice(take);
          pending -= take;
          if (pending > 0) return;

          appended += 1;
          const path = join(OUT, `message-${appended}.eml`);
          writeFileSync(path, Buffer.from(literal, "binary"));
          console.log(`APPEND reçu : ${literal.length} octets → ${path}`);
          literal = "";
          // La ligne qui suit le littéral (souvent vide) est consommée avec le
          // reste du tampon à la prochaine itération.
          send(`${literalTag} OK [APPENDUID 1 ${appended}] APPEND terminé`);
          continue;
        }

        const cut = buffer.indexOf("\r\n");
        if (cut === -1) return;
        const line = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        if (line.trim() === "") continue;

        const [tag = "*", command = "", ...rest] = line.split(" ");
        const verb = command.toUpperCase();

        if (verb === "CAPABILITY") {
          send("* CAPABILITY IMAP4rev1 SPECIAL-USE AUTH=PLAIN");
          send(`${tag} OK CAPABILITY terminé`);
        } else if (verb === "LOGIN") {
          const user = (rest[0] ?? "").replace(/^"|"$/g, "");
          const pass = (rest[1] ?? "").replace(/^"|"$/g, "");
          if (user === USER && pass === PASS) send(`${tag} OK LOGIN réussi`);
          // Le code exact que le vrai serveur renvoie : c'est lui que
          // `describeImapError()` reconnaît, et le tester avec autre chose ne
          // prouverait rien.
          else send(`${tag} NO [AUTHENTICATIONFAILED] Authentication failed.`);
        } else if (verb === "LIST" || verb === "XLIST") {
          // **Ne répondre qu'à l'interrogation de premier niveau.** `imapflow`
          // explore la hiérarchie en demandant `Corbeille.%` puis `INBOX.%` ;
          // renvoyer la même liste à chaque fois lui faisait construire des
          // chemins imbriqués — « Corbeille.Envoyés » — et l'`APPEND` partait
          // vers un dossier inexistant. Second défaut du substitut qui a
          // ressemblé à un défaut du produit.
          const pattern = (rest[rest.length - 1] ?? "").replace(/^"|"$/g, "");
          if (pattern !== "*" && pattern !== "%") {
            send(`${tag} OK LIST terminé`);
            continue;
          }
          send('* LIST (\\HasNoChildren) "." "INBOX"');
          send(
            NO_SENT_FLAG
              ? '* LIST (\\HasNoChildren) "." "Boîte perso"'
              : '* LIST (\\HasNoChildren \\Sent) "." "Envoyés"',
          );
          send('* LIST (\\HasNoChildren \\Trash) "." "Corbeille"');
          send(`${tag} OK LIST terminé`);
        } else if (verb === "APPEND") {
          const match = /\{(\d+)\+?\}$/.exec(line.trim());
          if (match === null) {
            send(`${tag} BAD APPEND sans littéral`);
            continue;
          }
          // Le nom du dossier est le premier argument ; on le refuse s'il n'est
          // pas celui qu'on annonce, comme le ferait un vrai serveur.
          const mailbox = decodeUtf7((rest[0] ?? "").replace(/^"|"$/g, ""));
          if (mailbox !== "Envoyés" && mailbox !== "INBOX") {
            send(`${tag} NO [TRYCREATE] Mailbox doesn't exist: ${mailbox}`);
            continue;
          }
          literalTag = tag;
          pending = Number(match[1]);
          literal = "";
          send("+ Envoyez le message");
        } else if (verb === "SELECT" || verb === "EXAMINE") {
          const box = decodeUtf7((rest[0] ?? "").replace(/^"|"$/g, ""));
          const isSent = box === "Envoyés";
          if (box.toUpperCase() !== "INBOX" && !isSent) {
            send(`${tag} NO [NONEXISTENT] Mailbox doesn't exist: ${box}`);
            continue;
          }
          inbox = isSent ? readSent() : readInbox();
          send("* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)");
          send(`* ${inbox.length} EXISTS`);
          send("* 0 RECENT");
          send("* OK [UIDVALIDITY 1] UIDs valides");
          send(`* OK [UIDNEXT ${inbox.length + 1}] Prochain UID`);
          // `[READ-ONLY]` sur EXAMINE : le client doit voir que la boîte n'est
          // pas modifiable, sinon la lecture seule ne serait pas éprouvée.
          console.log(`${verb} ${box} — ${inbox.length} message(s), ${verb === "EXAMINE" ? "lecture seule" : "LECTURE-ÉCRITURE"}`);
          send(`${tag} OK [${verb === "EXAMINE" ? "READ-ONLY" : "READ-WRITE"}] ${verb} terminé`);
        } else if (verb === "UID" && (rest[0] ?? "").toUpperCase() === "SEARCH") {
          // Tous les UID : le `SINCE` du vrai serveur filtre par jour, et le
          // substitut n'a pas à être plus fin — le produit doit de toute façon
          // supporter de revoir des messages déjà traités.
          send(`* SEARCH ${inbox.map((_message, index) => index + 1).join(" ")}`.trimEnd());
          send(`${tag} OK UID SEARCH terminé`);
        } else if (verb === "UID" && (rest[0] ?? "").toUpperCase() === "FETCH") {
          const fields = /HEADER\.FIELDS \(([^)]*)\)/i.exec(line);
          if (fields === null) {
            // Le produit ne demande **que** des en-têtes : un FETCH qui
            // réclamerait autre chose est un défaut à faire échouer bruyamment,
            // pas à servir.
            send(`${tag} NO Ce serveur ne sert que BODY.PEEK[HEADER.FIELDS (…)]`);
            continue;
          }
          const wanted = (fields[1] ?? "").split(/\s+/).filter((field) => field !== "");
          console.log(`UID FETCH — en-têtes demandés : ${wanted.join(" ")}`);
          const peek = /BODY\.PEEK\[/i.test(line);
          if (!peek) {
            // Sans PEEK, le serveur armerait `\Seen` : refuser plutôt que de
            // laisser passer un relevé qui marquerait la boîte comme lue.
            send(`${tag} NO BODY sans PEEK refusé : ce relevé doit être en lecture seule`);
            continue;
          }
          inbox.forEach((message, index) => {
            const block = selectFields(message.headers, wanted);
            const size = Buffer.byteLength(block, "utf8");
            send(
              `* ${index + 1} FETCH (UID ${index + 1} BODY[HEADER.FIELDS (${(fields[1] ?? "").trim()})] {${size}}`,
            );
            socket.write(block);
            send(")");
          });
          send(`${tag} OK UID FETCH terminé`);
        } else if (verb === "LOGOUT") {
          send("* BYE mock-imap ferme");
          send(`${tag} OK LOGOUT terminé`);
          socket.end();
        } else {
          // ID, ENABLE, NAMESPACE, NOOP… : répondre OK plutôt que BAD, sinon
          // le client abandonne avant d'arriver à ce qu'on veut mesurer.
          send(`${tag} OK ${verb} terminé`);
        }
      }
    });

    socket.on("error", (error) => console.error("socket:", error.message));
  },
).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-imap sur imaps://127.0.0.1:${PORT} — dépôts dans ${OUT}`);
});
