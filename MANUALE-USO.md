# Manuale rapido di GymTracker

GymTracker è una PWA: si apre da un link e può essere aggiunta alla schermata Home come un'app. Non serve passare da App Store o Play Store.

## 1. Aprire e installare l'app

Per installarla serve il **link HTTPS pubblico** di GymTracker, fornito da chi ha pubblicato l'app. Un indirizzo che inizia con `localhost` funziona solo sul computer che lo ospita; anche un file `index.html` aperto direttamente non è il link da usare sul telefono.

### iPhone

1. Apri il link di GymTracker in **Safari** e attendi che la pagina sia caricata.
2. Tocca **Condividi** (il quadrato con la freccia verso l'alto).
3. Scorri le opzioni e scegli **Aggiungi alla schermata Home**. Se richiesto, conferma con **Aggiungi**.
4. Avvia GymTracker dalla nuova icona nella schermata Home.

Se l'opzione non compare, verifica di avere aperto il link in Safari e non in un browser incorporato dentro un'altra app.

### Android

1. Apri il link di GymTracker in **Chrome** e attendi che la pagina sia caricata.
2. Tocca il menu **⋮** in alto a destra.
3. Scegli **Installa app** o **Aggiungi a schermata Home** e conferma.
4. Avvia GymTracker dalla nuova icona.

Le diciture possono variare leggermente in base al modello del telefono e alla versione del browser. Se non trovi l'opzione, prova dal menu di Chrome oppure aggiorna il browser.

## 2. Primo avvio e uso offline

- Al primo avvio collegati a Internet e lascia aperta l'app finché la pagina è caricata. Se vuoi usare il riconoscimento delle foto offline, apri anche la funzione di importazione e attendi che il caricamento iniziale sia completato.
- Dopo il primo caricamento, l'app e i dati già salvati sono disponibili anche senza connessione, purché la cache del browser non venga cancellata.
- Il badge in alto indica se il dispositivo risulta online oppure offline. Essere online non attiva la sincronizzazione dei dati: GymTracker non invia automaticamente gli allenamenti a un account o a un server.
- Quando è disponibile una nuova versione, apri l'app con Internet e ricarica la pagina; se necessario, chiudi e riapri l'app per completare l'aggiornamento.

## 3. Navigazione e allenamenti

1. Tocca **☰** per aprire il menu e passare tra **Home**, **Allenamento**, **Calendario**, **Progressi** e **Misure**.
2. Dalla Home puoi creare una scheda, importarne una oppure iniziare un allenamento libero. L'importazione supporta file e contenuti riconosciuti da foto; controlla e correggi la bozza prima di salvarla.
3. In **Allenamento**, seleziona la scheda o l'attività desiderata, inserisci i dati delle serie e tocca **Salva Seduta** al termine.
4. Per registrare una seduta passata, apri **Calendario**, seleziona la data e usa il comando per aggiungere una seduta a quel giorno.
5. In **Progressi** consulta lo storico e scarica un CSV o un backup completo. In **Misure** registra peso e altri dati corporei.

## 4. Backup e trasferimento

Schede, allenamenti e misure vengono salvati **nel browser e sul dispositivo in uso**. Non sono condivisi automaticamente con gli altri membri del gruppo, né passano da un telefono all'altro solo installando l'app.

- Per proteggere i dati, apri **☰ → Progressi → Backup e trasferimento dati → Backup completo (JSON)**. Conserva il file in un posto sicuro, diverso dal solo telefono, e ripeti l'operazione periodicamente.
- Per caricare un backup, sul dispositivo di destinazione apri la stessa app e scegli **Ripristina backup** nella stessa sezione. Il ripristino sostituisce i dati locali dell'app: esporta prima un backup di ciò che vuoi conservare.
- Il file **CSV** serve per leggere o analizzare lo storico in un foglio di calcolo; per ripristinare schede, storico e misure usa il backup **JSON**.
- Se ogni persona installa GymTracker sul proprio telefono, ciascuna avrà il proprio archivio. Il trasferimento tramite backup è manuale.

**Importante:** la modalità privata/incognito, la cancellazione dei dati del sito o del browser, la disinstallazione o il ripristino del dispositivo possono rendere inaccessibili o cancellare i dati locali. Non cancellare i dati del browser senza avere prima esportato un backup.

## 5. Se qualcosa non funziona

- **Non si installa:** controlla di usare il link HTTPS pubblico e un browser aggiornato; su iPhone usa Safari, su Android prova Chrome.
- **Non si apre offline:** torna online, apri GymTracker e attendi il caricamento; poi prova di nuovo senza connessione.
- **Non trovi i tuoi dati su un altro telefono:** è normale, i dati non si sincronizzano; trasferiscili con il backup JSON.
- **Una scheda importata non è corretta:** rivedi la bozza prima di salvarla. Le foto poco nitide o la scrittura a mano possono essere riconosciute male.
