# GymTracker

PWA per registrare schede, sedute, progressi e misure corporee. L'interfaccia si adatta a telefoni, tablet e computer; dopo il primo caricamento continua a funzionare offline.

## Avvio e installazione

Pubblica questa cartella su un hosting statico con HTTPS, ad esempio Netlify. Apri poi l'indirizzo nel browser:

- **iPhone/iPad:** Safari → Condividi → Aggiungi alla schermata Home.
- **Android:** Chrome → menu → Installa app (o Aggiungi a schermata Home).
- **Computer:** usa il browser normalmente; i browser compatibili possono anche offrire l'installazione della PWA.

Per verificare localmente, servi la cartella con un server web. Le funzionalità PWA e il service worker richiedono HTTPS, salvo `localhost`.

Per le istruzioni dettagliate su iPhone e Android, consulta il [manuale rapido](./MANUALE-USO.md).

## Dati e condivisione tra dispositivi

GymTracker non richiede un account e salva i dati nello spazio locale del browser. Questo mantiene l'app privata e utilizzabile offline, ma **non sincronizza automaticamente** allenamenti e schede tra browser o dispositivi e non crea un archivio comune per il gruppo. Per trasferire i dati, usa **Progressi → Backup e trasferimento dati** per esportare un backup e poi ripristinarlo sull'altro dispositivo.

Ogni componente del gruppo può usare la stessa app pubblicata, ma ciascuno avrà il proprio archivio. Un archivio condiviso o la sincronizzazione automatica richiederebbero un backend e una scelta esplicita su account, permessi e privacy.

**Attenzione:** cancellare i dati del sito/browser, ripristinare il dispositivo o rimuovere i dati del browser può eliminare schede e storico salvati localmente. Esporta periodicamente un backup JSON e salvalo in un posto sicuro, separato dal dispositivo. Il CSV esporta lo storico in un formato leggibile anche con fogli di calcolo; il JSON serve a ripristinare tutti i dati nell'app.

## Funzionalità

- Creazione manuale e importazione di schede Excel/CSV, testo incollato o fino a 4 foto/pagine per volta.
- Riconoscimento OCR italiano interamente sul dispositivo: il testo è modificabile e viene preparato come bozza da verificare prima del salvataggio. Il motore OCR e il modello italiano aggiungono circa 16 MB; al primo accesso l’app deve completare il download e la cache degli asset, poi l’OCR funziona offline. La precisione dipende dalla qualità della stampa/foto e la scrittura a mano può non essere riconosciuta.
- Schede e lavagne libere per sala pesi, calisthenics e altre attività, con numero di serie e obiettivi configurabili (una serie iniziale, modificabile); registrazione di ripetizioni, secondi o altri valori testuali.
- Esportazione dello storico in CSV e copia tabulare negli appunti (con neutralizzazione delle formule nei campi testuali) e backup/ripristino completo in JSON.
- Calendario con selezione esplicita della data, anche passata, e dettaglio delle sedute.
- Storico dei carichi, statistiche, timer e diario del peso.
- Backup e ripristino dei dati locali.

Il riconoscimento foto usa Tesseract.js e i dati linguistici `tessdata_fast` in italiano. Le licenze dei componenti sono incluse in `vendor/tesseract/` e `vendor/tessdata/`.
